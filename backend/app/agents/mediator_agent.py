import json

from app.agents.client import call_agent, MEDIATOR_AGENT_MODEL
from app.agents.prompts import MEDIATOR_SYSTEM_PROMPT


def mediate(meeting_details: dict, agent_responses: list[dict]) -> dict:
    """Run the Mediator Agent to aggregate Personal Agent responses into a decision."""
    prompt = MEDIATOR_SYSTEM_PROMPT.format(
        meeting_details=json.dumps(meeting_details),
        all_personal_agent_responses_json=json.dumps(agent_responses),
    )
    try:
        return call_agent(prompt, model=MEDIATOR_AGENT_MODEL, max_tokens=4096)
    except Exception:
        return _fallback_mediate(agent_responses)


def _fallback_mediate(agent_responses: list[dict]) -> dict:
    """Pick the slot with highest average satisfaction across personal agent responses, without calling the LLM."""
    satisfaction_by_slot: dict[str, list[float]] = {}
    for resp in agent_responses:
        for slot in resp.get("slots", []):
            satisfaction_by_slot.setdefault(slot["datetime"], []).append(slot.get("satisfaction", 0))

    if not satisfaction_by_slot:
        return {
            "chosen_datetime": None,
            "chosen_location": None,
            "explanation": "Mediator agent unavailable and no candidate slots to fall back on.",
            "satisfaction_breakdown": {},
            "alternatives": [],
            "status": "escalated",
        }

    averages = {dt: sum(vals) / len(vals) for dt, vals in satisfaction_by_slot.items()}
    chosen_datetime = max(averages, key=averages.get)
    satisfaction_breakdown = {
        resp.get("user_id", "unknown"): slot.get("satisfaction", 0)
        for resp in agent_responses
        for slot in resp.get("slots", [])
        if slot["datetime"] == chosen_datetime
    }
    alternatives = sorted(
        ({"datetime": dt, "avg_satisfaction": avg} for dt, avg in averages.items() if dt != chosen_datetime),
        key=lambda a: -a["avg_satisfaction"],
    )[:3]

    return {
        "chosen_datetime": chosen_datetime,
        "chosen_location": None,
        "explanation": "Mediator agent unavailable — chose the slot with the highest average satisfaction across personal agent evaluations as a fallback.",
        "satisfaction_breakdown": satisfaction_breakdown,
        "alternatives": alternatives,
        "status": "converged" if averages[chosen_datetime] >= 50 else "escalated",
    }
