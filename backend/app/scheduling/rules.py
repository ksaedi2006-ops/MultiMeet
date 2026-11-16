from typing import Literal, Optional

from pydantic import BaseModel, Field

RuleKind = Literal[
    "not_before", "not_after", "avoid_weekdays", "buffer_minutes", "free_text",
    # Preference-shape rules (docs/research/negotiation-layer.md, "Elicitation: rules, not scores").
    # They only ever shape utilities; the hard-constraint filter ignores them.
    "time_of_day", "day_weights", "max_per_day",
]
WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class PreferenceRule(BaseModel):
    """One scheduling rule extracted from what a person told their agent."""

    kind: RuleKind = Field(
        description=(
            "not_before: no meetings starting before `time`. not_after: no meetings ending after `time`. "
            "avoid_weekdays: no meetings on `weekdays`. buffer_minutes: keep `minutes` free around other "
            "commitments. time_of_day: an ideal meeting time `time` with tolerance `width_minutes`. "
            "day_weights: how good each weekday is, `day_weights[0..6]` from 0 (worst) to 1 (fine). "
            "max_per_day: at most `max_count` commitments on a day. "
            "free_text: anything that doesn't fit the others."
        )
    )
    strength: Literal["hard", "soft"] = Field(
        description="hard only if the person states it as absolute (never, can't, no exceptions); otherwise soft."
    )
    time: Optional[str] = Field(default=None, description="24h local time HH:MM, for not_before / not_after.")
    weekdays: Optional[list[int]] = Field(
        default=None,
        description=(
            "0=Monday ... 6=Sunday. Required for avoid_weekdays. For not_before / not_after, set it only "
            "when the rule applies to specific days (e.g. 'Fridays after 3pm' -> [4]); omit it for every day."
        ),
    )
    minutes: Optional[int] = Field(default=None, description="For buffer_minutes.")
    width_minutes: Optional[int] = Field(
        default=None, description="For time_of_day: how far from the ideal time is still fine, in minutes (default 120)."
    )
    day_weights: Optional[list[float]] = Field(
        default=None, description="For day_weights: seven numbers, Monday first, 0 = worst day, 1 = fine."
    )
    max_count: Optional[int] = Field(default=None, description="For max_per_day: the most commitments wanted on one day.")
    weight: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="How much this soft rule matters, 0 to 1. Leave empty unless the person says how strongly they feel.",
    )
    flex_floor: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="The lowest weight the person would let their agent concede to in a negotiation. Leave empty if unsaid.",
    )
    summary: str = Field(description="Short label for the rule as the person would read it, e.g. 'Nothing before 11:00'.")


class ParsedPreference(BaseModel):
    rules: list[PreferenceRule]
    ack: str = Field(description="One short first-person sentence from the agent confirming what it will do.")


def parse_hhmm(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    try:
        h, m = value.split(":")
        h, m = int(h), int(m)
    except ValueError:
        return None
    if 0 <= h <= 24 and 0 <= m < 60:
        return h, m
    return None
