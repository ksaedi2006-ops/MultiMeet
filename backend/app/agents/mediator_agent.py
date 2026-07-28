import json

from app.agents.client import call_agent, MEDIATOR_AGENT_MODEL
from app.agents.prompts import MEDIATOR_SYSTEM_PROMPT


def mediate(meeting_details: dict, agent_responses: list[dict]) -> dict:
    """Run the Mediator Agent to aggregate Personal Agent responses into a decision."""
    prompt = MEDIATOR_SYSTEM_PROMPT.format(
        meeting_details=json.dumps(meeting_details),
        all_personal_agent_responses_json=json.dumps(agent_responses),
    )
    return call_agent(prompt, model=MEDIATOR_AGENT_MODEL, max_tokens=2048)
