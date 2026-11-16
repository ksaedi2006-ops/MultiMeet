"""Synthetic scheduling instances with hidden ground truth (docs/eval/preregistration.md).

People come from app/sample.py (courses, labs, jobs, gym, clubs, lunch, and what they
told their agent). Calendars are then pushed to a target density with DiMES-style random
busy blocks (Maheswaran et al. 2004). Each person gets hidden true weights and a hidden
disagreement point; true utility is the production utility model at those weights,
range-normalized over the true feasible set.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field, replace
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from app.sample import FIRST, LAST, Item, _try_add, expand, make_person
from app.scheduling.availability import HARD, assess_slot
from app.scheduling.ics import BusyInterval
from app.scheduling.normalize import normalize
from app.scheduling.rules import PreferenceRule
from app.scheduling.slots import Slot, generate_slots
from app.scheduling.utility import UtilityModel, build_model

BASE_SEED = 20261116
MEETING_TZ = "America/New_York"
US_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"]
FIRST_MONDAY = date(2026, 12, 7)
DENSITIES = (0.3, 0.5, 0.7)
FILLER = ["Errand", "Appointment", "Study block", "Team meeting", "Office hours", "Call"]
MAX_REDRAWS = 40
HARD_SHARE = 0.4


@dataclass
class TruePerson:
    uid: str
    name: str
    tz: str
    intervals: list[BusyInterval]
    rules: list[PreferenceRule]
    phrases: list[tuple[PreferenceRule, str]]  # (true rule, what they said) for the translation check
    model_true: UtilityModel  # true weights
    d: float  # true disagreement point on the [0, 1] truth scale
    soft_busy: set[str] = field(default_factory=set)  # feasible slots overlapping a movable commitment


@dataclass
class Instance:
    idx: int
    n: int
    density: float
    multi_tz: bool
    slots: dict[str, Slot]
    feasible: list[str]  # hard-feasible for the true reports, in time order
    people: list[TruePerson]
    u: dict[str, dict[str, float]]  # ground truth, range-normalized over `feasible`
    d: dict[str, float]
    redraws: int = 0

    @property
    def uids(self) -> list[str]:
        return [p.uid for p in self.people]


def _density(intervals: list[BusyInterval], slots: list[Slot]) -> float:
    if not slots:
        return 0.0
    busy = sum(1 for s in slots if any(iv.start < s.end and iv.end > s.start for iv in intervals))
    return busy / len(slots)


def _fit_density(rng: random.Random, person, tz: str, start: date, end: date, slots: list[Slot], target: float):
    """Drop the person's own items, or add random busy blocks, until density is near target."""
    for _ in range(80):
        dens = _density(expand(person, tz, start, end), slots)
        if dens > target + 0.1 and person.items:
            person.items.remove(rng.choice(person.items))
        elif dens < target - 0.1:
            days = tuple(sorted(rng.sample(range(5), rng.randint(1, 3))))
            begin = rng.randrange(8 * 60, 17 * 60, 30)
            dur = rng.choice([30, 60, 90, 120])
            kind = "hard" if rng.random() < 0.4 else "soft"
            _try_add(person, Item(rng.choice(FILLER), days, begin, dur, kind))
        else:
            break
    # Amendment 1 (docs/eval/preregistration.md): hold each person's busy time at 40% hard,
    # the same share as the random blocks, by reclassifying hard items as movable. This is
    # what app/sample.py's own crowd-thinning does when calendars are too full.
    for _ in range(40):
        ivs = expand(person, tz, start, end)
        busy = [s for s in slots if any(iv.start < s.end and iv.end > s.start for iv in ivs)]
        hard = [s for s in busy if any(iv.kind == "hard" and iv.start < s.end and iv.end > s.start for iv in ivs)]
        hard_items = [i for i in person.items if i.kind == "hard"]
        if not busy or len(hard) <= HARD_SHARE * len(busy) or not hard_items:
            break
        item = rng.choice(hard_items)
        person.items[person.items.index(item)] = replace(item, kind="soft")
    return expand(person, tz, start, end)


def _draw(rng: random.Random, idx: int, n: int, density: float, multi_tz: bool,
          days: int | None = None, window: tuple[int, int] | None = None) -> Instance | None:
    days = days or rng.randint(1, 5)
    earliest, latest = window or (8, 18)
    start = FIRST_MONDAY
    end = start + timedelta(days=days - 1)
    slot_list = generate_slots(start_date=start, end_date=end, tz=MEETING_TZ, duration_minutes=30,
                               earliest_hour=earliest, latest_hour=latest, weekdays=frozenset(range(5)))
    zones = rng.sample(US_ZONES, rng.randint(2, 3)) if multi_tz else [MEETING_TZ]

    people: list[TruePerson] = []
    names: set[str] = set()
    for k in range(n):
        while True:
            name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
            if name not in names:
                names.add(name)
                break
        tz = zones[k % len(zones)]
        person = make_person(rng, name)
        local_slots = slot_list  # slots are absolute instants; density is measured on them
        intervals = _fit_density(rng, person, tz, start, end, local_slots, density)
        rules = [r for r, _ in person.rules]
        people.append(TruePerson(f"p{k}", name, tz, intervals, rules, list(person.rules), None, 0.0))  # type: ignore[arg-type]

    feasible = [
        s.id for s in slot_list
        if all(assess_slot(s, p.intervals, p.rules, p.tz).status != HARD for p in people)
    ]
    if len(feasible) < 2:
        return None
    fslots = {sid: next(s for s in slot_list if s.id == sid) for sid in feasible}
    u: dict[str, dict[str, float]] = {}
    d: dict[str, float] = {}
    for p in people:
        stated = build_model(p.uid, fslots, p.intervals, p.rules, p.tz)
        true = UtilityModel(p.uid, tuple(replace(c, weight=rng.uniform(0.3, 1.0)) for c in stated.criteria))
        p.model_true = true
        p.d = rng.uniform(0.0, 0.3)
        p.soft_busy = {sid for sid, s in fslots.items()
                       if any(iv.kind == "soft" and iv.start < s.end and iv.end > s.start for iv in p.intervals)}
        u[p.uid] = normalize(true.raw(feasible), "range")
        d[p.uid] = p.d
    return Instance(idx, n, density, multi_tz, fslots, feasible, people, u, d)


def make_instance(idx: int, n: int, *, seed: int = BASE_SEED) -> Instance | None:
    """Instance idx for group size n, per the preregistration. None if it could not be made feasible."""
    density = DENSITIES[idx % 3]
    multi_tz = idx % 9 in (0, 4, 8)
    for redraw in range(MAX_REDRAWS):
        rng = random.Random(f"{seed}:{n}:{idx}:{redraw}")
        inst = _draw(rng, idx, n, density, multi_tz)
        if inst is not None:
            inst.redraws = redraw
            return inst
    return None


def make_small_instance(idx: int, n: int, *, seed: int = BASE_SEED) -> Instance | None:
    """A small instance (one day, a 4-hour window, at most 8 thirty-minute slots) for the
    exact best-response analysis."""
    for redraw in range(MAX_REDRAWS):
        rng = random.Random(f"{seed}:small:{n}:{idx}:{redraw}")
        earliest = rng.choice([9, 10, 11, 12, 13])
        inst = _draw(rng, idx, n, (0.3, 0.5)[idx % 2], False, days=1, window=(earliest, earliest + 4))
        if inst is not None and len(inst.feasible) <= 8:
            inst.redraws = redraw
            return inst
    return None


def local_hour(slot: Slot, tz: str) -> int:
    return slot.start.astimezone(ZoneInfo(tz)).hour
