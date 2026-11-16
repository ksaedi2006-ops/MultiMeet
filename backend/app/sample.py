"""A crowd of fake but plausible students, for demos and for watching a big negotiation.

Each person gets a randomized week built from real-world patterns (MWF and TTh course
blocks, labs, shifts, gym, club commitments, a chronotype) and a few things "told" to
their agent. Nothing here calls an LLM. After generation the crowd is thinned until
enough times stay open for a negotiation to be interesting rather than hopeless.
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.members import announce_member
from app.scheduling.availability import HARD, assess_slot
from app.scheduling.ics import BusyInterval, classify_title
from app.scheduling.rules import PreferenceRule

log = logging.getLogger(__name__)

FIRST = [
    "Aiden", "Amara", "Anya", "Beck", "Bianca", "Caleb", "Camila", "Dev", "Dani", "Elena", "Eli", "Farah",
    "Finn", "Gabi", "Hana", "Hugo", "Imani", "Isaac", "Jade", "Jonah", "Kai", "Kiara", "Leo", "Lucia",
    "Mateo", "Maya", "Nadia", "Noah", "Omar", "Priya", "Quinn", "Rafa", "Reese", "Sana", "Sofia", "Theo",
    "Uma", "Vik", "Wren", "Xavier", "Yara", "Zane", "Ines", "Jun", "Kofi", "Lena", "Malik", "Nora",
    "Owen", "Petra", "Rohan", "Sienna", "Tariq", "Vera", "Wes", "Zoe", "Arjun", "Bea", "Cyrus", "Dara",
]
LAST = [
    "Park", "Okafor", "Silva", "Nguyen", "Haddad", "Kowalski", "Bianchi", "Mehta", "Reyes", "Lindqvist",
    "Abara", "Tanaka", "Moreau", "Castillo", "Fischer", "Osei", "Varga", "Iyer", "Brennan", "Sato",
    "Delgado", "Novak", "Rahman", "Costa", "Hughes", "Yilmaz", "Adeyemi", "Larsen", "Ortiz", "Chen",
]

COURSES = [
    "CS 201 Data Structures", "CS 301 Algorithms", "MATH 221 Linear Algebra", "STAT 240 Probability",
    "BIO 110 Cell Biology", "CHEM 131 General Chemistry", "PHYS 151 Mechanics", "ECON 101 Microeconomics",
    "ENG 220 Modern Fiction", "HIST 150 World History", "PSYC 100 Intro Psychology", "ART 130 Studio Drawing",
    "MUS 105 Music Theory", "PHIL 210 Ethics", "POLI 120 Comparative Politics", "ENGR 100 Design Studio",
]
JOBS = ["Library desk shift", "Dining hall shift", "Campus bookstore shift", "Lab assistant shift", "Tutoring center shift"]
GYM = ["Gym", "Climbing gym", "Yoga class", "Pool laps", "Pickup basketball"]
CLUBS_HARD = ["Orchestra rehearsal", "Debate team practice", "Robotics build night", "Choir rehearsal", "Lab group meeting"]
CLUBS_SOFT = ["Intramural soccer", "Study group", "Coffee with friends", "Open mic night"]

MWF_STARTS = [8, 9, 10, 11, 12, 13, 14, 15]  # 50 minutes
TTH_STARTS = [8 * 60, 9 * 60 + 30, 11 * 60, 12 * 60 + 30, 14 * 60, 15 * 60 + 30]  # 75 minutes


@dataclass
class Item:
    title: str
    weekdays: tuple[int, ...]
    start_min: int
    duration: int
    kind: str  # hard | soft
    droppable_weight: float = 1.0


@dataclass
class Person:
    name: str
    items: list[Item] = field(default_factory=list)
    rules: list[tuple[PreferenceRule, str]] = field(default_factory=list)  # (rule, what they said)


def _overlaps(a: Item, b: Item) -> bool:
    if not set(a.weekdays) & set(b.weekdays):
        return False
    return a.start_min < b.start_min + b.duration and b.start_min < a.start_min + a.duration


def _try_add(person: Person, item: Item) -> bool:
    if any(_overlaps(item, other) for other in person.items):
        return False
    person.items.append(item)
    return True


def make_person(rng: random.Random, name: str) -> Person:
    p = Person(name)

    # Courses: 3-5, a mix of MWF and TTh blocks.
    for title in rng.sample(COURSES, rng.randint(3, 5)):
        if rng.random() < 0.5:
            start = rng.choice(MWF_STARTS) * 60
            _try_add(p, Item(title + " Lecture", (0, 2, 4), start, 50, "hard"))
        else:
            start = rng.choice(TTH_STARTS)
            _try_add(p, Item(title + " Lecture", (1, 3), start, 75, "hard"))
        if rng.random() < 0.3:  # a weekly lab or discussion
            day = rng.choice((0, 1, 2, 3, 4))
            _try_add(p, Item(title.split()[0] + " Lab", (day,), rng.choice([13, 14, 15]) * 60, 170, "hard"))

    if rng.random() < 0.35:  # a campus job
        days = tuple(sorted(rng.sample((0, 1, 2, 3, 4), rng.randint(2, 3))))
        start = rng.choice([12, 15, 16, 17]) * 60
        _try_add(p, Item(rng.choice(JOBS), days, start, rng.choice([180, 240, 300]), "hard"))

    if rng.random() < 0.55:  # fitness, movable
        days = tuple(sorted(rng.sample((0, 1, 2, 3, 4), rng.randint(2, 4))))
        start = rng.choice([7, 12, 16, 17, 18]) * 60 + rng.choice([0, 30])
        _try_add(p, Item(rng.choice(GYM), days, start, 60, "soft"))

    if rng.random() < 0.4:  # a standing club or team commitment
        title = rng.choice(CLUBS_HARD + CLUBS_SOFT)
        kind = classify_title(title)
        kind = "hard" if title in CLUBS_HARD else "soft"
        _try_add(p, Item(title, (rng.choice((0, 1, 2, 3)),), rng.choice([18, 19]) * 60, 120, kind))

    if rng.random() < 0.6:  # lunch, which people will move for a good reason
        _try_add(p, Item("Lunch", (0, 1, 2, 3, 4), 12 * 60 + rng.choice([0, 30]), 45, "soft"))

    # What they tell their agent.
    roll = rng.random()
    if roll < 0.22:
        t = rng.choice(["10:00", "11:00", "12:00"])
        p.rules.append((PreferenceRule(kind="not_before", strength=rng.choice(["soft", "hard"]), time=t,
                                       summary=f"Nothing before {t}"), f"I'm useless before {t[:2].lstrip('0')}"))
    elif roll < 0.40:
        t = rng.choice(["17:00", "18:00", "19:00"])
        p.rules.append((PreferenceRule(kind="not_after", strength=rng.choice(["soft", "hard"]), time=t,
                                       summary=f"Done by {t}"), f"I'd rather be done by {int(t[:2]) - 12}pm"))
    if rng.random() < 0.30:
        day = rng.choice((0, 4))
        name_day = ["Mon", "Tue", "Wed", "Thu", "Fri"][day]
        p.rules.append((PreferenceRule(kind="avoid_weekdays", strength="soft", weekdays=[day],
                                       summary=f"Avoid {name_day}"), f"I try to keep {name_day}days free"))
    # Graded preferences (docs/research/negotiation-layer.md, "rules, not scores"): an ideal
    # time of day and a weekday someone would rather avoid. These give the solver real
    # trade-offs to weigh, so the mediator has something to negotiate over.
    if rng.random() < 0.5:
        hour = rng.choice([10, 11, 13, 14, 15, 16])
        width = rng.choice([90, 120, 180])
        label = f"{hour % 12 or 12}{'am' if hour < 12 else 'pm'}"
        p.rules.append((PreferenceRule(kind="time_of_day", strength="soft", time=f"{hour:02d}:00",
                                       width_minutes=width, summary=f"Ideally around {label}"),
                        f"Ideally around {label}"))
    if rng.random() < 0.25:
        day = rng.choice((0, 2, 4))
        weights = [1.0] * 7
        weights[day] = 0.3
        name_day = ["Mon", "Tue", "Wed", "Thu", "Fri"][day]
        p.rules.append((PreferenceRule(kind="day_weights", strength="soft", day_weights=weights,
                                       summary=f"{name_day}days are rough"), f"{name_day}days are rough for me"))
    if rng.random() < 0.18:
        p.rules.append((PreferenceRule(kind="buffer_minutes", strength="soft", minutes=15,
                                       summary="15 min buffer around other things"),
                        "I need 15 minutes between things to walk across campus"))
    return p


def expand(person: Person, tz: str, start: date, end: date, overrides: dict | None = None) -> list[BusyInterval]:
    zone = ZoneInfo(tz)
    out: list[BusyInterval] = []
    day = start - timedelta(days=1)
    while day <= end + timedelta(days=1):
        for item in person.items:
            if day.weekday() not in item.weekdays:
                continue
            h, m = divmod(item.start_min, 60)
            begin = datetime.combine(day, time(h, m), tzinfo=zone)
            out.append(BusyInterval(
                start=begin.astimezone(timezone.utc),
                end=(begin + timedelta(minutes=item.duration)).astimezone(timezone.utc),
                title=item.title, kind=item.kind,
            ))
        day += timedelta(days=1)
    return out


def _open_count(people: list[Person], slots, tz: str, start: date, end: date) -> int:
    cache = {id(p): expand(p, tz, start, end) for p in people}
    open_n = 0
    for slot in slots:
        ok = True
        for p in people:
            rules = [r for r, _ in p.rules]
            if assess_slot(slot, cache[id(p)], rules, tz).status == HARD:
                ok = False
                break
        open_n += ok
    return open_n


def generate_crowd(rng: random.Random, count: int, slots, tz: str, start: date, end: date) -> list[Person]:
    names: set[str] = set()
    people: list[Person] = []
    while len(people) < count:
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if name in names:
            continue
        names.add(name)
        people.append(make_person(rng, name))

    # A hundred busy students would leave no free hour. Thin commitments, hard ones first,
    # until enough times stay open for the negotiation to have real choices.
    target = max(6, min(14, len(slots) // 5))
    for _ in range(600):
        if _open_count(people, slots, tz, start, end) >= target:
            break
        donors = [p for p in people if p.items or p.rules]
        if not donors:
            break
        p = rng.choice(donors)
        pool = [("item", i) for i in p.items] + [("rule", r) for r in p.rules if r[0].strength == "hard"]
        if not pool:
            continue
        kind, thing = rng.choice(pool)
        if kind == "item":
            if thing.kind == "hard" and rng.random() < 0.5:
                thing.kind = "soft"  # they could move it, with some effort
            else:
                p.items.remove(thing)
        else:
            p.rules.remove(thing)
            p.rules.append((thing[0].model_copy(update={"strength": "soft"}), thing[1]))
    return people


def create_sample_users(db: Session, people: list[Person], tz: str, start: date, end: date) -> list[models.User]:
    users = []
    for person in people:
        user = models.User(
            name=person.name,
            calendar=[iv.to_dict() for iv in expand(person, tz, start, end)],
            calendar_filename="sample-week.ics",
            calendar_uploaded_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.flush()
        for rule, said in person.rules:
            db.add(models.UserPreference(
                user_id=user.id, raw_text=said, rules=[rule.model_dump(exclude_none=True)],
                ack=f"Got it: {rule.summary.lower()}.",
            ))
        users.append(user)
    db.commit()
    return users


def sample_calendar_for(db: Session, user: models.User, tz: str, days: int = 21, seed: int | None = None) -> int:
    """Give one real user a plausible sample calendar (for the upload step's shortcut)."""
    rng = random.Random(seed)
    # Redraw until the week has some substance: several commitments, and one the person could move.
    for _ in range(40):
        person = make_person(rng, user.name)
        if len(person.items) >= 6 and any(i.kind == "soft" for i in person.items):
            break
    today = datetime.now(ZoneInfo(tz)).date()
    user.calendar = [iv.to_dict() for iv in expand(person, tz, today, today + timedelta(days=days))]
    user.calendar_filename = "sample-week.ics"
    user.calendar_uploaded_at = datetime.now(timezone.utc)
    db.commit()
    return len(user.calendar)


_tasks: set[asyncio.Task] = set()


def populate_in_background(meeting_id: str, count: int, *, stagger: float, autostart: bool, agents) -> None:
    task = asyncio.create_task(_populate(meeting_id, count, stagger, autostart, agents))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _populate(meeting_id: str, count: int, stagger: float, autostart: bool, agents) -> None:
    from app.negotiation import event_slots, launch_negotiation

    db = SessionLocal()
    try:
        meeting = db.get(models.MeetingRequest, meeting_id)
        rng = random.Random()
        slots = event_slots(meeting)
        people = generate_crowd(rng, count, slots, meeting.timezone, meeting.start_date, meeting.end_date)
        users = create_sample_users(db, people, meeting.timezone, meeting.start_date, meeting.end_date)
        for user in users:
            db.add(models.GroupMember(group_id=meeting.group_id, user_id=user.id, role="member"))
            db.commit()
            await announce_member(db, meeting_id, user.id, "member_joined")
            await asyncio.sleep(stagger)
        for user in users:
            member = db.query(models.GroupMember).filter_by(group_id=meeting.group_id, user_id=user.id).one()
            member.ready = True
            db.commit()
            await announce_member(db, meeting_id, user.id)
            await asyncio.sleep(stagger / 2)
        if autostart:
            await asyncio.sleep(0.8)
            await launch_negotiation(db, meeting, agents)
    except Exception:
        log.exception("sample population for %s failed", meeting_id)
    finally:
        db.close()
