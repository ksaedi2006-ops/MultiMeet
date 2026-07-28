import json
import os

from anthropic import Anthropic

PERSONAL_AGENT_MODEL = "claude-sonnet-4-6"
MEDIATOR_AGENT_MODEL = "claude-sonnet-4-6"

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def call_agent(system_prompt: str, model: str, max_tokens: int = 1024) -> dict:
    """Call Claude with a system prompt that instructs it to return JSON only, and parse the result."""
    client = get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": "Return the JSON now."}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    return json.loads(text)
