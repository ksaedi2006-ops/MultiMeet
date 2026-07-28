from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/events", tags=["events"])


def _to_event_out(meeting: models.MeetingRequest, group: models.Group) -> schemas.EventOut:
    return schemas.EventOut(
        event_id=meeting.id,
        group_id=group.id,
        title=meeting.title,
        invite_code=group.invite_code,
        status=meeting.status,
    )


@router.post("", response_model=schemas.EventOut)
def create_event(payload: schemas.EventCreate, requested_by: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == requested_by).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    group = models.Group(name=payload.title, type="custom")
    db.add(group)
    db.commit()
    db.refresh(group)

    db.add(models.GroupMember(group_id=group.id, user_id=requested_by, role="admin"))

    now = datetime.utcnow()
    meeting = models.MeetingRequest(
        group_id=group.id,
        requested_by=requested_by,
        title=payload.title,
        duration_minutes=60,
        date_range_start=now,
        date_range_end=now + timedelta(days=14),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return _to_event_out(meeting, group)


@router.get("/{event_id}", response_model=schemas.EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.MeetingRequest).filter(models.MeetingRequest.id == event_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Event not found")
    group = db.query(models.Group).filter(models.Group.id == meeting.group_id).one()
    return _to_event_out(meeting, group)


@router.post("/join/{invite_code}", response_model=schemas.EventOut)
def join_event(invite_code: str, user_id: str, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_member = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group.id, models.GroupMember.user_id == user_id)
        .first()
    )
    if not existing_member:
        db.add(models.GroupMember(group_id=group.id, user_id=user_id, role="member"))
        db.commit()

    meeting = (
        db.query(models.MeetingRequest)
        .filter(models.MeetingRequest.group_id == group.id)
        .order_by(models.MeetingRequest.created_at.desc())
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="No event found for this group")

    return _to_event_out(meeting, group)


@router.get("/{event_id}/members")
def list_event_members(event_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.MeetingRequest).filter(models.MeetingRequest.id == event_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Event not found")
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == meeting.group_id).all()
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        result.append({"user_id": m.user_id, "name": user.name if user else None, "role": m.role})
    return result
