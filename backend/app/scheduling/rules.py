from typing import Literal, Optional

from pydantic import BaseModel, Field

RuleKind = Literal["not_before", "not_after", "avoid_weekdays", "buffer_minutes", "free_text"]
WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class PreferenceRule(BaseModel):
    """One scheduling rule extracted from what a person told their agent."""

    kind: RuleKind = Field(
        description=(
            "not_before: no meetings starting before `time`. not_after: no meetings ending after `time`. "
            "avoid_weekdays: no meetings on `weekdays`. buffer_minutes: keep `minutes` free around other "
            "commitments. free_text: anything that doesn't fit the others."
        )
    )
    strength: Literal["hard", "soft"] = Field(
        description="hard only if the person states it as absolute (never, can't, no exceptions); otherwise soft."
    )
    time: Optional[str] = Field(default=None, description="24h local time HH:MM, for not_before / not_after.")
    weekdays: Optional[list[int]] = Field(default=None, description="0=Monday ... 6=Sunday, for avoid_weekdays.")
    minutes: Optional[int] = Field(default=None, description="For buffer_minutes.")
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
