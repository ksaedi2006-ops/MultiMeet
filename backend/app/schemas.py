from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    name: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    calendar_provider: Optional[str] = None

    class Config:
        from_attributes = True


class CalendarUpload(BaseModel):
    raw_ics: str


class PreferenceCreate(BaseModel):
    raw_text: str


class PreferenceOut(BaseModel):
    id: str
    raw_text: str
    parsed_rules: dict[str, Any]
    strength: str
    active: bool

    class Config:
        from_attributes = True


class EventCreate(BaseModel):
    title: str


class EventOut(BaseModel):
    event_id: str
    group_id: str
    title: str
    invite_code: str
    status: str


class GroupCreate(BaseModel):
    name: str
    type: str = "custom"
    default_duration: int = 60


class GroupOut(BaseModel):
    id: str
    name: str
    type: str
    invite_code: str

    class Config:
        from_attributes = True


class MeetingRequestCreate(BaseModel):
    group_id: str
    title: str
    duration_minutes: int = 60
    date_range_start: datetime
    date_range_end: datetime
    is_recurring: bool = False
    location_constraint: Optional[str] = None
    urgency: str = "normal"


class SlotEvaluation(BaseModel):
    datetime: str
    satisfaction: int
    constraint_type: str
    notes: str


class AgentResponseOut(BaseModel):
    user_id: str
    slots: list[SlotEvaluation]
    hard_blocks: list[str]
    general_notes: str


class MediatorDecision(BaseModel):
    chosen_datetime: Optional[str] = None
    chosen_location: Optional[str] = None
    explanation: str
    satisfaction_breakdown: dict[str, int]
    alternatives: list[dict[str, Any]] = []
    status: str  # converged | escalated
