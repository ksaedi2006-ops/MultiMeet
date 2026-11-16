from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.agents import get_agents
from app.agents.types import AgentError
from app.database import get_db
from app.members import announce_member
from app.scheduling.ics import BusyInterval, CalendarParseError, parse_ics

router = APIRouter(prefix="/users", tags=["users"])

CALENDAR_HORIZON_DAYS = 120


def get_user_or_404(db: Session, user_id: str) -> models.User:
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def calendar_out(user: models.User) -> dict:
    overrides = user.calendar_overrides or {}
    events = []
    for raw in user.calendar or []:
        iv = BusyInterval.from_dict(raw)
        events.append({**iv.to_dict(), "kind": overrides.get(iv.title, iv.kind)})
    return {
        "filename": user.calendar_filename,
        "uploaded_at": user.calendar_uploaded_at.isoformat() if user.calendar_uploaded_at else None,
        "events": events,
    }


def preference_out(p: models.UserPreference) -> dict:
    return {"id": p.id, "raw_text": p.raw_text, "rules": p.rules or [], "ack": p.ack}


@router.post("/anon", response_model=schemas.UserOut)
def create_guest(db: Session = Depends(get_db)):
    user = models.User(name="Guest")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    return get_user_or_404(db, user_id)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def rename(user_id: str, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = get_user_or_404(db, user_id)
    user.name = payload.name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/calendar")
def get_calendar(user_id: str, db: Session = Depends(get_db)):
    return calendar_out(get_user_or_404(db, user_id))


@router.post("/{user_id}/calendar")
async def upload_calendar(
    user_id: str, payload: schemas.CalendarUpload, event_id: str | None = None, db: Session = Depends(get_db)
):
    user = get_user_or_404(db, user_id)
    now = datetime.now(timezone.utc)
    try:
        intervals = parse_ics(
            payload.raw_ics,
            window_start=now - timedelta(days=1),
            window_end=now + timedelta(days=CALENDAR_HORIZON_DAYS),
            default_tz=payload.timezone,
        )
    except CalendarParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    user.calendar = [iv.to_dict() for iv in intervals]
    user.calendar_filename = payload.filename
    user.calendar_uploaded_at = now
    db.commit()
    await announce_member(db, event_id, user_id)
    return calendar_out(user)


@router.post("/{user_id}/calendar/sample")
async def use_sample_calendar(
    user_id: str, timezone: str = "America/New_York", event_id: str | None = None, db: Session = Depends(get_db)
):
    """Fill this person's calendar with a plausible randomized student week."""
    from app.sample import sample_calendar_for

    user = get_user_or_404(db, user_id)
    sample_calendar_for(db, user, timezone)
    await announce_member(db, event_id, user_id)
    return calendar_out(user)


@router.patch("/{user_id}/calendar/override")
def override_event_kind(user_id: str, payload: schemas.CalendarOverride, db: Session = Depends(get_db)):
    """Reclassify every occurrence of an event title as hard or soft."""
    user = get_user_or_404(db, user_id)
    user.calendar_overrides = {**(user.calendar_overrides or {}), payload.title: payload.kind}
    db.commit()
    return calendar_out(user)


@router.delete("/{user_id}/calendar")
async def clear_calendar(user_id: str, event_id: str | None = None, db: Session = Depends(get_db)):
    user = get_user_or_404(db, user_id)
    user.calendar, user.calendar_filename, user.calendar_uploaded_at = [], None, None
    db.commit()
    await announce_member(db, event_id, user_id)
    return calendar_out(user)


@router.get("/{user_id}/preferences")
def list_preferences(user_id: str, db: Session = Depends(get_db)):
    prefs = (
        db.query(models.UserPreference)
        .filter_by(user_id=user_id, active=True)
        .order_by(models.UserPreference.created_at)
        .all()
    )
    return [preference_out(p) for p in prefs]


@router.post("/{user_id}/preferences")
async def add_preference(
    user_id: str, payload: schemas.PreferenceCreate, event_id: str | None = None, db: Session = Depends(get_db)
):
    get_user_or_404(db, user_id)
    try:
        parsed = await get_agents().parse_preference(payload.raw_text)
    except AgentError as exc:
        raise HTTPException(status_code=502, detail="Your agent couldn't read that. Try saying it another way.") from exc
    pref = models.UserPreference(
        user_id=user_id,
        raw_text=payload.raw_text,
        rules=[r.model_dump(exclude_none=True) for r in parsed.rules],
        ack=parsed.ack,
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    await announce_member(db, event_id, user_id)
    return preference_out(pref)


@router.delete("/{user_id}/preferences/{preference_id}")
async def delete_preference(
    user_id: str, preference_id: str, event_id: str | None = None, db: Session = Depends(get_db)
):
    pref = db.query(models.UserPreference).filter_by(id=preference_id, user_id=user_id).one_or_none()
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    pref.active = False
    db.commit()
    await announce_member(db, event_id, user_id)
    return {"ok": True}
