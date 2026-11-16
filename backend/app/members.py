"""Roster helpers shared by the user and event routes."""

from sqlalchemy.orm import Session

from app import models
from app.bus import bus


def member_status(db: Session, member: models.GroupMember) -> dict:
    user = db.get(models.User, member.user_id)
    rules = (
        db.query(models.UserPreference)
        .filter_by(user_id=member.user_id, active=True)
        .all()
    )
    return {
        "user_id": member.user_id,
        "name": user.name if user else "Unknown",
        "role": member.role,
        "ready": bool(member.ready),
        "calendar_events": len(user.calendar or []) if user else 0,
        "rules": sum(len(p.rules or []) for p in rules),
    }


def find_member(db: Session, meeting: models.MeetingRequest, user_id: str) -> models.GroupMember | None:
    return db.query(models.GroupMember).filter_by(group_id=meeting.group_id, user_id=user_id).one_or_none()


async def announce_member(db: Session, meeting_id: str | None, user_id: str, type_: str = "member_updated") -> None:
    """Tell an event's live roster that a member changed (uploaded, briefed, checked in)."""
    if not meeting_id:
        return
    meeting = db.get(models.MeetingRequest, meeting_id)
    if not meeting:
        return
    member = find_member(db, meeting, user_id)
    if member:
        await bus.emit(db, meeting_id, type_, member_status(db, member))
