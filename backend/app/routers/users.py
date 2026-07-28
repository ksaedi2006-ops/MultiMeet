from fastapi import APIRouter, Depends, HTTPException
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(email=payload.email, name=payload.name, password_hash=bcrypt.hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/{user_id}/preferences", response_model=schemas.PreferenceOut)
def add_preference(user_id: str, payload: schemas.PreferenceCreate, db: Session = Depends(get_db)):
    from app.agents.client import call_agent, PERSONAL_AGENT_MODEL

    parse_prompt = (
        "Parse the following natural-language scheduling preference into a structured JSON object "
        'with keys "type" (e.g. "morning_aversion", "day_cutoff", "buffer_time", "custom"), '
        '"strength" ("hard" or "soft"), and "details" (free-form structured fields). '
        f'Preference text: "{payload.raw_text}". Return ONLY the JSON object.'
    )
    try:
        parsed = call_agent(parse_prompt, model=PERSONAL_AGENT_MODEL, max_tokens=512)
        strength = parsed.get("strength", "soft")
    except Exception:
        parsed = {"type": "custom", "details": {}}
        strength = "soft"

    pref = models.UserPreference(
        user_id=user_id, raw_text=payload.raw_text, parsed_rules=parsed, strength=strength
    )
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.get("/{user_id}/preferences", response_model=list[schemas.PreferenceOut])
def list_preferences(user_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.UserPreference)
        .filter(models.UserPreference.user_id == user_id, models.UserPreference.active == True)  # noqa: E712
        .all()
    )


@router.delete("/{user_id}/preferences/{preference_id}")
def delete_preference(user_id: str, preference_id: str, db: Session = Depends(get_db)):
    pref = (
        db.query(models.UserPreference)
        .filter(models.UserPreference.id == preference_id, models.UserPreference.user_id == user_id)
        .first()
    )
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    pref.active = False
    db.commit()
    return {"ok": True}
