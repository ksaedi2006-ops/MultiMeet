from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.scheduling.availability import FREE, HARD, SOFT, assess_slot
from app.scheduling.fairness import rank_slots
from app.scheduling.ics import BusyInterval, CalendarParseError, parse_ics
from app.scheduling.rules import PreferenceRule
from app.scheduling.slots import generate_slots

NY = "America/New_York"
UTC = timezone.utc


# ---------- slots ----------

def test_slots_are_clock_aligned_in_local_time():
    slots = generate_slots(start_date=date(2026, 3, 2), end_date=date(2026, 3, 2), tz=NY, duration_minutes=60)
    local = [s.start.astimezone(ZoneInfo(NY)) for s in slots]
    assert local[0].hour == 9 and local[0].minute == 0
    assert local[-1].hour == 20  # 8pm start ends at 9pm latest
    assert all(t.minute == 0 and t.second == 0 for t in local)


def test_slots_cover_whole_range_by_widening_step():
    slots = generate_slots(start_date=date(2026, 3, 2), end_date=date(2026, 3, 15), tz=NY, duration_minutes=60)
    assert len(slots) <= 72
    days = {s.start.astimezone(ZoneInfo(NY)).date() for s in slots}
    assert date(2026, 3, 15) in days and date(2026, 3, 2) in days


def test_slots_respect_weekdays_and_not_before():
    cutoff = datetime(2026, 3, 2, 18, 0, tzinfo=UTC)  # 1pm in New York
    slots = generate_slots(
        start_date=date(2026, 3, 2), end_date=date(2026, 3, 8), tz=NY, duration_minutes=60,
        weekdays=frozenset({0, 1}), not_before=cutoff,
    )
    assert all(s.start >= cutoff for s in slots)
    assert {s.start.astimezone(ZoneInfo(NY)).weekday() for s in slots} <= {0, 1}


def test_slots_across_dst_change_stay_on_local_clock():
    # US DST starts Sunday 2026-03-08.
    slots = generate_slots(start_date=date(2026, 3, 7), end_date=date(2026, 3, 9), tz=NY, duration_minutes=60)
    firsts = {}
    for s in slots:
        local = s.start.astimezone(ZoneInfo(NY))
        firsts.setdefault(local.date(), local.hour)
    assert set(firsts.values()) == {9}
    assert len({s.id for s in slots}) == len(slots)


# ---------- ics ----------

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:lecture
SUMMARY:CS 301 Lecture
DTSTART;TZID=America/New_York:20260302T090000
DTEND;TZID=America/New_York:20260302T103000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6
EXDATE;TZID=America/New_York:20260304T090000
END:VEVENT
BEGIN:VEVENT
UID:gym
SUMMARY:Gym
DTSTART:20260303T220000Z
DTEND:20260303T230000Z
END:VEVENT
BEGIN:VEVENT
UID:bday
SUMMARY:Sam's birthday
DTSTART;VALUE=DATE:20260305
DTEND;VALUE=DATE:20260306
END:VEVENT
BEGIN:VEVENT
UID:trip
SUMMARY:Vacation
DTSTART;VALUE=DATE:20260306
DTEND;VALUE=DATE:20260307
END:VEVENT
BEGIN:VEVENT
UID:cancelled
SUMMARY:Dropped seminar
STATUS:CANCELLED
DTSTART:20260302T180000Z
DTEND:20260302T190000Z
END:VEVENT
BEGIN:VEVENT
UID:free
SUMMARY:Office hours (optional)
TRANSP:TRANSPARENT
DTSTART:20260302T190000Z
DTEND:20260302T200000Z
END:VEVENT
END:VCALENDAR
"""


def parse_window():
    return parse_ics(
        ICS,
        window_start=datetime(2026, 3, 1, tzinfo=UTC),
        window_end=datetime(2026, 3, 15, tzinfo=UTC),
        default_tz=NY,
    )


def test_ics_expands_recurrence_and_honours_exdate():
    lectures = [i for i in parse_window() if i.title == "CS 301 Lecture"]
    # Mon 2, (Wed 4 excluded), Mon 9, Wed 11 inside the window
    assert [i.start.astimezone(ZoneInfo(NY)).day for i in lectures] == [2, 9, 11]
    assert lectures[0].start == datetime(2026, 3, 2, 14, 0, tzinfo=UTC)  # 9am EST
    assert lectures[1].start == datetime(2026, 3, 9, 13, 0, tzinfo=UTC)  # 9am EDT
    assert all(i.kind == "hard" for i in lectures)


def test_ics_classifies_and_filters():
    by_title = {i.title: i for i in parse_window()}
    assert by_title["Gym"].kind == "soft"
    assert by_title["Sam's birthday"].kind == "soft" and by_title["Sam's birthday"].all_day
    assert by_title["Vacation"].kind == "hard"
    assert "Dropped seminar" not in by_title
    assert "Office hours (optional)" not in by_title


def test_ics_rejects_garbage():
    with pytest.raises(CalendarParseError):
        parse_ics("not a calendar", window_start=datetime(2026, 1, 1, tzinfo=UTC),
                  window_end=datetime(2026, 2, 1, tzinfo=UTC), default_tz=NY)


# ---------- availability ----------

def one_slot(local_hour: int, day: int = 2):
    start = datetime(2026, 3, day, local_hour, tzinfo=ZoneInfo(NY)).astimezone(UTC)
    from app.scheduling.slots import Slot
    return Slot("x", start, start + timedelta(hours=1), "label")


def test_calendar_hard_block_wins():
    a = assess_slot(one_slot(9), parse_window(), [], NY)
    assert a.status == HARD and a.blocker == "CS 301 Lecture"


def test_soft_calendar_event_is_soft_conflict():
    a = assess_slot(one_slot(17, day=3), parse_window(), [], NY)
    assert a.status == SOFT and a.conflicts[0].reason == "Gym"


def test_rules_enforced_in_code():
    rules = [
        PreferenceRule(kind="not_before", strength="hard", time="11:00", summary="Nothing before 11:00"),
        PreferenceRule(kind="avoid_weekdays", strength="soft", weekdays=[4], summary="Avoid Fridays"),
        PreferenceRule(kind="buffer_minutes", strength="soft", minutes=45, summary="45 min buffer"),
    ]
    assert assess_slot(one_slot(10, day=3), [], rules, NY).status == HARD
    assert assess_slot(one_slot(13, day=6), [], rules, NY).status == SOFT  # Friday
    assert assess_slot(one_slot(13, day=3), [], rules, NY).status == FREE
    # Lecture ends 10:30 on Mon 2, so an 11:00 start is only 30 minutes after it.
    buffered = assess_slot(one_slot(11), parse_window(), rules, NY)
    assert buffered.status == SOFT and "next to CS 301 Lecture" in buffered.conflicts[0].reason


# ---------- fairness ----------

def test_rank_prefers_best_worst_off_then_average():
    scores = {
        "a": {"s1": 100, "s2": 60, "s3": 70},
        "b": {"s1": 10, "s2": 60, "s3": 70},
        "c": {"s1": 100, "s2": 90, "s3": 70},
    }
    ranked = rank_slots(["s1", "s2", "s3"], scores)
    # Worst-off person: s3 = 70, s2 = 60, s1 = 10, even though s1 has the highest peak.
    assert [r.slot_id for r in ranked] == ["s3", "s2", "s1"]
    assert ranked[-1].unhappy == ["b"]
    assert ranked[0].everyone_comfortable


def test_rank_missing_scores_count_as_zero():
    ranked = rank_slots(["s1", "s2"], {"a": {"s1": 80, "s2": 80}, "b": {"s1": 80}})
    assert ranked[0].slot_id == "s1" and ranked[1].min_score == 0
