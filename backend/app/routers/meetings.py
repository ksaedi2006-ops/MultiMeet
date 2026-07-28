from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.negotiation import run_negotiation

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post("")
def create_meeting_request(
    payload: schemas.MeetingRequestCreate, requested_by: str, db: Session = Depends(get_db)
):
    meeting = models.MeetingRequest(
        group_id=payload.group_id,
        requested_by=requested_by,
        title=payload.title,
        duration_minutes=payload.duration_minutes,
        date_range_start=payload.date_range_start,
        date_range_end=payload.date_range_end,
        is_recurring=payload.is_recurring,
        location_constraint=payload.location_constraint,
        urgency=payload.urgency,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return {"id": meeting.id, "status": meeting.status}


@router.post("/{meeting_id}/negotiate")
async def start_negotiation(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.MeetingRequest).filter(models.MeetingRequest.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting request not found")

    decision = await run_negotiation(db, meeting)
    return {
        "chosen_datetime": decision.chosen_datetime,
        "chosen_location": decision.chosen_location,
        "explanation": decision.explanation,
        "satisfaction_breakdown": decision.satisfaction_breakdown,
        "alternatives": decision.alternatives,
    }


@router.get("/{meeting_id}")
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.MeetingRequest).filter(models.MeetingRequest.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting request not found")
    return {
        "id": meeting.id,
        "title": meeting.title,
        "status": meeting.status,
        "date_range_start": meeting.date_range_start,
        "date_range_end": meeting.date_range_end,
    }
