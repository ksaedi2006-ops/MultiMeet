import asyncio
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app import models
from app.agents.mediator_agent import mediate
from app.agents.personal_agent import evaluate_slots
from app.websocket import manager

MAX_ROUNDS = 3


def candidate_slots(start: datetime, end: datetime, duration_minutes: int) -> list[str]:
    slots = []
    cursor = start
    step = timedelta(minutes=duration_minutes)
    while cursor + step <= end:
        if 8 <= cursor.hour <= 20:
            slots.append(cursor.isoformat())
        cursor += timedelta(hours=1)
    return slots


async def run_negotiation(db: Session, meeting_request: models.MeetingRequest) -> models.MeetingDecision:
    group_members = (
        db.query(models.GroupMember).filter(models.GroupMember.group_id == meeting_request.group_id).all()
    )
    meeting_details = {
        "title": meeting_request.title,
        "duration_minutes": meeting_request.duration_minutes,
        "location_constraint": meeting_request.location_constraint,
        "urgency": meeting_request.urgency,
    }
    slots = candidate_slots(
        meeting_request.date_range_start, meeting_request.date_range_end, meeting_request.duration_minutes
    )

    session = models.NegotiationSession(meeting_request_id=meeting_request.id, round_number=1)
    db.add(session)
    db.commit()
    db.refresh(session)

    await manager.broadcast(
        meeting_request.id,
        {"type": "negotiation_started", "participants": len(group_members), "slots": len(slots)},
    )

    agent_responses: list[dict] = []
    for member in group_members:
        user = db.query(models.User).filter(models.User.id == member.user_id).one()
        prefs = (
            db.query(models.UserPreference)
            .filter(models.UserPreference.user_id == user.id, models.UserPreference.active == True)  # noqa: E712
            .all()
        )
        response = await asyncio.to_thread(
            evaluate_slots,
            user_id=user.id,
            user_name=user.name,
            calendar_events=[],
            preferences=[{"raw_text": p.raw_text, "rules": p.parsed_rules, "strength": p.strength} for p in prefs],
            acceptance_rate=0.8,
            reject_patterns=[],
            flexible_events=[],
            meeting_details=meeting_details,
            slots=slots,
        )
        agent_responses.append(response)

        db.add(
            models.AgentResponse(
                negotiation_session_id=session.id,
                user_id=user.id,
                round_number=1,
                slot_evaluations=response.get("slots", []),
                hard_blocks=response.get("hard_blocks", []),
                notes=response.get("general_notes", ""),
            )
        )
        db.commit()

        await manager.broadcast(
            meeting_request.id,
            {
                "type": "agent_response",
                "user_id": user.id,
                "user_name": user.name,
                "notes": response.get("general_notes", ""),
                "top_slot": max(response.get("slots", []), key=lambda s: s["satisfaction"], default=None),
            },
        )

    decision_json = await asyncio.to_thread(mediate, meeting_details, agent_responses)

    session.mediator_proposal = decision_json
    session.status = "converged" if decision_json.get("status") == "converged" else "escalated"
    session.completed_at = datetime.utcnow()
    db.commit()

    await manager.broadcast(meeting_request.id, {"type": "mediator_decision", "decision": decision_json})

    decision = models.MeetingDecision(
        meeting_request_id=meeting_request.id,
        chosen_datetime=datetime.fromisoformat(decision_json["chosen_datetime"])
        if decision_json.get("chosen_datetime")
        else meeting_request.date_range_start,
        chosen_location=decision_json.get("chosen_location"),
        explanation=decision_json.get("explanation", ""),
        satisfaction_breakdown=decision_json.get("satisfaction_breakdown", {}),
        alternatives=decision_json.get("alternatives", []),
    )
    db.add(decision)

    meeting_request.status = "scheduled" if session.status == "converged" else "negotiating"
    db.commit()
    db.refresh(decision)

    return decision
