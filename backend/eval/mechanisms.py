"""Reports (honest and attacking) and every scheduler under test (docs/eval/preregistration.md).

All mechanisms see the same reports and the same feasible set. Ours and its ablations run
the production solver and protocol (app/scheduling/protocol.py) unchanged.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field, replace

from app.scheduling.fairness import rank_slots
from app.scheduling.normalize import normalize
from app.scheduling.protocol import AgentState, Move, Outcome, Solver, apply_move, negotiate
from app.scheduling.selector import (
    approval_select,
    borda_select,
    budget_select,
    copeland_select,
    ks_select,
    median_select,
    nash_select,
    plurality_select,
    random_dictator_select,
    random_select,
    utilitarian_select,
    vcg_select,
)
from app.scheduling.utility import Criterion, UtilityModel
from eval.instances import Instance

CONDITIONS = ("honest", "inflater", "victim", "fakehard", "stubborn", "pair")
MECHANISMS = ("B0", "B1", "B3", "B4", "B5", "Ours", "Ours-d", "Ours-oneshot", "Ours-nonorm", "Ours-maxmin",
              # Amendment 2 (docs/eval/preregistration.md)
              "Ours-L2", "Ours-range", "Ours-floor", "Ours-L2-floor",
              # Amendment 3
              "Ours-topk", "Ours-topk-median")
VARIANTS = ("Ours", "Ours-L2", "Ours-range", "Ours-floor", "Ours-L2-floor")
VARIANTS3 = ("Ours", "Ours-topk", "Ours-topk-median")  # Amendment 3
PRICED = ("B3",) + VARIANTS3
PRICE_SHARE = 0.25
BUDGETED = ("B1", "B3", "B4", "B5") + VARIANTS
FLOOR = 0.2
ATTACKED = tuple(m for m in MECHANISMS if m != "B0")
_TOL = 1e-9


@dataclass
class Report:
    uid: str
    model: UtilityModel  # the stated report the rule-based mechanisms see
    true_w: dict[str, float] = field(default_factory=dict)  # only honest agents concede, down to these
    concedes: bool = True
    approvals: set[str] = field(default_factory=set)  # B1
    scale: tuple[float, float] = (0.0, 100.0)  # B3: how this agent uses a 0-100 scale
    b3_scores: dict[str, int] | None = None  # B3: an attacker's raw scores, used as given
    d_raw: float | None = None  # Ours-d: elicited disagreement point on the report's raw scale


def vector_model(uid: str, vec: dict[str, float]) -> UtilityModel:
    """A report that is just a utility vector (raw u = vec), with nothing to concede."""
    crit = Criterion("attack:shape", "shape", "attack", 1.0, 1.0, {s: 1.0 - v for s, v in vec.items()})
    return UtilityModel(uid, (crit,))


def _quantile_raw(raw: dict[str, float], q: float) -> float:
    """A raw value with a share q of slots strictly below it."""
    vals = sorted(raw.values())
    k = round(q * len(vals))
    if k <= 0:
        return vals[0] - 1e-6
    if k >= len(vals):
        return vals[-1] + 1e-6
    return (vals[k - 1] + vals[k]) / 2


def honest_report(inst: Instance, i: int) -> Report:
    p = inst.people[i]
    rng = random.Random(f"report:{inst.n}:{inst.idx}:{p.uid}")
    crits, true_w = [], {}
    for c in p.model_true.criteria:
        stated = min(1.0, c.weight * (1 + rng.uniform(0, 0.6)))  # people overstate how firm they are
        floor = c.weight * rng.uniform(0, 1)  # and allow conceding to at or below the truth
        crits.append(replace(c, weight=stated, floor=min(stated, floor)))
        true_w[c.rule_id] = c.weight
    model = UtilityModel(p.uid, tuple(crits))
    q = sum(1 for s in inst.feasible if inst.u[p.uid][s] < inst.d[p.uid]) / len(inst.feasible)
    return Report(
        p.uid, model, true_w, True,
        approvals=set(inst.feasible) - p.soft_busy,
        scale=(rng.uniform(0, 40), rng.uniform(70, 100)),
        d_raw=_quantile_raw(model.raw(inst.feasible), q),
    )


def favourite(inst: Instance, uids: list[str]) -> str:
    return max(inst.feasible, key=lambda s: (sum(inst.u[u][s] for u in uids), -inst.feasible.index(s)))


def condition(inst: Instance, cond: str) -> tuple[list[Report], list[str], list[int]]:
    """Reports, the feasible set the mechanisms see, and the deviating agents' indices."""
    reports = [honest_report(inst, i) for i in range(inst.n)]
    slots = list(inst.feasible)
    if cond == "honest":
        return reports, slots, []
    a = reports[0]
    if cond in ("inflater", "victim"):
        fav = favourite(inst, [a.uid])
        low = 0.0 if cond == "inflater" else 0.91
        vec = {s: 1.0 if s == fav else low for s in slots}
        reports[0] = Report(a.uid, vector_model(a.uid, vec), {}, False, {fav}, a.scale,
                            {s: 100 if s == fav else (0 if cond == "inflater" else 5) for s in slots},
                            None if cond == "inflater" else 0.9)
        return reports, slots, [0]
    if cond == "fakehard":
        slots = [s for s in slots if inst.u[a.uid][s] >= 0.5]  # its soft dislikes, declared hard
        return reports, slots, [0]
    if cond == "stubborn":
        reports[0] = replace(a, concedes=False)
        return reports, slots, [0]
    if cond == "pair":
        fav = favourite(inst, [reports[0].uid, reports[1].uid])
        vec = {s: 1.0 if s == fav else 0.0 for s in slots}
        for k in (0, 1):
            r = reports[k]
            reports[k] = Report(r.uid, vector_model(r.uid, vec), {}, False, {fav}, r.scale,
                                {s: 100 if s == fav else 0 for s in slots}, None)
        return reports, slots, [0, 1]
    raise ValueError(cond)


# ---------- honest concession behaviour, shared by Ours and the old B3 loop ----------

def concede(rep: Report, model: UtilityModel, rule_id: str) -> float | None:
    """The weight an honest agent concedes this rule to, or None if it holds."""
    if not rep.concedes:
        return None
    c = model.criterion(rule_id)
    wt = rep.true_w.get(rule_id)
    if c is None or wt is None or c.weight <= wt + _TOL:
        return None
    new = max(c.floor, wt)
    return new if new < c.weight - _TOL else None


def responder(reports: list[Report]):
    by_uid = {r.uid: r for r in reports}

    def respond(state: AgentState, req, draft) -> Move:
        c = state.model.criterion(req.rule_id)
        if c is None or c.penalties.get(req.target, 0.0) <= 0:
            return Move("accept")
        new = concede(by_uid[state.user_id], state.model, req.rule_id)
        return Move("hold") if new is None else Move("flex", req.rule_id, new)

    return respond


# ---------- mechanisms ----------

@dataclass
class Result:
    pick: str | None
    rounds: int = 0
    outcome: Outcome | None = None
    payments: dict[str, float] | None = None  # VCG: points each agent pays (Clarke tax)
    extra: dict = field(default_factory=dict)  # e.g. condorcet exists, who the dictator was


def _b3_scores(rep: Report, model: UtilityModel, slots: list[str]) -> dict[str, int]:
    if rep.b3_scores is not None:
        return {s: rep.b3_scores[s] for s in slots}
    norm = normalize(model.raw(slots), "range")
    lo, hi = rep.scale
    return {s: int(round(lo + (hi - lo) * v)) for s, v in norm.items()}


def run_b3(reports: list[Report], slots: list[str], *, rounds: bool = True) -> Result:
    """The old MultiMeet rule, with its old mediator loop: up to 2 agents scoring below
    70 on each of the top 3, then top 2 slots, concede on their costliest rule there."""
    models = {r.uid: r.model for r in reports}
    scores = {r.uid: _b3_scores(r, models[r.uid], slots) for r in reports}
    ranked = rank_slots(slots, scores)
    used = 0
    if rounds and ranked[0].min_score < 75:
        for width in (3, 2):
            asked = False
            for t in ranked[:width]:
                lows = sorted((s, u) for u, s in t.scores.items() if s < 70)[:2]
                for _, uid in lows:
                    rep = next(r for r in reports if r.uid == uid)
                    worst = models[uid].worst_criterion(t.slot_id)
                    asked = True
                    if worst is None:
                        continue
                    new = concede(rep, models[uid], worst.rule_id)
                    if new is not None:
                        models[uid] = models[uid].with_weight(worst.rule_id, new)
                        scores[uid] = _b3_scores(rep, models[uid], slots)
            if not asked:
                break
            used += 1
            ranked = rank_slots(slots, scores)
            if ranked[0].min_score >= 50:
                break
    return Result(ranked[0].slot_id, used)


def run_ours(reports: list[Report], slots: list[str], *, scheme="borda", selector="nash",
             d_mode="default", mediator=True, tau=None) -> Result:
    solver = Solver(slots, scheme=scheme, selector=selector, d_mode=d_mode, tau=tau, floor_mode="prefer")
    states = [AgentState(r.uid, r.model, r.d_raw) for r in reports]
    if not mediator:
        draft = solver.solve(states)
        return Result(draft.pick, 0, extra={"objective": draft.selection.objective})
    out = negotiate(states, solver, responder(reports))
    return Result(out.final.pick, len(out.rounds), out, extra={"objective": out.final.selection.objective})


_OURS = {
    "Ours": {}, "Ours-L2": {"scheme": "l2"}, "Ours-range": {"scheme": "range"},
    "Ours-floor": {"tau": FLOOR}, "Ours-L2-floor": {"scheme": "l2", "tau": FLOOR},
    "Ours-topk": {"scheme": "topk"},
}


def run_median(inst: Instance, reports: list[Report], slots: list[str], *, oneshot: bool) -> Result:
    """Amendment 3: Ours-topk picks the day; within it, the slot nearest the median of each
    agent's best reported start time (lower median, ties earliest). Strategy-proof only on
    the time-of-day dimension, where preferences are single-peaked (Moulin 1980)."""
    from zoneinfo import ZoneInfo

    from eval.instances import MEETING_TZ

    day_res = run_ours(reports, slots, mediator=not oneshot, scheme="topk")
    if day_res.pick is None:
        return day_res
    zone = ZoneInfo(MEETING_TZ)
    local = {s: inst.slots[s].start.astimezone(zone) for s in slots}
    day = local[day_res.pick].date()
    cands = [s for s in slots if local[s].date() == day]
    minutes = {s: local[s].hour * 60 + local[s].minute for s in cands}
    peaks = []
    for r in reports:
        raw = r.model.raw(cands)
        best = max(cands, key=lambda s: (round(raw[s], 9), -minutes[s]))
        peaks.append(minutes[best])
    peaks.sort()
    med = peaks[(len(peaks) - 1) // 2]
    pick = min(cands, key=lambda s: (abs(minutes[s] - med), minutes[s]))
    return Result(pick, day_res.rounds, day_res.outcome)


def run(mech: str, inst: Instance, reports: list[Report], slots: list[str], *, oneshot: bool = False) -> Result:
    """oneshot: the mechanism without its mediator rounds (a fast proxy, used by attackers' searches)."""
    if not slots:
        return Result(None)
    if mech in _OURS:
        return run_ours(reports, slots, mediator=not oneshot, **_OURS[mech])
    if mech == "Ours-topk-median":
        return run_median(inst, reports, slots, oneshot=oneshot)
    if mech == "B3" and oneshot:
        return run_b3(reports, slots, rounds=False)
    raw = {r.uid: r.model.raw(slots) for r in reports}
    if mech == "B0":
        return Result(random_select(slots, random.Random(f"b0:{inst.n}:{inst.idx}")).slot_id)
    if mech == "B1":
        sel = approval_select({r.uid: r.approvals & set(slots) for r in reports}, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective})
    if mech == "B3":
        return run_b3(reports, slots)
    if mech == "B3-oneshot":
        return run_b3(reports, slots, rounds=False)
    if mech == "B4":
        sel = utilitarian_select({u: normalize(row, "range") for u, row in raw.items()}, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective})
    if mech == "B5":
        sel = borda_select(raw, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective})
    # More rules from the literature, for the Lab. Not part of the preregistered comparison.
    if mech in LAB_EXTRA:
        return run_extra(mech, inst, raw, slots)
    if mech == "Ours-d":
        return run_ours(reports, slots, d_mode="elicited")
    if mech == "Ours-oneshot":
        return run_ours(reports, slots, mediator=False)
    if mech == "Ours-nonorm":
        return run_ours(reports, slots, scheme="none")
    if mech == "Ours-maxmin":
        return run_ours(reports, slots, selector="leximin")
    raise ValueError(mech)


LAB_EXTRA = ("P1", "CW", "KS", "MED", "RD", "QV", "VCG")


def _minutes(inst: Instance, slots: list[str]) -> dict[str, int]:
    from zoneinfo import ZoneInfo

    from eval.instances import MEETING_TZ

    zone = ZoneInfo(MEETING_TZ)
    out = {}
    for s in slots:
        t = inst.slots[s].start.astimezone(zone)
        out[s] = t.hour * 60 + t.minute
    return out


def run_extra(mech: str, inst: Instance, raw: dict[str, dict[str, float]], slots: list[str]) -> Result:
    """Plurality, Condorcet/Copeland, Kalai-Smorodinsky, generalized median, random dictator,
    budgeted (L2) votes and the Clarke tax, all on the same reports as everything else."""
    common = {u: normalize(row, "range") for u, row in raw.items()}  # the common scale B4 uses
    order = {s: i for i, s in enumerate(slots)}
    tops = {u: max(slots, key=lambda s, row=row: (round(row[s], 9), -order[s])) for u, row in raw.items()}
    if mech == "P1":
        sel = plurality_select(raw, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective, "votes": tops})
    if mech == "CW":
        sel, condorcet = copeland_select(raw, slots)
        return Result(sel.slot_id, extra={"condorcet": condorcet, "objective": sel.objective})
    if mech == "KS":
        sel = ks_select(common, {u: 0.0 for u in common}, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective})
    if mech == "MED":
        sel = median_select(raw, slots, _minutes(inst, slots))
        return Result(sel.slot_id, extra={"objective": sel.objective, "votes": tops})
    if mech == "RD":
        sel, who = random_dictator_select(raw, slots, f"rd:{inst.n}:{inst.idx}")
        return Result(sel.slot_id, extra={"dictator": who, "votes": {who: sel.slot_id} if who else {}})
    if mech == "QV":
        sel = budget_select(raw, slots)
        return Result(sel.slot_id, extra={"objective": sel.objective})
    if mech == "VCG":
        sel, pay = vcg_select(common, slots)
        return Result(sel.slot_id, payments=pay, extra={"objective": sel.objective})
    raise ValueError(mech)


# ---------- Amendment 2: fake hard constraints under a 2-token budget ----------

def _rule_blocks(inst: Instance) -> dict[str, set[str]]:
    """Every hard rule a token can buy, in the attacker's time zone, and the slots it rules out."""
    from zoneinfo import ZoneInfo

    zone = ZoneInfo(inst.people[0].tz)
    local = {s: (inst.slots[s].start.astimezone(zone), inst.slots[s].end.astimezone(zone)) for s in inst.feasible}
    rules: dict[str, set[str]] = {}
    for d in sorted({a.weekday() for a, _ in local.values()}):
        rules[f"avoid:{d}"] = {s for s, (a, _) in local.items() if a.weekday() == d}
    for h in range(9, 18):
        rules[f"before:{h}"] = {s for s, (a, _) in local.items() if a.hour * 60 + a.minute < h * 60}
    for h in range(10, 19):
        rules[f"after:{h}"] = {s for s, (a, b) in local.items()
                               if b.date() != a.date() or b.hour * 60 + b.minute > h * 60}
    return {k: v for k, v in rules.items() if v}


def budget_attack(inst: Instance, mech: str, tokens: int = 2, max_share: float | None = None) -> tuple[Result, list[str]]:
    """The fake-hard attacker limited to `tokens` declared hard rules (Amendment 2), or to rules
    that together remove at most `max_share` of the feasible set (Amendment 3: priced claims),
    chosen greedily to maximize its true utility, scored with the mechanism's one-shot version,
    then played in full."""
    reports = [honest_report(inst, i) for i in range(inst.n)]
    a = inst.uids[0]
    rules = _rule_blocks(inst)
    chosen: list[str] = []
    removed: set[str] = set()

    def value(gone: set[str]) -> float:
        slots = [s for s in inst.feasible if s not in gone]
        if not slots:
            return float("-inf")  # declaring every slot impossible: no meeting; never chosen
        pick = run(mech, inst, reports, slots, oneshot=True).pick
        return inst.u[a][pick] if pick else inst.d[a]

    best = value(removed)
    limit = len(inst.feasible) * max_share if max_share is not None else None
    for _ in range(tokens if max_share is None else len(rules)):
        cand = None
        for name, block in rules.items():
            if name in chosen:
                continue
            if limit is not None and len(removed | block) > limit:
                continue
            v = value(removed | block)
            if v > best + 1e-12:
                best, cand = v, name
        if cand is None:
            break
        chosen.append(cand)
        removed |= rules[cand]
    slots = [s for s in inst.feasible if s not in removed]
    return run(mech, inst, reports, slots), chosen


def oracle(inst: Instance) -> str:
    return nash_select(inst.u, inst.d, inst.feasible, require_ir=False).slot_id


__all__ = ["CONDITIONS", "MECHANISMS", "ATTACKED", "Report", "Result", "condition", "run", "oracle",
           "honest_report", "vector_model", "responder", "apply_move"]
