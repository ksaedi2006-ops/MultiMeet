import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    calendar_provider = Column(String, nullable=True)
    calendar_oauth_token = Column(Text, nullable=True)
    calendar_events = Column(JSON, default=list)
    notification_preferences = Column(JSON, default=dict)

    preferences = relationship("UserPreference", back_populates="user")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    parsed_rules = Column(JSON, default=dict)
    strength = Column(String, default="soft")  # hard | soft
    created_at = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)

    user = relationship("User", back_populates="preferences")


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    type = Column(String, default="custom")  # club | study_group | project_team | custom
    created_at = Column(DateTime, default=datetime.utcnow)

    default_duration = Column(Integer, default=60)
    default_location_preference = Column(String, nullable=True)
    recurring_schedule = Column(JSON, nullable=True)
    invite_code = Column(String, unique=True, default=gen_uuid)

    members = relationship("GroupMember", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(String, primary_key=True, default=gen_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # admin | member
    joined_at = Column(DateTime, default=datetime.utcnow)
    ready = Column(Boolean, default=False)

    group = relationship("Group", back_populates="members")


class MeetingRequest(Base):
    __tablename__ = "meeting_requests"

    id = Column(String, primary_key=True, default=gen_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    requested_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=60)

    date_range_start = Column(DateTime, nullable=False)
    date_range_end = Column(DateTime, nullable=False)

    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(JSON, nullable=True)
    location_constraint = Column(String, nullable=True)
    urgency = Column(String, default="normal")  # low | normal | high
    status = Column(String, default="negotiating")  # negotiating | scheduled | cancelled | rescheduled
    created_at = Column(DateTime, default=datetime.utcnow)


class NegotiationSession(Base):
    __tablename__ = "negotiation_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False)
    round_number = Column(Integer, default=1)
    mediator_proposal = Column(JSON, nullable=True)
    status = Column(String, default="active")  # active | converged | escalated
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class AgentResponse(Base):
    __tablename__ = "agent_responses"

    id = Column(String, primary_key=True, default=gen_uuid)
    negotiation_session_id = Column(String, ForeignKey("negotiation_sessions.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    round_number = Column(Integer, default=1)
    slot_evaluations = Column(JSON, default=list)
    hard_blocks = Column(JSON, default=list)
    notes = Column(Text, nullable=True)
    responded_at = Column(DateTime, default=datetime.utcnow)


class MeetingDecision(Base):
    __tablename__ = "meeting_decisions"

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False)
    chosen_datetime = Column(DateTime, nullable=False)
    chosen_location = Column(String, nullable=True)
    explanation = Column(Text, nullable=True)
    satisfaction_breakdown = Column(JSON, default=dict)
    alternatives = Column(JSON, default=list)
    decided_at = Column(DateTime, default=datetime.utcnow)


class MeetingAttendance(Base):
    __tablename__ = "meeting_attendance"

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_decision_id = Column(String, ForeignKey("meeting_decisions.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    rsvp_status = Column(String, default="pending")  # accepted | declined | pending
    actually_attended = Column(Boolean, nullable=True)
    override_reason = Column(Text, nullable=True)


class NudgeLog(Base):
    __tablename__ = "nudge_log"

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    nudge_type = Column(String, default="gentle")  # gentle | specific | escalation
    channel = Column(String, default="in_app")  # in_app | email | sms
    sent_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
