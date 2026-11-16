"""Put every person's utilities on a common [0, 1] scale before they are compared.

docs/research/negotiation-layer.md, "Normalization: what it buys you":

| scheme   | stops                               | does not stop                          |
|----------|-------------------------------------|----------------------------------------|
| range    | uniform inflation (all 90-100)      | extreme shapes (100 / 0 / 0 / 0)       |
| unit_sum | claiming more total intensity       | concentrating all mass on one slot     |
| borda    | intensity claims entirely           | burying a rival's favourite            |
| l2       | extreme concentration (convex cost) | coordinated lying, misreported shape   |

The default is Borda with ties averaged: each slot scores the share of other slots it
beats, so an agent can rank but cannot shout. "none" exists for the ablation.

Every scheme returns a function as well as the mapped values, so the same map can be
applied to a person's disagreement point d_i (which is not itself a slot).
"""

from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from typing import Callable, Literal

Scheme = Literal["borda", "range", "unit_sum", "l2", "none"]
SCHEMES: tuple[Scheme, ...] = ("borda", "range", "unit_sum", "l2", "none")
_ROUND = 9  # values closer than 1e-9 count as ties


def _range_map(values: list[float]) -> Callable[[float], float]:
    lo, hi = min(values), max(values)
    if hi - lo < 10 ** -_ROUND:
        return lambda x: 1.0 if x >= lo - 10 ** -_ROUND else 0.0
    return lambda x: min(1.0, max(0.0, (x - lo) / (hi - lo)))


def normalizer(raw: dict[str, float], scheme: Scheme = "borda") -> Callable[[float], float]:
    """A map from this person's raw utility values to the common scale."""
    values = [round(v, _ROUND) for v in raw.values()]
    if not values:
        return lambda x: x
    m = len(values)
    if scheme == "none":
        return lambda x: x
    if scheme == "range":
        return _range_map(values)
    if scheme == "borda":
        if m == 1:
            return lambda x: 1.0 if round(x, _ROUND) >= values[0] else 0.0

        ordered = sorted(values)

        def borda(x: float) -> float:
            x = round(x, _ROUND)
            below = bisect_left(ordered, x)
            equal = bisect_right(ordered, x) - below
            if equal:  # x is one of the slots: ties share the rank, itself excluded
                return (below + 0.5 * (equal - 1)) / (m - 1)
            return below / (m - 1)

        return borda
    rng = _range_map(values)
    scaled = [rng(v) for v in values]
    if scheme == "unit_sum":
        total = sum(scaled)
        if total <= 0:
            return lambda x: 0.5
        k = (m / 2) / total  # a profile spread evenly over [0, 1] keeps its values
        return lambda x: min(1.0, max(0.0, rng(x) * k))
    if scheme == "l2":
        sq = sum(v * v for v in scaled)
        if sq <= 0:
            return lambda x: 0.5
        k = math.sqrt((m / 3) / sq)  # budget = the L2 mass of a profile uniform on [0, 1]
        return lambda x: min(1.0, max(0.0, rng(x) * k))
    raise ValueError(f"unknown normalization {scheme!r}")


def normalize(raw: dict[str, float], scheme: Scheme = "borda") -> dict[str, float]:
    f = normalizer(raw, scheme)
    return {sid: f(v) for sid, v in raw.items()}
