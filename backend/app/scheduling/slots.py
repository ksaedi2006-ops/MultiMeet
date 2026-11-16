from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

MAX_SLOTS = 72
STEP_CHOICES = (30, 60, 90, 120, 180, 240)


@dataclass(frozen=True)
class Slot:
    """A candidate meeting time. Times are UTC; `local_label` is for humans and prompts."""

    id: str
    start: datetime
    end: datetime
    local_label: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "label": self.local_label,
        }


def generate_slots(
    *,
    start_date: date,
    end_date: date,
    tz: str,
    duration_minutes: int,
    earliest_hour: int = 9,
    latest_hour: int = 21,
    weekdays: frozenset[int] | None = None,
    not_before: datetime | None = None,
    max_slots: int = MAX_SLOTS,
) -> list[Slot]:
    """Candidate start times aligned to the clock in the event's time zone.

    A slot qualifies if it starts at or after `earliest_hour` and ends by `latest_hour`
    local time, on an allowed weekday (0=Mon). The step between starts grows until the
    whole date range fits in `max_slots`, so a long range is covered sparsely rather
    than truncated.
    """
    zone = ZoneInfo(tz)
    if weekdays is None:
        weekdays = frozenset(range(7))
    for step in STEP_CHOICES:
        if step < min(duration_minutes, 60) and step != STEP_CHOICES[-1]:
            continue
        slots = _slots_with_step(
            zone, start_date, end_date, duration_minutes, earliest_hour, latest_hour, weekdays, not_before, step
        )
        if len(slots) <= max_slots:
            return slots
    return slots[:max_slots]


def _slots_with_step(zone, start_date, end_date, duration, earliest, latest, weekdays, not_before, step):
    slots: list[Slot] = []
    day = start_date
    while day <= end_date:
        if day.weekday() in weekdays:
            local = datetime.combine(day, time(earliest), tzinfo=zone)
            day_end = datetime.combine(day, time(0), tzinfo=zone) + timedelta(hours=latest)
            while local + timedelta(minutes=duration) <= day_end:
                # Round-trip through UTC so DST gaps resolve to a real instant.
                start_utc = local.astimezone(timezone.utc)
                normalized = start_utc.astimezone(zone)
                if normalized.hour >= earliest and (not_before is None or start_utc >= not_before):
                    slots.append(
                        Slot(
                            id=start_utc.strftime("%Y%m%dT%H%MZ"),
                            start=start_utc,
                            end=start_utc + timedelta(minutes=duration),
                            local_label=normalized.strftime("%a %b %-d, %-I:%M %p"),
                        )
                    )
                local += timedelta(minutes=step)
        day += timedelta(days=1)
    # DST can produce duplicate instants; keep the first.
    seen, unique = set(), []
    for s in slots:
        if s.id not in seen:
            seen.add(s.id)
            unique.append(s)
    return unique
