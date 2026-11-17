"""Metrics on ground truth, never on reports (docs/eval/preregistration.md, "Metrics")."""

from __future__ import annotations

import math

from app.scheduling.selector import EPS, pareto_dominator
from eval.instances import Instance


def utilities_at(inst: Instance, pick: str | None) -> dict[str, float]:
    """True utility per person. No meeting leaves each person at their disagreement point."""
    if pick is None:
        return dict(inst.d)
    return {u: inst.u[u][pick] for u in inst.uids}


def nash_welfare(inst: Instance, pick: str | None) -> float:
    if pick is None:
        return inst.n * math.log(EPS)
    return sum(math.log(EPS + max(0.0, inst.u[u][pick] - inst.d[u])) for u in inst.uids)


def outcome(inst: Instance, pick: str | None, nw_oracle: float) -> dict:
    u = utilities_at(inst, pick)
    gains = {k: u[k] - inst.d[k] for k in u}
    nw = nash_welfare(inst, pick)
    if pick is None:
        # No meeting is Pareto-dominated if some slot leaves everyone at least at d and someone above.
        pareto = not any(all(inst.u[k][s] >= inst.d[k] for k in u) and any(inst.u[k][s] > inst.d[k] for k in u)
                         for s in inst.feasible)
    else:
        pareto = pareto_dominator(inst.u, pick, inst.feasible) is None
    return {
        "pick": pick,
        "nw": nw,
        "ratio": math.exp((nw - nw_oracle) / inst.n),
        "dist": nw_oracle - nw,
        "util": sum(u.values()) / inst.n,
        "min": min(gains.values()),
        "prop": sum(1 for v in u.values() if v >= 1.0 / inst.n) / inst.n,
        "pareto": pareto,
        "violation": pick is not None and pick not in inst.feasible,
        "u": u,
    }
