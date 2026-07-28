import json

from app.agents.client import call_agent, PERSONAL_AGENT_MODEL
from app.agents.prompts import PERSONAL_AGENT_SYSTEM_PROMPT


def evaluate_slots(
    user_id: str,
    user_name: str,
    calendar_events: list[dict],
    preferences: list[dict],
    acceptance_rate: float,
    reject_patterns: list[str],
    flexible_events: list[str],
    meeting_details: dict,
    slots: list[str],
) -> dict:
    """Run the Personal Scheduling Agent for one user against a set of candidate slots."""
    prompt = PERSONAL_AGENT_SYSTEM_PROMPT.format(
        user_name=user_name,
        user_id=user_id,
        calendar_events_json=json.dumps(calendar_events),
        parsed_preferences_list=json.dumps(preferences),
        acceptance_rate=acceptance_rate,
        reject_patterns=json.dumps(reject_patterns),
        flexible_events=json.dumps(flexible_events),
        meeting_details=json.dumps(meeting_details),
        slots_list=json.dumps(slots),
    )
    try:
        return call_agent(prompt, model=PERSONAL_AGENT_MODEL)
    except Exception:
        return {
            "user_id": user_id,
            "slots": [{"datetime": s, "satisfaction": 50, "constraint_type": "free", "notes": "Agent unavailable"} for s in slots],
            "hard_blocks": [],
            "general_notes": "Personal agent unavailable; used neutral fallback evaluation.",
        }
