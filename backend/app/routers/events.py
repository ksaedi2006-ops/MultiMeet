from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.agents import get_agents
from app.bus import bus
from app.database import get_db
from app.members import announce_member, find_member, member_status
from app.negotiation import event_slots, start_negotiation

router = APIRouter(prefix="/events", tags=["events"])


def get_meeting_or_404(db: Session, event_id: str) -> models.MeetingRequest:
    meeting = db.get(models.MeetingRequest, event_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Event not found")
    return meeting


def event_out(db: Session, meeting: models.MeetingRequest) -> schemas.EventOut:
    group = db.get(models.Group, meeting.group_id)
    return schemas.EventOut(
        event_id=meeting.id, title=meeting.title, invite_code=group.invite_code, status=meeting.status,
        organizer_id=meeting.requested_by, duration_minutes=meeting.duration_minutes,
        start_date=meeting.start_date, end_date=meeting.end_date, timezone=meeting.timezone,
        earliest_hour=meeting.earliest_hour, latest_hour=meeting.latest_hour, weekdays=meeting.weekdays or [],
    )


def meeting_for_invite(db: Session, invite_code: str) -> models.MeetingRequest:
    group = db.query(models.Group).filter_by(invite_code=invite_code).one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="This invite link isn't valid")
    meeting = db.query(models.MeetingRequest).filter_by(group_id=group.id).one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="This invite link isn't valid")
    return meeting


@router.post("", response_model=schemas.EventOut)
async def create_event(payload: schemas.EventCreate, requested_by: str, db: Session = Depends(get_db)):
    if not db.get(models.User, requested_by):
        raise HTTPException(status_code=404, detail="User not found")
    group = models.Group(name=payload.title)
    db.add(group)
    db.flush()
    meeting = models.MeetingRequest(group_id=group.id, requested_by=requested_by, **payload.model_dump())
    db.add(meeting)
    db.add(models.GroupMember(group_id=group.id, user_id=requested_by, role="admin"))
    db.commit()
    await announce_member(db, meeting.id, requested_by, "member_joined")
    return event_out(db, meeting)


@router.get("/{event_id}", response_model=schemas.EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    return event_out(db, get_meeting_or_404(db, event_id))


@router.get("/invite/{invite_code}", response_model=schemas.EventOut)
def get_event_by_invite(invite_code: str, db: Session = Depends(get_db)):
    return event_out(db, meeting_for_invite(db, invite_code))


@router.post("/join/{invite_code}", response_model=schemas.EventOut)
async def join_event(invite_code: str, user_id: str, db: Session = Depends(get_db)):
    meeting = meeting_for_invite(db, invite_code)
    if not db.get(models.User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if not find_member(db, meeting, user_id):
        if meeting.status != "open":
            raise HTTPException(status_code=409, detail="This event has already been negotiated")
        db.add(models.GroupMember(group_id=meeting.group_id, user_id=user_id, role="member"))
        db.commit()
        await announce_member(db, meeting.id, user_id, "member_joined")
    return event_out(db, meeting)


@router.get("/{event_id}/members")
def list_members(event_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, event_id)
    members = (
        db.query(models.GroupMember)
        .filter_by(group_id=meeting.group_id)
        .order_by(models.GroupMember.joined_at)
        .all()
    )
    return [member_status(db, m) for m in members]


class ReadyIn(BaseModel):
    ready: bool = True


@router.post("/{event_id}/ready")
async def set_ready(event_id: str, user_id: str, payload: ReadyIn | None = None, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, event_id)
    member = find_member(db, meeting, user_id)
    if not member:
        raise HTTPException(status_code=403, detail="You haven't joined this event")
    if meeting.status != "open":
        raise HTTPException(status_code=409, detail="The negotiation has already started")
    member.ready = payload.ready if payload else True
    db.commit()
    await announce_member(db, event_id, user_id)
    return member_status(db, member)


@router.get("/{event_id}/preview")
def preview_slots(event_id: str, db: Session = Depends(get_db)):
    """The candidate slots this event would negotiate over, for the organiser's setup screen."""
    meeting = get_meeting_or_404(db, event_id)
    return [s.to_dict() for s in event_slots(meeting)]


@router.post("/{event_id}/start")
async def start(event_id: str, user_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, event_id)
    if meeting.requested_by != user_id:
        raise HTTPException(status_code=403, detail="Only the organiser can start the negotiation")
    members = db.query(models.GroupMember).filter_by(group_id=meeting.group_id).all()
    ready = [m for m in members if m.ready]
    if not ready:
        raise HTTPException(status_code=409, detail="Nobody has checked in yet")
    if not event_slots(meeting):
        raise HTTPException(status_code=409, detail="The date range has no upcoming times left")

    agents = get_agents()
    db.add(models.NegotiationSession(meeting_request_id=meeting.id, agent_backend=agents.name))
    meeting.status = "negotiating"
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The negotiation has already started")

    start_negotiation(meeting.id, agents)
    waiting = [member_status(db, m)["name"] for m in members if not m.ready]
    return {"started": True, "participants": len(ready), "left_out": waiting, "agent_backend": agents.name}


@router.get("/{event_id}/log")
def event_log(event_id: str, after: int = 0, viewer: str | None = None, db: Session = Depends(get_db)):
    get_meeting_or_404(db, event_id)
    return bus.history(db, event_id, after, viewer)


@router.get("/{event_id}/decision")
def get_decision(event_id: str, db: Session = Depends(get_db)):
    get_meeting_or_404(db, event_id)
    decision = db.query(models.MeetingDecision).filter_by(meeting_request_id=event_id).one_or_none()
    if not decision:
        raise HTTPException(status_code=404, detail="No decision yet")
    rsvps = db.query(models.Rsvp).filter_by(meeting_request_id=event_id).all()
    return {
        "status": decision.status,
        "slot_id": decision.slot_id,
        "label": decision.label,
        "start": _iso(decision.start),
        "end": _iso(decision.end),
        "explanation": decision.explanation,
        "question": decision.question,
        "scores": decision.scores,
        "compromises": decision.compromises,
        "alternatives": decision.alternatives,
        "rsvps": {r.user_id: r.response for r in rsvps},
    }


@router.post("/{event_id}/rsvp")
async def rsvp(event_id: str, user_id: str, payload: schemas.RsvpIn, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, event_id)
    if not find_member(db, meeting, user_id):
        raise HTTPException(status_code=403, detail="You haven't joined this event")
    if meeting.status != "scheduled":
        raise HTTPException(status_code=409, detail="There's no scheduled time to respond to")
    row = db.query(models.Rsvp).filter_by(meeting_request_id=event_id, user_id=user_id).one_or_none()
    if row:
        row.response = payload.response
    else:
        db.add(models.Rsvp(meeting_request_id=event_id, user_id=user_id, response=payload.response))
    db.commit()
    user = db.get(models.User, user_id)
    await bus.emit(db, event_id, "rsvp", {"user_id": user_id, "name": user.name, "response": payload.response})
    return {"ok": True}


@router.get("/{event_id}/calendar.ics")
def download_ics(event_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(db, event_id)
    decision = db.query(models.MeetingDecision).filter_by(meeting_request_id=event_id).one_or_none()
    if not decision or decision.start is None:
        raise HTTPException(status_code=404, detail="No scheduled time yet")
    fmt = "%Y%m%dT%H%M%SZ"
    start, end = _utc(decision.start), _utc(decision.end)
    body = "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MeetMind//EN", "BEGIN:VEVENT",
        f"UID:{meeting.id}@meetmind", f"DTSTAMP:{datetime.now(timezone.utc).strftime(fmt)}",
        f"DTSTART:{start.strftime(fmt)}", f"DTEND:{end.strftime(fmt)}",
        f"SUMMARY:{_ics_text(meeting.title)}", f"DESCRIPTION:{_ics_text(decision.explanation or '')}",
        "END:VEVENT", "END:VCALENDAR", "",
    ])
    return Response(body, media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="meetmind.ics"'})


def _utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on the way back out; every stored time is UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return _utc(dt).isoformat() if dt else None


def _ics_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
