"""Exact best response for one deviating agent on small instances (preregistration, attacker 6).

The deviator (agent 0) knows everyone else's reports and its own true utility, and picks
the report that maximizes its true utility at the outcome.

* Ours-oneshot (Nash over Borda, d = 0) and B5 (Borda): the outcome depends only on the
  deviator's weak order over the slots, so every weak order is enumerated: 545,835 for
  8 slots.
* B3-oneshot (max-min over raw 0-100), B4 (utilitarian over range-normalized) and B1
  (approval): for these rules the report "everything on target t" (100/0, 1/0, approve {t})
  simultaneously maximizes t and minimizes every competitor, so t is reachable by some
  report if and only if it wins under that one. Each t is checked.
* Ours (with the mediator) is labelled approximate: the deviator's one-shot best report is
  played through the full protocol, with the deviator never conceding.
"""

from __future__ import annotations

import itertools
import math
from functools import lru_cache

import numpy as np

from app.scheduling.normalize import normalize
from app.scheduling.selector import EPS, borda_select, leximin_key, nash_select
from eval.instances import Instance
from eval.mechanisms import Report, condition, run, run_b3, run_ours, vector_model
from eval.metrics import utilities_at


def _set_partitions(items: list[int]):
    if not items:
        yield []
        return
    first, rest = items[0], items[1:]
    for part in _set_partitions(rest):
        for i in range(len(part)):
            yield part[:i] + [[first] + part[i]] + part[i + 1:]
        yield [[first]] + part


@lru_cache(maxsize=None)
def weak_order_borda(m: int) -> np.ndarray:
    """Every weak order of m items as Borda values with ties averaged (rows x m)."""
    rows = []
    for part in _set_partitions(list(range(m))):
        for order in itertools.permutations(part):  # order[0] is the top tier
            vec = [0.0] * m
            below = m
            for tier in order:
                below -= len(tier)
                val = (below + 0.5 * (len(tier) - 1)) / (m - 1) if m > 1 else 1.0
                for x in tier:
                    vec[x] = val
            rows.append(vec)
    return np.array(rows)


def _best(inst: Instance, picks: set) -> float:
    a = inst.uids[0]
    return max(utilities_at(inst, p)[a] for p in picks)


def _ours_oneshot_reachable(inst: Instance, others: dict[str, dict[str, float]], slots: list[str]):
    """Every slot Nash-over-Borda can be made to pick by some report of agent 0, with one
    report that does it."""
    m = len(slots)
    B = weak_order_borda(m)
    A = np.array([sum(math.log(EPS + max(0.0, others[u][s])) for u in others) for s in slots])
    obj = np.round(A[None, :] + np.log(EPS + B), 9)
    best = obj.max(axis=1, keepdims=True)
    ties = (obj == best).sum(axis=1) > 1
    picks = obj.argmax(axis=1)  # first index is the earlier slot
    reach: dict[str, np.ndarray] = {}
    for row in np.where(~ties)[0]:
        s = slots[picks[row]]
        if s not in reach:
            reach[s] = B[row]
    # Tied rows: resolve exactly with the production selector (leximin, then time order).
    for row in np.where(ties)[0]:
        u = dict(others)
        u["__dev"] = {s: float(B[row][k]) for k, s in enumerate(slots)}
        s = nash_select(u, {k: 0.0 for k in u}, slots, require_ir=False).slot_id
        if s not in reach:
            reach[s] = B[row]
    return reach


def _borda_reachable(others_raw: dict[str, dict[str, float]], slots: list[str]) -> set[str]:
    m = len(slots)
    B = weak_order_borda(m)
    base = np.zeros(m)
    for row in others_raw.values():
        n = normalize({s: row[s] for s in slots}, "borda")
        base += np.array([n[s] for s in slots])
    tot = np.round(base[None, :] + B, 9)
    return {slots[k] for k in set(tot.argmax(axis=1).tolist())}  # argmax: earliest among ties


def analyse(inst: Instance) -> dict:
    reports, slots, _ = condition(inst, "honest")
    a = reports[0]
    true_a = inst.u[a.uid]
    honest = {m: run(m, inst, reports, slots).pick for m in ("Ours-oneshot", "Ours", "B3-oneshot", "B4", "B5", "B1")}
    base = {m: utilities_at(inst, p)[a.uid] for m, p in honest.items()}
    out: dict[str, float] = {}

    # Ours-oneshot: exact, by enumeration.
    others = {r.uid: normalize(r.model.raw(slots), "borda") for r in reports[1:]}
    reach = _ours_oneshot_reachable(inst, others, slots)
    best_slot = max(reach, key=lambda s: true_a[s])
    out["Ours-oneshot"] = true_a[best_slot] - base["Ours-oneshot"]

    # Ours with the mediator: approximate. The one-shot best report, played through the protocol.
    vec = {s: float(reach[best_slot][k]) for k, s in enumerate(slots)}
    dev = Report(a.uid, vector_model(a.uid, vec), {}, False)
    played = run_ours([dev] + reports[1:], slots).pick
    out["Ours (approx.)"] = max(true_a[played], base["Ours"]) - base["Ours"]

    # B5: exact, by enumeration.
    out["B5"] = _best(inst, _borda_reachable({r.uid: r.model.raw(slots) for r in reports[1:]}, slots)) - base["B5"]

    # B3-oneshot, B4, B1: exact, by the monotonicity argument, one candidate report per target.
    b3, b4, b1 = set(), set(), set()
    for t in slots:
        e = {s: 1.0 if s == t else 0.0 for s in slots}
        r = Report(a.uid, vector_model(a.uid, e), {}, False, {t}, a.scale, {s: 100 if s == t else 0 for s in slots})
        rs = [r] + reports[1:]
        b3.add(run_b3(rs, slots, rounds=False).pick)
        b4.add(run("B4", inst, rs, slots).pick)
        b1.add(run("B1", inst, rs, slots).pick)
    out["B3-oneshot"] = _best(inst, b3) - base["B3-oneshot"]
    out["B4"] = _best(inst, b4) - base["B4"]
    out["B1"] = _best(inst, b1) - base["B1"]
    return {"n": inst.n, "idx": inst.idx, "m": len(slots), "gain": out}


__all__ = ["analyse", "weak_order_borda", "leximin_key", "borda_select"]
