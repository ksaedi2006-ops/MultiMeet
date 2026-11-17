"""Replay a recorded Claude negotiation (app/live_bank) as a fresh, live-looking event.

The bank holds negotiations run once, offline, by the product's own pipeline with real Claude
agents (scripts/record_live.py). A sample event drawn from it gets new ids, the viewer as its
organiser, and its dates moved forward by whole weeks so weekdays and local times still line
up. Its events are then emitted over the bus with the original order and compressed timing,
so the frontend can't tell it from a live run, and nobody pays for API calls at view time.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app import models
from app.bus import bus

log = logging.getLogger(__name__)
BANK = Path(os.environ.get("MULTIMEET_LIVE_BANK") or Path(__file__).resolve().parent / "live_bank")
MAX_GAP = 1.2  # seconds between replayed events, at most

_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_DATES = re.compile(
    r"(?P<dt>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)"
    r"|(?P<slot>\b\d{8}T\d{4}Z\b)"
    r"|(?P<date>\b\d{4}-\d{2}-\d{2}\b)"
    r"|(?P<label>\b(?:" + "|".join(_DAYS) + r"),? (?:" + "|".join(_MONTHS) + r") \d{1,2}\b)"
)


@lru_cache(maxsize=1)
def bank() -> dict[str, int]:
    """Recording file name -> group size."""
    out = {}
    for path in sorted(BANK.glob("*.json")):
        try:
            out[path.name] = len(json.loads(path.read_text())["users"])
        except Exception:
            log.warning("unreadable recording %s", path.name)
    return out


def pick(count: int, rng: random.Random | None = None) -> str | None:
    """A recording whose group size is closest to the one asked for."""
    recs = bank()
    if not recs:
        return None
    best = min(abs(n - count) for n in recs.values())
    return (rng or random).choice(sorted(name for name, n in recs.items() if abs(n - count) == best))


def _shifter(days: int, tz: ZoneInfo, anchor: date):
    def shift_dt(dt: datetime) -> datetime:
        # Shift in local time so a 10:30 AM slot stays 10:30 AM across daylight-saving changes.
        local = dt.astimezone(tz)
        moved = (local.replace(tzinfo=None) + timedelta(days=days)).replace(tzinfo=tz)
        return moved.astimezone(dt.tzinfo)

    def sub(m: re.Match) -> str:
        text = m.group(0)
        if m.group("dt"):
            z = text.endswith("Z")
            dt = datetime.fromisoformat(text[:-1] + "+00:00" if z else text)
            if dt.tzinfo is None:
                return (dt + timedelta(days=days)).isoformat()
            out = shift_dt(dt).isoformat()
            return out.replace("+00:00", "Z") if z else out
        if m.group("slot"):
            dt = datetime.strptime(text, "%Y%m%dT%H%MZ").replace(tzinfo=timezone.utc)
            return shift_dt(dt).strftime("%Y%m%dT%H%MZ")
        if m.group("date"):
            return (date.fromisoformat(text) + timedelta(days=days)).isoformat()
        day, rest = text.split(" ", 1) if "," not in text else text.split(", ", 1)
        mon, num = rest.split(" ")
        month, year = _MONTHS.index(mon) + 1, anchor.year
        if month < anchor.month - 6:
            year += 1
        elif month > anchor.month + 6:
            year -= 1
        new = date(year, month, int(num)) + timedelta(days=days)
        sep = ", " if "," in text else " "
        return f"{day}{sep}{_MONTHS[new.month - 1]} {new.day}"

    return sub


def plan(name: str, today: date | None = None) -> str:
    """The `recording` value for a new event: file, id salt and how many weeks to move it."""
    meta = json.loads((BANK / name).read_text())
    tz = ZoneInfo(meta["meeting"]["timezone"])
    start = date.fromisoformat(meta["meeting"]["start_date"])
    today = today or datetime.now(tz).date()
    weeks = max(0, -(-((today + timedelta(days=1)) - start).days // 7))
    return f"{name}|{uuid.uuid4()}|{weeks}"


def load(recording: str, owner_id: str, owner_name: str) -> dict:
    """The recording with this event's ids, the viewer as organiser, and dates moved forward.
    Deterministic for a given `recording` value, so the event and its replay agree."""
    name, salt, weeks_s = recording.split("|")
    weeks = int(weeks_s)
    raw = (BANK / name).read_text()
    meta = json.loads(raw)
    old_owner = meta["owner_id"]
    tz = ZoneInfo(meta["meeting"]["timezone"])
    start = date.fromisoformat(meta["meeting"]["start_date"])

    ns = uuid.UUID(salt)
    raw = _UUID.sub(lambda m: owner_id if m.group(0) == old_owner else str(uuid.uuid5(ns, m.group(0))), raw)
    if weeks:
        raw = _DATES.sub(_shifter(weeks * 7, tz, start), raw)
    rec = json.loads(raw)
    if owner_name and owner_name != "Alex":
        swap = re.compile(r"\bAlex\b")
        rec["events"] = json.loads(swap.sub(owner_name.replace("\\", ""), json.dumps(rec["events"])))
        if rec.get("decision"):
            rec["decision"] = json.loads(swap.sub(owner_name.replace("\\", ""), json.dumps(rec["decision"])))
    return rec


def create_meeting(db: Session, requester: models.User, name: str) -> tuple[models.MeetingRequest, list[str]]:
    """The event and its recorded people. Returns the meeting and the people to add, in order."""
    recording = plan(name)
    rec = load(recording, requester.id, requester.name)
    m = rec["meeting"]
    group = models.Group(name=m["title"])
    db.add(group)
    db.flush()
    meeting = models.MeetingRequest(
        id=m["id"], group_id=group.id, requested_by=requester.id, title=m["title"],
        duration_minutes=m["duration_minutes"], start_date=date.fromisoformat(m["start_date"]),
        end_date=date.fromisoformat(m["end_date"]), timezone=m["timezone"],
        earliest_hour=m["earliest_hour"], latest_hour=m["latest_hour"], weekdays=m["weekdays"],
        recording=recording,
    )
    db.add(meeting)
    db.add(models.GroupMember(group_id=group.id, user_id=requester.id, role="admin", ready=True))
    people = []
    for u in rec["users"]:
        if u["id"] == requester.id:
            continue
        db.add(models.User(id=u["id"], name=u["name"], calendar=u["calendar"],
                           calendar_filename="sample-week.ics", calendar_uploaded_at=datetime.now(timezone.utc)))
        for p in u["prefs"]:
            db.add(models.UserPreference(user_id=u["id"], raw_text=p["raw_text"], rules=p["rules"],
                                         ack=p.get("ack"), parse_ok=p.get("parse_ok", True)))
        people.append(u["id"])
    db.commit()
    return meeting, people


_tasks: set[asyncio.Task] = set()


def start_replay(meeting_id: str) -> None:
    task = asyncio.create_task(_replay(meeting_id))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _replay(meeting_id: str) -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        meeting = db.get(models.MeetingRequest, meeting_id)
        session = db.query(models.NegotiationSession).filter_by(meeting_request_id=meeting_id).one()
        requester = db.get(models.User, meeting.requested_by)
        rec = load(meeting.recording, requester.id, requester.name)
        if rec["meeting"]["id"] != meeting_id:
            raise RuntimeError("recording ids drifted")
        last = 0.0
        for e in rec["events"]:
            await asyncio.sleep(min(MAX_GAP, max(0.0, e["offset"] - last)))
            last = e["offset"]
            payload = e["payload"]
            if e["type"] == "negotiation_started":
                payload = {**payload, "recorded": True, "models": rec.get("models")}
            await bus.emit(db, meeting_id, e["type"], payload, owner_id=e["owner_id"], private=e["private"])
        d = rec.get("decision")
        if d:
            db.add(models.MeetingDecision(
                meeting_request_id=meeting_id, status=d["status"], slot_id=d["slot_id"],
                start=datetime.fromisoformat(d["start"]) if d["start"] else None,
                end=datetime.fromisoformat(d["end"]) if d["end"] else None,
                label=d["label"], explanation=d["explanation"], question=d["question"],
                scores=d["scores"] or {}, compromises=d["compromises"] or [], alternatives=d["alternatives"] or [],
            ))
        meeting.status = rec["meeting"]["status"]
        session.status = d["status"] if d else "escalated"
        session.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        log.exception("replay of %s failed", meeting_id)
        db.rollback()
        meeting = db.get(models.MeetingRequest, meeting_id)
        if meeting:
            meeting.status = "failed"
        db.commit()
        await bus.emit(db, meeting_id, "negotiation_failed", {"error": f"The recorded run could not be replayed ({type(exc).__name__})."})
    finally:
        db.close()


def populate_in_background(meeting_id: str, people: list[str], *, stagger: float, autostart: bool) -> None:
    task = asyncio.create_task(_populate(meeting_id, people, stagger, autostart))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _populate(meeting_id: str, people: list[str], stagger: float, autostart: bool) -> None:
    """The recorded people join and check in one by one, exactly like a generated crowd."""
    from app.agents import get_agents
    from app.database import SessionLocal
    from app.members import announce_member
    from app.negotiation import launch_negotiation

    db = SessionLocal()
    try:
        meeting = db.get(models.MeetingRequest, meeting_id)
        for uid in people:
            db.add(models.GroupMember(group_id=meeting.group_id, user_id=uid, role="member"))
            db.commit()
            await announce_member(db, meeting_id, uid, "member_joined")
            await asyncio.sleep(stagger)
        for uid in people:
            member = db.query(models.GroupMember).filter_by(group_id=meeting.group_id, user_id=uid).one()
            member.ready = True
            db.commit()
            await announce_member(db, meeting_id, uid)
            await asyncio.sleep(stagger / 2)
        if autostart:
            await asyncio.sleep(0.8)
            await launch_negotiation(db, meeting, get_agents())
    except Exception:
        log.exception("recorded population for %s failed", meeting_id)
    finally:
        db.close()
