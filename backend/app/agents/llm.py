"""Claude-backed agents using structured output validated by Pydantic."""

import asyncio
import json
import logging
import os
from dataclasses import asdict
from typing import TypeVar

import anthropic
from pydantic import BaseModel

from app.agents import prompts
from app.agents.types import (
    AgentError,
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

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

AGENT_MODEL = os.environ.get("MEETMIND_AGENT_MODEL", "claude-opus-5-5")
MEDIATOR_MODEL = os.environ.get("MEETMIND_MEDIATOR_MODEL", "claude-opus-5-5")
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicAgents:
    name = "anthropic"
    carrier = "CLAUDE"

    def __init__(self, concurrency: int = 6) -> None:
        self._client = anthropic.AsyncAnthropic(timeout=120.0, max_retries=2)
        self._limit = asyncio.Semaphore(concurrency)

    async def _structured(self, *, model: str, system: str, payload: dict, output: type[T], effort: str) -> T:
        async with self._limit:
            try:
                response = await self._client.beta.messages.parse(
                    model=model,
                    max_tokens=16000,
                    system=system,
                    messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
                    output_format=output,
                    output_config={"effort": effort},
                    betas=[FALLBACK_BETA],
                    fallbacks="default",
                )
            except anthropic.APIStatusError as exc:
                log.warning("agent call failed: %s %s", exc.status_code, exc.message)
                raise AgentError(f"Claude API error {exc.status_code}") from exc
            except anthropic.APIConnectionError as exc:
                raise AgentError("Couldn't reach the Claude API") from exc
        if response.stop_reason == "refusal":
            raise AgentError("The model declined this request")
        if response.parsed_output is None:
            raise AgentError(f"Unusable response (stop reason {response.stop_reason})")
        return response.parsed_output

    async def parse_preference(self, text: str) -> ParsedPreference:
        return await self._structured(
            model=AGENT_MODEL, system=prompts.PREFERENCE_PARSER, payload={"message": text},
            output=ParsedPreference, effort="low",
        )

    async def score(self, person: PersonView) -> ScoreSheet:
        payload = {
            "rules": [r.model_dump(exclude_none=True) for r in person.rules],
            "notes": person.notes,
            "slots": [asdict(s) for s in person.slots],
        }
        return await self._structured(
            model=AGENT_MODEL, system=prompts.PERSONAL_SCORER.format(name=person.name), payload=payload,
            output=ScoreSheet, effort="low",
        )

    async def plan_asks(self, title: str, people: dict[str, str], shortlist: list[ShortlistView]) -> AskPlan:
        payload = {"people": [{"user_id": u, "name": n} for u, n in people.items()],
                   "shortlist": [asdict(s) for s in shortlist]}
        return await self._structured(
            model=MEDIATOR_MODEL, system=prompts.MEDIATOR_ASKS.format(title=title), payload=payload,
            output=AskPlan, effort="medium",
        )

    async def reply(self, person: PersonView, asks: list[AskView]) -> ReplySheet:
        payload = {
            "rules": [r.model_dump(exclude_none=True) for r in person.rules],
            "notes": person.notes,
            "asks": [asdict(a) for a in asks],
        }
        return await self._structured(
            model=AGENT_MODEL, system=prompts.PERSONAL_REPLIER.format(name=person.name), payload=payload,
            output=ReplySheet, effort="low",
        )

    async def explain(self, decision: DecisionView) -> Explanation:
        return await self._structured(
            model=MEDIATOR_MODEL, system=prompts.MEDIATOR_EXPLAIN.format(title=decision.title),
            payload=asdict(decision), output=Explanation, effort="low",
        )
