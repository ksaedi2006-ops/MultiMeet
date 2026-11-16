"""Inputs and outputs shared by every agent backend.

Output models double as the JSON schema for structured LLM output, so field
descriptions here are instructions to the model.
"""

from dataclasses import dataclass, field
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.scheduling.rules import PreferenceRule


class AgentError(RuntimeError):
    pass


# ---------- inputs ----------

@dataclass
class SlotView:
    slot_id: str
    label: str
    conflicts: list[str] = field(default_factory=list)  # soft conflicts only; hard ones never reach agents


@dataclass
class PersonView:
    user_id: str
    name: str
    rules: list[PreferenceRule]
    notes: list[str]  # raw things they told their agent
    slots: list[SlotView]


@dataclass
class AskView:
    ask_id: str
    slot_id: str
    label: str
    current_score: int
    conflicts: list[str]
    text: str


@dataclass
class ShortlistView:
    slot_id: str
    label: str
    scores: dict[str, int]  # name -> score
    conflicts: dict[str, list[str]]  # name -> soft conflicts at this slot


@dataclass
class DecisionView:
    title: str
    status: Literal["converged", "escalated"]
    chosen_label: Optional[str]
    scores: dict[str, int]  # name -> score at the chosen slot
    compromises: list[str]  # "Katherine: Gym"
    alternatives: list[str]  # "Tue 2:00 PM (lowest 55)"
    replies: list[str]  # "Jake flexed on Tue 2:00 PM: ..."


# ---------- outputs ----------

class SlotScore(BaseModel):
    slot_id: str
    score: int = Field(ge=0, le=100, description="0 = terrible for this person, 100 = ideal.")
    reason: str = Field(description="At most 12 words, written for the person you represent.")


class ScoreSheet(BaseModel):
    scores: list[SlotScore] = Field(description="One entry for every candidate slot, using its exact slot_id.")
    summary: str = Field(description="One sentence on what you will push for in this negotiation.")


class Ask(BaseModel):
    slot_id: str
    user_id: str
    text: str = Field(description="One sentence addressed to that person's agent, naming the specific thing you ask them to flex on.")


class AskPlan(BaseModel):
    asks: list[Ask]


class Reply(BaseModel):
    ask_id: str
    response: Literal["accept", "flex", "hold"] = Field(
        description="accept: the slot is fine as is. flex: willing to give something up (raise the score). hold: will not move."
    )
    new_score: int = Field(ge=0, le=100, description="Your score for the slot after this reply.")
    text: str = Field(description="One short sentence back to the mediator, in your own voice.")


class ReplySheet(BaseModel):
    replies: list[Reply]


class Explanation(BaseModel):
    explanation: str = Field(description="Two or three plain sentences for the whole group on why this outcome.")
    question: Optional[str] = Field(
        default=None, description="Only when escalated: one specific question the humans need to answer."
    )
