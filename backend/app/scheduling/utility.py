"""Utilities computed from rules, never from agent-emitted scores.

docs/research/negotiation-layer.md, "Elicitation: rules, not scores": the personal agent
translates what a person says into typed rules once, and code computes u_i(s) from them.
An agent never hands the solver a number.

A person's utility for a slot is

    u_i(s) = 1 - sum_r w_r * p_r(s)

where each criterion r is one soft rule or one movable (soft) calendar commitment,
p_r(s) in [0, 1] is how badly slot s violates it, and w_r in [0, 1] is how much it matters.
Hard rules and hard calendar blocks are not criteria: the hard-constraint filter in
availability.py removes those slots before utilities are ever computed.

Lowering a weight can only raise u_i at every slot. That is what makes a "flex" a
monotonic concession in the sense of Endriss (2006): see app/scheduling/protocol.py.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from datetime import timedelta
from zoneinfo import ZoneInfo

from app.scheduling.ics import BusyInterval
from app.scheduling.rules import WEEKDAY_NAMES, PreferenceRule, parse_hhmm
from app.scheduling.slots import Slot

# Defaults used when the person never said how strongly they feel. These are assumptions,
# not elicited values, and every place they apply is listed here.
DEFAULT_RULE_WEIGHT = 0.6  # a stated soft rule matters, but less than a busy commitment
DEFAULT_EVENT_WEIGHT = 0.7  # moving a soft commitment (gym, lunch) costs something real
DEFAULT_FLOOR_FRACTION = 0.5  # undeclared flexibility: an agent may concede to half the weight
DEFAULT_EVENT_FLOOR = 0.0  # a movable commitment (gym, lunch) may be moved outright if the person agrees
# Why the commitment floor is 0: under rank (Borda) normalization only the order of slots
# matters, so halving one criterion's weight rarely reorders anything. A concession that
# can never change the outcome is not a concession. Soft commitments are exactly the
# things people say they could move, so their declared range defaults to "all the way".
DEFAULT_TOD_WIDTH = 120  # minutes of tolerance around an ideal time of day
GRADE_MINUTES = 120  # not_before / not_after penalties reach 1 this many minutes past the limit


@dataclass(frozen=True)
class Criterion:
    """One weighted term of a person's utility."""

    rule_id: str  # stable id the protocol uses for flex(rule_id, new_weight)
    label: str  # what a person reads, e.g. "Gym" or "Nothing before 10:00"
    kind: str
    weight: float
    floor: float  # the lowest weight the person declared their agent may concede to
    penalties: dict[str, float] = field(default_factory=dict)  # slot_id -> [0, 1]


@dataclass(frozen=True)
class UtilityModel:
    user_id: str
    criteria: tuple[Criterion, ...]

    def raw(self, slot_ids: list[str]) -> dict[str, float]:
        """u_i(s) before normalization. 1 is a slot that breaks nothing; it can go below 0."""
        return {
            sid: 1.0 - sum(c.weight * c.penalties.get(sid, 0.0) for c in self.criteria) for sid in slot_ids
        }

    def criterion(self, rule_id: str) -> Criterion | None:
        return next((c for c in self.criteria if c.rule_id == rule_id), None)

    def with_weight(self, rule_id: str, weight: float) -> "UtilityModel":
        return UtilityModel(
            self.user_id,
            tuple(replace(c, weight=weight) if c.rule_id == rule_id else c for c in self.criteria),
        )

    def worst_criterion(self, slot_id: str) -> Criterion | None:
        """The rule that costs this person the most at a slot (for explanations)."""
        hits = [(c.weight * c.penalties.get(slot_id, 0.0), c) for c in self.criteria]
        hits = [h for h in hits if h[0] > 0]
        return max(hits, key=lambda h: h[0])[1] if hits else None


def _minutes(dt) -> int:
    return dt.hour * 60 + dt.minute


def _rule_penalty(rule: PreferenceRule, slot: Slot, intervals: list[BusyInterval], zone: ZoneInfo) -> float:
    start = slot.start.astimezone(zone)
    end = slot.end.astimezone(zone)
    day = start.weekday()
    scoped = rule.kind in ("not_before", "not_after") and rule.weekdays
    if scoped and day not in rule.weekdays:
        return 0.0
    if rule.kind == "not_before":
        hm = parse_hhmm(rule.time)
        if not hm:
            return 0.0
        early = hm[0] * 60 + hm[1] - _minutes(start)
        return min(1.0, max(0.0, early / GRADE_MINUTES)) if early > 0 else 0.0
    if rule.kind == "not_after":
        hm = parse_hhmm(rule.time)
        if not hm:
            return 0.0
        end_min = _minutes(end) if end.date() == start.date() else 24 * 60
        late = end_min - (hm[0] * 60 + hm[1])
        return min(1.0, max(0.0, late / GRADE_MINUTES)) if late > 0 else 0.0
    if rule.kind == "avoid_weekdays":
        return 1.0 if rule.weekdays and day in rule.weekdays else 0.0
    if rule.kind == "buffer_minutes" and rule.minutes:
        pad = timedelta(minutes=rule.minutes)
        for iv in intervals:
            overlaps = iv.start < slot.end and iv.end > slot.start
            near = iv.start < slot.end + pad and iv.end > slot.start - pad
            if near and not overlaps:
                return 1.0
        return 0.0
    if rule.kind == "time_of_day":
        hm = parse_hhmm(rule.time)
        if not hm:
            return 0.0
        width = max(15, rule.width_minutes or DEFAULT_TOD_WIDTH)
        # "Ideally around 3" means starting around 3, so distance is measured from the start.
        dist = abs(_minutes(start) - (hm[0] * 60 + hm[1]))
        return 1.0 - math.exp(-0.5 * (dist / width) ** 2)
    if rule.kind == "day_weights" and rule.day_weights and len(rule.day_weights) == 7:
        return min(1.0, max(0.0, 1.0 - float(rule.day_weights[day])))
    if rule.kind == "max_per_day" and rule.max_count is not None:
        busy = sum(1 for iv in intervals if iv.start.astimezone(zone).date() == start.date())
        return 1.0 if busy >= rule.max_count else 0.0
    return 0.0  # free_text: never shapes the pick; the mediator may only quote it


def rule_label(rule: PreferenceRule) -> str:
    if rule.summary:
        return rule.summary
    if rule.kind == "time_of_day":
        return f"Ideally around {rule.time}"
    if rule.kind == "day_weights" and rule.day_weights:
        worst = min(range(7), key=lambda d: rule.day_weights[d])
        return f"Prefers not {WEEKDAY_NAMES[worst]}"
    return rule.kind


def build_model(
    user_id: str,
    slots: dict[str, Slot],
    intervals: list[BusyInterval],
    rules: list[PreferenceRule],
    tz: str,
) -> UtilityModel:
    """Turn a person's soft rules and movable commitments into weighted criteria.

    Hard rules of the original kinds are skipped: the filter already enforced them. The
    preference-shape kinds (time_of_day, day_weights, max_per_day) are soft by nature and
    always become criteria, whatever strength the parser gave them.
    """
    zone = ZoneInfo(tz)
    criteria: list[Criterion] = []
    shape_kinds = ("time_of_day", "day_weights", "max_per_day")
    for k, rule in enumerate(rules):
        if rule.kind == "free_text":
            continue
        if rule.strength == "hard" and rule.kind not in shape_kinds:
            continue
        weight = DEFAULT_RULE_WEIGHT if rule.weight is None else float(rule.weight)
        floor = weight * DEFAULT_FLOOR_FRACTION if rule.flex_floor is None else min(weight, float(rule.flex_floor))
        penalties = {sid: _rule_penalty(rule, slot, intervals, zone) for sid, slot in slots.items()}
        criteria.append(Criterion(f"r{k}:{rule.kind}", rule_label(rule), rule.kind, weight, floor, penalties))

    by_title: dict[str, list[BusyInterval]] = {}
    for iv in intervals:
        if iv.kind == "soft":
            by_title.setdefault(iv.title, []).append(iv)
    for title, ivs in sorted(by_title.items()):
        penalties = {
            sid: 1.0 if any(iv.start < slot.end and iv.end > slot.start for iv in ivs) else 0.0
            for sid, slot in slots.items()
        }
        weight = DEFAULT_EVENT_WEIGHT
        criteria.append(Criterion(f"event:{title}", title, "event", weight, DEFAULT_EVENT_FLOOR, penalties))
    return UtilityModel(user_id, tuple(criteria))
