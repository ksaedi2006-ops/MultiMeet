from dataclasses import dataclass, field
from datetime import timedelta
from zoneinfo import ZoneInfo

from app.scheduling.ics import BusyInterval
from app.scheduling.rules import PreferenceRule, parse_hhmm
from app.scheduling.slots import Slot

FREE, SOFT, HARD = "free", "soft_conflict", "hard_conflict"


@dataclass(frozen=True)
class Conflict:
    severity: str  # "hard" | "soft"
    reason: str  # what to show a human, e.g. "CS 301 Lecture" or "Rule: nothing before 11:00"
    source: str  # "calendar" | "rule"


@dataclass
class Assessment:
    status: str = FREE
    conflicts: list[Conflict] = field(default_factory=list)

    @property
    def blocker(self) -> str | None:
        hard = [c for c in self.conflicts if c.severity == "hard"]
        return hard[0].reason if hard else None

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "conflicts": [c.__dict__ for c in self.conflicts],
        }


def assess_slot(slot: Slot, intervals: list[BusyInterval], rules: list[PreferenceRule], tz: str) -> Assessment:
    """Decide in code whether a person can make a slot. Hard conflicts are final."""
    zone = ZoneInfo(tz)
    conflicts: list[Conflict] = []

    for iv in intervals:
        if iv.start < slot.end and iv.end > slot.start:
            conflicts.append(Conflict(iv.kind, iv.title, "calendar"))

    local_start = slot.start.astimezone(zone)
    local_end = slot.end.astimezone(zone)
    for rule in rules:
        day_scoped = rule.kind in ("not_before", "not_after") and rule.weekdays
        if day_scoped and local_start.weekday() not in rule.weekdays:
            continue
        if rule.kind == "not_before":
            hm = parse_hhmm(rule.time)
            if hm and (local_start.hour, local_start.minute) < hm:
                conflicts.append(Conflict(rule.strength, f"Rule: {rule.summary}", "rule"))
        elif rule.kind == "not_after":
            hm = parse_hhmm(rule.time)
            end_hm = (local_end.hour, local_end.minute) if local_end.date() == local_start.date() else (24, 0)
            if hm and end_hm > hm:
                conflicts.append(Conflict(rule.strength, f"Rule: {rule.summary}", "rule"))
        elif rule.kind == "avoid_weekdays" and rule.weekdays:
            if local_start.weekday() in rule.weekdays:
                conflicts.append(Conflict(rule.strength, f"Rule: {rule.summary}", "rule"))
        elif rule.kind == "buffer_minutes" and rule.minutes:
            pad = timedelta(minutes=rule.minutes)
            for iv in intervals:
                overlaps = iv.start < slot.end and iv.end > slot.start
                near = iv.start < slot.end + pad and iv.end > slot.start - pad
                if near and not overlaps:
                    conflicts.append(
                        Conflict(rule.strength, f"Rule: {rule.summary} (next to {iv.title})", "rule")
                    )
                    break

    if any(c.severity == "hard" for c in conflicts):
        status = HARD
    elif conflicts:
        status = SOFT
    else:
        status = FREE
    return Assessment(status, conflicts)
