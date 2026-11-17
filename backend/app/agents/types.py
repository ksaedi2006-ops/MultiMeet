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
    # The solver's actual reason (protocol.Binding). An explanation must name `decisive`.
    runner_up_label: Optional[str] = None
    decisive: Optional[str] = None  # name of the person the runner-up would cost most
    decisive_reason: Optional[str] = None  # what it would cost them, e.g. "Gym"
    bottleneck: Optional[str] = None  # name of the person this time serves least
    tied_labels: list[str] = field(default_factory=list)  # identical for everyone; the earlier date won


@dataclass
class AskRenderView:
    """What the mediator LLM gets: a decision already made by the solver, to put into words."""

    title: str
    to_name: str
    rule_label: str  # what they're asked to bend, e.g. "Gym" or "Nothing before 10:00"
    target_label: str  # the slot the concession would unlock
    draft_label: Optional[str]  # the current draft
    rule_kind: str = "rule"  # "event" for a movable commitment, otherwise the rule kind


@dataclass
class MoveView:
    """What a personal agent gets when asked to concede. Shortlist display order is
    shuffled per agent; solver_rank carries the real order."""

    user_id: str
    name: str
    ask_id: str
    ask_text: str
    rule_id: str
    rule_label: str
    current_weight: float
    floor: float  # the lowest weight the person allowed; code rejects anything below
    target_slot_id: str
    target_label: str
    target_hurts: bool  # does the asked rule actually cost them anything at the target?
    shortlist: list[dict]  # [{"slot_id", "label", "solver_rank"}] in this agent's display order
    rules: list[PreferenceRule]
    notes: list[str]
    rule_kind: str = "rule"  # "event" for a movable commitment, otherwise the rule kind


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


class AgentMove(BaseModel):
    """Exactly one structured move. Only these fields reach the solver; `text` never does."""

    move: Literal["accept", "flex", "hold"] = Field(
        description="accept: the target time is fine. flex: lower the weight of the asked rule. hold: keep it."
    )
    rule_id: Optional[str] = Field(default=None, description="For flex: the rule_id you are lowering.")
    new_weight: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="For flex: the new weight, below the current weight and not below the floor.",
    )
    text: str = Field(description="One short sentence back to the mediator, in your own voice.")


class Explanation(BaseModel):
    explanation: str = Field(description="Two plain sentences on why this time won, without restating the time, compromises or fallbacks.")
    question: Optional[str] = Field(
        default=None, description="Only when escalated: one specific question the humans need to answer."
    )
