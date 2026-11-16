import os
from functools import lru_cache
from typing import Protocol

from app.agents.types import (
    AskPlan,
    AskView,
    DecisionView,
    Explanation,
    PersonView,
    ReplySheet,
    ScoreSheet,
    ShortlistView,
)
from app.scheduling.rules import ParsedPreference


class Agents(Protocol):
    """Everything the negotiation needs from an agent provider.

    `carrier` is shown on each agent's data tag in the UI, so a later mix of
    providers is visible at a glance.
    """

    name: str
    carrier: str

    async def parse_preference(self, text: str) -> ParsedPreference: ...
    async def score(self, person: PersonView) -> ScoreSheet: ...
    async def plan_asks(self, title: str, people: dict[str, str], shortlist: list[ShortlistView]) -> AskPlan: ...
    async def reply(self, person: PersonView, asks: list[AskView]) -> ReplySheet: ...
    async def explain(self, decision: DecisionView) -> Explanation: ...


@lru_cache(maxsize=1)
def get_agents() -> Agents:
    """MEETMIND_AGENTS=anthropic|simulated; defaults to Claude when an API key is set."""
    choice = os.environ.get("MEETMIND_AGENTS", "auto").lower()
    if choice == "auto":
        choice = "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "simulated"
    if choice == "anthropic":
        from app.agents.llm import AnthropicAgents
        return AnthropicAgents()
    from app.agents.simulated import SimulatedAgents
    return SimulatedAgents()
