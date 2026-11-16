from datetime import date
from typing import Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class CalendarUpload(BaseModel):
    raw_ics: str
    filename: Optional[str] = None
    timezone: str = "America/New_York"


class CalendarOverride(BaseModel):
    title: str
    kind: Literal["hard", "soft"]


class PreferenceCreate(BaseModel):
    raw_text: str = Field(min_length=1, max_length=500)


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    duration_minutes: int = Field(default=60, ge=15, le=240)
    start_date: date
    end_date: date
    timezone: str = "America/New_York"
    earliest_hour: int = Field(default=9, ge=0, le=23)
    latest_hour: int = Field(default=21, ge=1, le=24)
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])

    @field_validator("timezone")
    @classmethod
    def known_zone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown time zone") from exc
        return v

    @field_validator("weekdays")
    @classmethod
    def valid_days(cls, v: list[int]) -> list[int]:
        days = sorted(set(v))
        if not days or any(d < 0 or d > 6 for d in days):
            raise ValueError("Pick at least one weekday")
        return days

    @model_validator(mode="after")
    def sane_window(self):
        if self.end_date < self.start_date:
            raise ValueError("The end date is before the start date")
        if (self.end_date - self.start_date).days > 31:
            raise ValueError("Search at most 31 days at a time")
        if self.latest_hour * 60 - self.earliest_hour * 60 < self.duration_minutes:
            raise ValueError("The daily window is shorter than the meeting")
        return self


class EventOut(BaseModel):
    event_id: str
    title: str
    invite_code: str
    status: str
    organizer_id: str
    duration_minutes: int
    start_date: date
    end_date: date
    timezone: str
    earliest_hour: int
    latest_hour: int
    weekdays: list[int]


class RsvpIn(BaseModel):
    response: Literal["accepted", "declined"]
