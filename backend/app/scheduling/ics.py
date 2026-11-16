import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

# Titles that usually describe something a person could move. Everything else is
# treated as a hard commitment; the user can flip any event either way.
SOFT_PATTERN = re.compile(
    r"\b(gym|workout|lift|yoga|pilates|run|running|jog|swim|climb|practice|"
    r"lunch|coffee|dinner|brunch|hangout|hang out|social|walk|errand|tentative|optional|maybe|hold)\b",
    re.IGNORECASE,
)


class CalendarParseError(ValueError):
    pass


@dataclass(frozen=True)
class BusyInterval:
    start: datetime  # UTC
    end: datetime  # UTC
    title: str
    kind: str  # "hard" | "soft"
    all_day: bool = False

    def to_dict(self) -> dict:
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "title": self.title,
            "kind": self.kind,
            "all_day": self.all_day,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "BusyInterval":
        return cls(
            start=datetime.fromisoformat(d["start"]),
            end=datetime.fromisoformat(d["end"]),
            title=d.get("title", "Busy"),
            kind=d.get("kind", "hard"),
            all_day=d.get("all_day", False),
        )


# All-day entries are mostly informational (birthdays, reminders) unless they say
# the person is away.
AWAY_PATTERN = re.compile(
    r"\b(ooo|out of office|vacation|travel|trip|away|holiday|conference|exam|leave)\b", re.IGNORECASE
)


def classify_title(title: str, tentative: bool = False, all_day: bool = False) -> str:
    if all_day:
        return "hard" if AWAY_PATTERN.search(title or "") else "soft"
    return "soft" if tentative or SOFT_PATTERN.search(title or "") else "hard"


def parse_ics(text: str, *, window_start: datetime, window_end: datetime, default_tz: str) -> list[BusyInterval]:
    """Expand an .ics export into UTC busy intervals within the window.

    Handles repeating events (RRULE/RDATE/EXDATE), TZID and floating times, all-day
    events, and skips cancelled events and events marked as free (TRANSP:TRANSPARENT).
    """
    try:
        cal = icalendar.Calendar.from_ical(text)
    except Exception as exc:  # icalendar raises several types for malformed input
        raise CalendarParseError("That file isn't a readable .ics calendar.") from exc

    zone = ZoneInfo(default_tz)
    try:
        occurrences = recurring_ical_events.of(cal).between(window_start, window_end)
    except Exception as exc:
        raise CalendarParseError("The calendar has a repeating event that couldn't be expanded.") from exc

    intervals: list[BusyInterval] = []
    for ev in occurrences:
        if ev.name != "VEVENT":
            continue
        status = str(ev.get("STATUS", "")).upper()
        if status == "CANCELLED" or str(ev.get("TRANSP", "")).upper() == "TRANSPARENT":
            continue
        start_raw = ev.get("DTSTART")
        if start_raw is None:
            continue
        start_val = start_raw.dt
        end_raw = ev.get("DTEND")
        end_val = end_raw.dt if end_raw is not None else None
        title = str(ev.get("SUMMARY", "")).strip() or "Busy"

        all_day = isinstance(start_val, date) and not isinstance(start_val, datetime)
        if all_day:
            start = datetime.combine(start_val, time(0), tzinfo=zone)
            end_date = end_val if end_val is not None else start_val + timedelta(days=1)
            end = datetime.combine(end_date, time(0), tzinfo=zone)
        else:
            start = _aware(start_val, zone)
            if end_val is not None:
                end = _aware(end_val, zone)
            elif ev.get("DURATION") is not None:
                end = start + ev.get("DURATION").dt
            else:
                end = start + timedelta(minutes=30)
        if end <= start:
            continue

        intervals.append(
            BusyInterval(
                start=start.astimezone(timezone.utc),
                end=end.astimezone(timezone.utc),
                title=title,
                kind=classify_title(title, tentative=status == "TENTATIVE", all_day=all_day),
                all_day=all_day,
            )
        )
    intervals.sort(key=lambda i: i.start)
    return intervals


def _aware(value: datetime, zone: ZoneInfo) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=zone)
