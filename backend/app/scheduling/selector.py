"""Pick the meeting slot. The solver owns this decision; no LLM can override it.

docs/research/negotiation-layer.md, "Recommended design", step 1:

    s* = argmax_{s in S_feasible} sum_i log(eps + u_i(s) - d_i),  ties broken by leximin

* Nash product (Nash 1950): Pareto-optimal for the reported utilities, invariant to each
  agent's positive affine rescaling, and fair on discrete outcomes (Caragiannis et al. 2019).
* eps ~ 0.05 stops one zero from vetoing a slot outright; without it the Nash product is a
  unanimity rule.
* Leximin tie-break, and an optional fairness floor tau (u_i - d_i >= tau for all i), keep
  the "no one is sacrificed" property of max-min (Kalai 1977) without making it the objective.
* If no slot is individually rational (u_i(s) >= d_i for everyone), that is returned as an
  explicit outcome together with the best near-miss, rather than forcing a meeting.

Inputs are utilities already on the common scale (see normalize.py), keyed
agent -> slot -> value, plus d per agent on the same scale and the slots in time order.
The baselines from the report's evaluation plan live here too, so every scheduler is
compared on exactly the same inputs.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Literal

from app.scheduling.fairness import rank_slots
from app.scheduling.normalize import normalize

EPS = 0.05
_TOL = 1e-9

Status = Literal["ok", "no_ir_slot", "floor_unmet", "no_slots"]
Profile = dict[str, dict[str, float]]  # agent -> slot -> utility on the common scale


@dataclass
class Selection:
    slot_id: str | None
    method: str
    status: Status = "ok"
    ranking: list[str] = field(default_factory=list)  # feasible slots, best first, by this method
    objective: dict[str, float] = field(default_factory=dict)  # slot -> the method's score
    near_miss: str | None = None  # when status != ok: the closest slot anyone could live with
    bottleneck: str | None = None  # agent with the lowest gain at the pick

    def to_dict(self) -> dict:
        return {
            "slot_id": self.slot_id, "method": self.method, "status": self.status,
            "near_miss": self.near_miss, "bottleneck": self.bottleneck,
            "objective": {k: round(v, 6) for k, v in self.objective.items()},
        }


def gains(u: Profile, d: dict[str, float], slots: list[str]) -> Profile:
    return {a: {s: u[a][s] - d.get(a, 0.0) for s in slots} for a in u}


def nash_objective(g: Profile, slot: str, eps: float = EPS) -> float:
    """sum_i log(eps + max(0, g_i(s))). A negative gain is clamped: it means the slot is
    worse than no meeting for that person, which the IR check handles separately."""
    total = 0.0
    for row in g.values():
        x = eps + max(0.0, row[slot])
        total += math.log(x) if x > 0 else -math.inf
    return total


def leximin_key(g: Profile, slot: str) -> tuple[float, ...]:
    """Sorted gains, worst first. Comparing these lexicographically is leximin."""
    return tuple(round(v, 9) for v in sorted(row[slot] for row in g.values()))


def bottleneck(g: Profile, slot: str) -> str | None:
    """The agent with the lowest normalized gain at a slot (ties: first listed)."""
    if not g or slot is None:
        return None
    return min(g, key=lambda a: g[a][slot])


def _order(slots: list[str]) -> dict[str, int]:
    return {s: i for i, s in enumerate(slots)}


def nash_select(
    u: Profile,
    d: dict[str, float],
    slots: list[str],
    *,
    eps: float = EPS,
    tau: float | None = None,
    require_ir: bool = True,
) -> Selection:
    """The selector. Nash product with an eps floor, leximin tie-break, optional floor tau."""
    if not slots:
        return Selection(None, "nash", "no_slots")
    g = gains(u, d, slots)
    order = _order(slots)
    obj = {s: nash_objective(g, s, eps) for s in slots}

    def key(s: str):
        return (round(obj[s], 9), leximin_key(g, s), -order[s])

    ranking = sorted(slots, key=key, reverse=True)
    ir = [s for s in ranking if all(g[a][s] >= -_TOL for a in g)]
    if require_ir and not ir:
        # Near miss: the slot that is acceptable to the most people, then the best product.
        near = max(slots, key=lambda s: (sum(1 for a in g if g[a][s] >= -_TOL), key(s)))
        return Selection(None, "nash", "no_ir_slot", ranking, obj, near, bottleneck(g, near))
    pool = ir if require_ir else ranking
    if tau is not None:
        floored = [s for s in pool if all(g[a][s] >= tau - _TOL for a in g)]
        if not floored:
            return Selection(None, "nash", "floor_unmet", ranking, obj, pool[0], bottleneck(g, pool[0]))
        pool = floored
    pick = pool[0]
    return Selection(pick, "nash", "ok", ranking, obj, None, bottleneck(g, pick))


# ---------- baselines (docs/research/negotiation-layer.md, "Baselines") ----------

def leximin_select(u: Profile, d: dict[str, float], slots: list[str]) -> Selection:
    """Egalitarian on the common scale: best worst-off gain, leximin ties. The ablation
    "swap Nash for max-min, keep everything else"."""
    if not slots:
        return Selection(None, "leximin", "no_slots")
    g = gains(u, d, slots)
    order = _order(slots)
    ranking = sorted(slots, key=lambda s: (leximin_key(g, s), -order[s]), reverse=True)
    obj = {s: min(row[s] for row in g.values()) for s in slots}
    return Selection(ranking[0], "leximin", "ok", ranking, obj, None, bottleneck(g, ranking[0]))


def maxmin_raw_select(scores: dict[str, dict[str, int]], slots: list[str]) -> Selection:
    """B3, the old MultiMeet rule: max-min over raw self-reported 0-100 scores, then the
    average, then time order (app/scheduling/fairness.rank_slots, unchanged)."""
    if not slots:
        return Selection(None, "maxmin_raw", "no_slots")
    ranked = rank_slots(slots, scores)
    obj = {r.slot_id: float(r.min_score) for r in ranked}
    pick = ranked[0].slot_id
    worst = min(ranked[0].scores, key=lambda a: ranked[0].scores[a])
    return Selection(pick, "maxmin_raw", "ok", [r.slot_id for r in ranked], obj, None, worst)


def utilitarian_select(u: Profile, slots: list[str]) -> Selection:
    """B4: sum of utilities on the common scale; ties go to the earlier slot."""
    if not slots:
        return Selection(None, "utilitarian", "no_slots")
    order = _order(slots)
    obj = {s: sum(row[s] for row in u.values()) for s in slots}
    ranking = sorted(slots, key=lambda s: (round(obj[s], 9), -order[s]), reverse=True)
    return Selection(ranking[0], "utilitarian", "ok", ranking, obj)


def borda_select(raw: Profile, slots: list[str]) -> Selection:
    """B5: Borda count over each agent's ranking (ties averaged); ties go to the earlier slot."""
    if not slots:
        return Selection(None, "borda", "no_slots")
    ranks = {a: normalize({s: row[s] for s in slots}, "borda") for a, row in raw.items()}
    order = _order(slots)
    obj = {s: sum(r[s] for r in ranks.values()) for s in slots}
    ranking = sorted(slots, key=lambda s: (round(obj[s], 9), -order[s]), reverse=True)
    return Selection(ranking[0], "borda", "ok", ranking, obj)


def approval_select(approvals: dict[str, set[str]], slots: list[str]) -> Selection:
    """B1, When2Meet: the slot the most people marked available (approval voting, Brams &
    Fishburn 1978); ties go to the earliest, the way people read a When2Meet grid."""
    if not slots:
        return Selection(None, "approval", "no_slots")
    order = _order(slots)
    obj = {s: float(sum(1 for a in approvals.values() if s in a)) for s in slots}
    ranking = sorted(slots, key=lambda s: (obj[s], -order[s]), reverse=True)
    return Selection(ranking[0], "approval", "ok", ranking, obj)


def random_select(slots: list[str], rng: random.Random) -> Selection:
    """B0: a uniformly random feasible slot."""
    if not slots:
        return Selection(None, "random", "no_slots")
    return Selection(rng.choice(slots), "random", "ok")


# ---------- analysis ----------

def pareto_dominator(u: Profile, pick: str, slots: list[str]) -> str | None:
    """A slot every agent likes at least as much as `pick` and someone strictly more, or None."""
    for t in slots:
        if t == pick:
            continue
        if all(row[t] >= row[pick] - _TOL for row in u.values()) and any(
            row[t] > row[pick] + _TOL for row in u.values()
        ):
            return t
    return None


def nash_welfare(u: Profile, d: dict[str, float], slot: str | None, eps: float = EPS) -> float:
    """Ground-truth Nash welfare of an outcome. No meeting (slot None) leaves everyone at d."""
    if slot is None:
        return len(u) * math.log(eps)
    return nash_objective(gains(u, d, [slot]), slot, eps)


def distance_to_oracle(u: Profile, d: dict[str, float], slot: str | None, oracle: str | None, eps: float = EPS) -> float:
    return nash_welfare(u, d, oracle, eps) - nash_welfare(u, d, slot, eps)


# ---------- more rules from the literature, for the Lab (docs/research/negotiation-layer.md) ----------

def _top(row: dict[str, float], slots: list[str], order: dict[str, int]) -> str:
    """An agent's favourite slot on its report; ties go to the earlier slot."""
    return max(slots, key=lambda s: (round(row[s], 9), -order[s]))


def plurality_select(raw: Profile, slots: list[str]) -> Selection:
    """Plurality: each agent votes for its single favourite; most votes wins, ties earliest.
    Ordinal and top-only (Handbook of Computational Social Choice, Brandt et al. 2016)."""
    if not slots:
        return Selection(None, "plurality", "no_slots")
    order = _order(slots)
    obj = {s: 0.0 for s in slots}
    for row in raw.values():
        obj[_top(row, slots, order)] += 1
    ranking = sorted(slots, key=lambda s: (obj[s], -order[s]), reverse=True)
    return Selection(ranking[0], "plurality", "ok", ranking, obj)


def copeland_select(raw: Profile, slots: list[str]) -> tuple[Selection, bool]:
    """Condorcet winner if one exists (beats every other slot in a pairwise majority vote),
    else the Copeland winner (most pairwise wins minus losses), ties earliest.
    Returns (selection, whether a Condorcet winner exists). Handbook of CompSoc 2016; the
    report cites Kemeny / Young & Levenglick for Condorcet-consistent rules."""
    if not slots:
        return Selection(None, "copeland", "no_slots"), False
    order = _order(slots)
    agents = list(raw.values())

    def beats(a: str, b: str) -> int:
        pro = sum(1 for r in agents if r[a] > r[b] + _TOL)
        con = sum(1 for r in agents if r[b] > r[a] + _TOL)
        return (pro > con) - (pro < con)

    obj = {s: float(sum(beats(s, t) for t in slots if t != s)) for s in slots}
    ranking = sorted(slots, key=lambda s: (obj[s], -order[s]), reverse=True)
    condorcet = len(slots) == 1 or obj[ranking[0]] == len(slots) - 1
    return Selection(ranking[0], "copeland", "ok", ranking, obj), condorcet


def ks_select(u: Profile, d: dict[str, float], slots: list[str]) -> Selection:
    """Kalai-Smorodinsky on a discrete set: maximize the smallest share of each agent's
    ideal gain, min_i (u_i - d_i) / (a_i - d_i), leximin ties (Kalai & Smorodinsky 1975).
    Not Pareto-optimal on every n >= 3 problem (Roth 1979)."""
    if not slots:
        return Selection(None, "ks", "no_slots")
    g = gains(u, d, slots)
    ideal = {a: max(row[s] for s in slots) for a, row in g.items()}
    share = {a: {s: (row[s] / ideal[a] if ideal[a] > _TOL else 1.0) for s in slots} for a, row in g.items()}
    order = _order(slots)
    ranking = sorted(slots, key=lambda s: (leximin_key(share, s), -order[s]), reverse=True)
    obj = {s: min(row[s] for row in share.values()) for s in slots}
    return Selection(ranking[0], "ks", "ok", ranking, obj, None, bottleneck(share, ranking[0]))


def median_select(raw: Profile, slots: list[str], minutes: dict[str, int]) -> Selection:
    """Generalized median on time of day (Moulin 1980): each agent's peak is the start time
    of its favourite slot; take the lower median of the peaks (phantoms at the window edges)
    and pick the feasible slot nearest to it, earliest on ties. Strategy-proof when
    time-of-day preferences are single-peaked; days are not part of the vote."""
    if not slots:
        return Selection(None, "median", "no_slots")
    order = _order(slots)
    peaks = sorted(minutes[_top(row, slots, order)] for row in raw.values())
    med = peaks[(len(peaks) - 1) // 2]
    obj = {s: -float(abs(minutes[s] - med)) for s in slots}
    ranking = sorted(slots, key=lambda s: (obj[s], -order[s]), reverse=True)
    return Selection(ranking[0], "median", "ok", ranking, obj)


def random_dictator_select(raw: Profile, slots: list[str], seed: str) -> tuple[Selection, str | None]:
    """Random dictatorship: draw one agent uniformly (seeded, independent of the reports) and
    take its favourite. Strategy-proof (Gibbard 1977): a report only matters when you are the
    dictator, and then lying can only lose you your favourite. Returns (selection, drawn agent)."""
    if not slots or not raw:
        return Selection(None, "random_dictator", "no_slots"), None
    who = random.Random(seed).choice(sorted(raw))
    pick = _top(raw[who], slots, _order(slots))
    return Selection(pick, "random_dictator", "ok", [pick]), who


def budget_select(raw: Profile, slots: list[str]) -> Selection:
    """Budgeted votes: the utilitarian sum over L2-normalized reports, so no one can put
    everything at 100. For one meeting this is what a quadratic-voting credit budget reduces
    to (Lalley & Weyl 2018; the report, "Normalization: what it buys you")."""
    if not slots:
        return Selection(None, "budget", "no_slots")
    sel = utilitarian_select({a: normalize({s: row[s] for s in slots}, "l2") for a, row in raw.items()}, slots)
    return Selection(sel.slot_id, "budget", sel.status, sel.ranking, sel.objective)


def vcg_select(u: Profile, slots: list[str]) -> tuple[Selection, dict[str, float]]:
    """Clarke tax (VCG pivot payments) in points: pick the utilitarian optimum on the reports;
    each agent pays the harm its presence does to the others,
    t_i = sum_{j != i} u_j(s_-i*) - sum_{j != i} u_j(s*). Truthful reporting is a dominant
    strategy when people value points like utility (Ephrati & Rosenschein 1991; Ephrati,
    Zlotkin & Rosenschein 1994). It maximizes the total, not fairness, and the tax is burned."""
    if not slots:
        return Selection(None, "vcg", "no_slots"), {}
    sel = utilitarian_select(u, slots)
    pick = sel.slot_id
    pay: dict[str, float] = {}
    for i in u:
        others = {a: row for a, row in u.items() if a != i}
        if not others:
            pay[i] = 0.0
            continue
        alt = utilitarian_select(others, slots).slot_id
        pay[i] = sum(r[alt] for r in others.values()) - sum(r[pick] for r in others.values())
    return Selection(pick, "vcg", "ok", sel.ranking, sel.objective), pay
