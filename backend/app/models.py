import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Busy intervals parsed from the person's .ics upload (see scheduling.ics.BusyInterval).
    calendar = Column(JSON, default=list)
    # Title -> "hard" | "soft", set when the person reclassifies an event.
    calendar_overrides = Column(JSON, default=dict)
    calendar_filename = Column(String, nullable=True)
    calendar_uploaded_at = Column(DateTime(timezone=True), nullable=True)

    preferences = relationship("UserPreference", back_populates="user")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    raw_text = Column(Text, nullable=False)
    rules = Column(JSON, default=list)  # list of scheduling.rules.PreferenceRule dicts
    ack = Column(Text, nullable=True)
    parse_ok = Column(Boolean, default=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="preferences")


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, default=gen_uuid)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    members = relationship("GroupMember", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # admin | member
    ready = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    group = relationship("Group", back_populates="members")


class MeetingRequest(Base):
    """An event being scheduled. One group, one negotiation."""

    __tablename__ = "meeting_requests"

    id = Column(String, primary_key=True, default=gen_uuid)
    group_id = Column(String, ForeignKey("groups.id"), nullable=False)
    requested_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=60)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    timezone = Column(String, nullable=False, default="America/New_York")
    earliest_hour = Column(Integer, default=9)
    latest_hour = Column(Integer, default=21)
    weekdays = Column(JSON, default=lambda: [0, 1, 2, 3, 4])
    # open | negotiating | scheduled | escalated | failed
    status = Column(String, default="open")
    created_at = Column(DateTime(timezone=True), default=utcnow)


class NegotiationSession(Base):
    __tablename__ = "negotiation_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    # Unique: an event can only ever be negotiated once, even if two people press Start.
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False, unique=True)
    status = Column(String, default="running")  # running | converged | escalated | failed
    agent_backend = Column(String, nullable=False)  # anthropic | simulated
    error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class NegotiationEvent(Base):
    """Append-only log of everything that happened to an event, replayable by sequence number."""

    __tablename__ = "negotiation_events"
    __table_args__ = (UniqueConstraint("meeting_request_id", "seq"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    # Fields only the owner may see (their own agent's reasoning). Stripped for everyone else.
    owner_id = Column(String, nullable=True)
    private = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class MeetingDecision(Base):
    __tablename__ = "meeting_decisions"

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False, unique=True)
    status = Column(String, nullable=False)  # converged | escalated
    slot_id = Column(String, nullable=True)
    start = Column(DateTime(timezone=True), nullable=True)
    end = Column(DateTime(timezone=True), nullable=True)
    label = Column(String, nullable=True)
    explanation = Column(Text, nullable=True)
    question = Column(Text, nullable=True)  # what humans need to answer when escalated
    scores = Column(JSON, default=dict)  # user_id -> score at the chosen slot
    compromises = Column(JSON, default=list)
    alternatives = Column(JSON, default=list)
    decided_at = Column(DateTime(timezone=True), default=utcnow)


class Rsvp(Base):
    __tablename__ = "rsvps"
    __table_args__ = (UniqueConstraint("meeting_request_id", "user_id"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    meeting_request_id = Column(String, ForeignKey("meeting_requests.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    response = Column(String, nullable=False)  # accepted | declined
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
