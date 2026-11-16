"""The negotiation protocol.

1. Filter: code closes every slot someone has a hard conflict with.
2. Round 1: every personal agent scores the open slots, in parallel.
3. Shortlist: code ranks slots by fairness (best worst-off person, then average).
4. Rounds 2-3: the mediator asks specific low scorers to flex on shortlisted slots;
   their agents accept, flex (raise their score) or hold. Re-rank after each round.
5. Decide: converge on the fairest slot, or escalate to the humans with a question.

Every step is appended to the event log, which is what the live view renders.
"""

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models
from app.agents import Agents
from app.agents.simulated import SimulatedAgents
from app.agents.types import AgentError, AskView, DecisionView, PersonView, ShortlistView, SlotView
from app.bus import bus
from app.database import SessionLocal
from app.scheduling.availability import HARD, Assessment, assess_slot
from app.scheduling.fairness import COMFORT, RankedSlot, rank_slots
from app.scheduling.ics import BusyInterval
from app.scheduling.rules import PreferenceRule
from app.scheduling.slots import Slot, generate_slots

log = logging.getLogger(__name__)

CLEAN_APPROACH = 75  # if the best slot already has everyone at or above this, skip asks
ESCALATE_BELOW = 40  # a final choice leaving someone below this goes back to the humans
ASK_THRESHOLD = 70

_tasks: set[asyncio.Task] = set()
_sim = SimulatedAgents()


@dataclass
class Participant:
    user_id: str
    name: str
    intervals: list[BusyInterval]
    rules: list[PreferenceRule]
    notes: list[str]


def load_participant(db: Session, user: models.User) -> Participant:
    overrides = user.calendar_overrides or {}
    intervals = []
    for raw in user.calendar or []:
        iv = BusyInterval.from_dict(raw)
        if iv.title in overrides:
            iv = BusyInterval(iv.start, iv.end, iv.title, overrides[iv.title], iv.all_day)
        intervals.append(iv)
    prefs = (
        db.query(models.UserPreference)
        .filter(models.UserPreference.user_id == user.id, models.UserPreference.active.is_(True))
        .order_by(models.UserPreference.created_at)
        .all()
    )
    rules = [PreferenceRule.model_validate(r) for p in prefs for r in (p.rules or [])]
    return Participant(user.id, user.name, intervals, rules, [p.raw_text for p in prefs])


def event_slots(meeting: models.MeetingRequest, now: datetime | None = None) -> list[Slot]:
    now = now or datetime.now(timezone.utc)
    return generate_slots(
        start_date=meeting.start_date,
        end_date=meeting.end_date,
        tz=meeting.timezone,
        duration_minutes=meeting.duration_minutes,
        earliest_hour=meeting.earliest_hour,
        latest_hour=meeting.latest_hour,
        weekdays=frozenset(meeting.weekdays or range(7)),
        not_before=now + timedelta(hours=1),
    )


async def launch_negotiation(db: Session, meeting: models.MeetingRequest, agents: Agents) -> bool:
    """Open the one negotiation this event may have and run it. False if it already started."""
    from sqlalchemy.exc import IntegrityError

    if meeting.status != "open":
        return False
    db.add(models.NegotiationSession(meeting_request_id=meeting.id, agent_backend=agents.name))
    meeting.status = "negotiating"
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    start_negotiation(meeting.id, agents)
    return True


def start_negotiation(meeting_id: str, agents: Agents) -> None:
    task = asyncio.create_task(run_negotiation(meeting_id, agents))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def run_negotiation(meeting_id: str, agents: Agents) -> None:
    db = SessionLocal()
    try:
        await Negotiation(db, meeting_id, agents).run()
    except Exception as exc:  # anything unexpected must still end the negotiation visibly
        log.exception("negotiation %s failed", meeting_id)
        db.rollback()
        session = db.query(models.NegotiationSession).filter_by(meeting_request_id=meeting_id).one_or_none()
        meeting = db.get(models.MeetingRequest, meeting_id)
        if session:
            session.status, session.error, session.completed_at = "failed", str(exc), datetime.now(timezone.utc)
        if meeting:
            meeting.status = "failed"
        db.commit()
        await bus.emit(db, meeting_id, "negotiation_failed", {"error": "The negotiation hit an internal error."})
    finally:
        db.close()


class Negotiation:
    def __init__(self, db: Session, meeting_id: str, agents: Agents) -> None:
        self.db = db
        self.meeting = db.get(models.MeetingRequest, meeting_id)
        self.session = db.query(models.NegotiationSession).filter_by(meeting_request_id=meeting_id).one()
        self.agents = agents
        self.people: dict[str, Participant] = {}
        self.slots: dict[str, Slot] = {}
        self.assessments: dict[str, dict[str, Assessment]] = {}
        self.open_ids: list[str] = []
        self.scores: dict[str, dict[str, int]] = {}
        self.flexed: dict[str, set[str]] = defaultdict(set)  # slot_id -> user_ids who flexed
        self.replies: list[str] = []

    async def emit(self, type_: str, payload: dict, **kw) -> None:
        await bus.emit(self.db, self.meeting.id, type_, payload, **kw)

    def name(self, uid: str) -> str:
        return self.people[uid].name

    # ---------- protocol ----------

    async def run(self) -> None:
        members = (
            self.db.query(models.GroupMember)
            .filter_by(group_id=self.meeting.group_id, ready=True)
            .order_by(models.GroupMember.joined_at)
            .all()
        )
        for m in members:
            user = self.db.get(models.User, m.user_id)
            self.people[user.id] = load_participant(self.db, user)
        slot_list = event_slots(self.meeting)
        self.slots = {s.id: s for s in slot_list}

        await self.emit("negotiation_started", {
            "participants": [{"user_id": p.user_id, "name": p.name, "carrier": self.agents.carrier}
                             for p in self.people.values()],
            "slots": [s.to_dict() for s in slot_list],
            "timezone": self.meeting.timezone,
            "agent_backend": self.agents.name,
        })

        self.filter_slots()
        await self.emit("slots_closed", {
            "closed": [
                {"slot_id": sid, "blockers": [
                    {"user_id": uid, "name": self.name(uid), "reason": self.assessments[uid][sid].blocker}
                    for uid in self.people if self.assessments[uid][sid].status == HARD
                ]}
                for sid in self.slots if sid not in self.open_ids
            ],
            "open": self.open_ids,
        })
        if not self.open_ids:
            await self.decide(None, [])
            return

        await self.emit("round_started", {"round": 1, "kind": "score"})
        await self.score_round()
        ranked = rank_slots(self.open_ids, self.scores)
        await self.emit("shortlist", {"round": 1, "ranked": [r.to_dict() for r in ranked[:3]]})

        if ranked[0].min_score < CLEAN_APPROACH:
            for rnd, width in ((2, 3), (3, 2)):
                asked = await self.ask_round(rnd, ranked[:width])
                if not asked:
                    break
                ranked = rank_slots(self.open_ids, self.scores)
                await self.emit("shortlist", {"round": rnd, "ranked": [r.to_dict() for r in ranked[:3]]})
                if ranked[0].everyone_comfortable:
                    break

        best = ranked[0]
        await self.decide(best if best.min_score >= ESCALATE_BELOW else None, ranked)

    def filter_slots(self) -> None:
        tz = self.meeting.timezone
        for uid, person in self.people.items():
            self.assessments[uid] = {
                sid: assess_slot(slot, person.intervals, person.rules, tz) for sid, slot in self.slots.items()
            }
        self.open_ids = [
            sid for sid in self.slots if all(self.assessments[uid][sid].status != HARD for uid in self.people)
        ]

    def person_view(self, uid: str) -> PersonView:
        p = self.people[uid]
        soft_rules = [r for r in p.rules if r.strength == "soft" or r.kind == "free_text"]
        return PersonView(
            user_id=uid, name=p.name, rules=soft_rules, notes=p.notes,
            slots=[SlotView(sid, self.slots[sid].local_label, self.soft_conflicts(uid, sid)) for sid in self.open_ids],
        )

    def soft_conflicts(self, uid: str, sid: str) -> list[str]:
        return [c.reason for c in self.assessments[uid][sid].conflicts if c.severity == "soft"]

    async def score_round(self) -> None:
        for uid in self.people:
            await self.emit("agent_thinking", {"user_id": uid, "round": 1})

        async def one(uid: str):
            view = self.person_view(uid)
            try:
                return uid, await self.agents.score(view), None
            except AgentError as exc:
                return uid, await _sim.score(view), str(exc)

        for coro in asyncio.as_completed([one(uid) for uid in self.people]):
            uid, sheet, error = await coro
            if error:
                await self.emit("agent_failed", {"user_id": uid, "round": 1, "error": error, "fallback": "SIM"})
            given = {s.slot_id: s for s in sheet.scores if s.slot_id in self.slots}
            row, reasons = {}, {}
            for sid in self.open_ids:
                if sid in given:
                    row[sid], reasons[sid] = given[sid].score, given[sid].reason
                else:  # the model skipped a slot; treat it as neutral and say so
                    row[sid], reasons[sid] = 50, "Not scored"
            self.scores[uid] = row
            await self.emit(
                "agent_scored",
                {"user_id": uid, "round": 1, "scores": row, "summary": sheet.summary, "fallback": bool(error)},
                owner_id=uid, private={"reasons": reasons},
            )

    async def ask_round(self, rnd: int, targets: list[RankedSlot]) -> bool:
        target_ids = [t.slot_id for t in targets]
        await self.emit("round_started", {"round": rnd, "kind": "asks", "slot_ids": target_ids})
        shortlist = [
            ShortlistView(
                slot_id=t.slot_id, label=self.slots[t.slot_id].local_label,
                scores={self.name(u): s for u, s in t.scores.items()},
                conflicts={self.name(u): self.soft_conflicts(u, t.slot_id) for u in self.people},
            )
            for t in targets
        ]
        people = {uid: p.name for uid, p in self.people.items()}
        try:
            plan = await self.agents.plan_asks(self.meeting.title, people, shortlist)
        except AgentError:
            plan = await _sim.plan_asks(self.meeting.title, people, shortlist)

        per_slot: dict[str, int] = defaultdict(int)
        asks: dict[str, list[AskView]] = defaultdict(list)
        seen = set()
        for i, ask in enumerate(plan.asks):
            uid, sid = ask.user_id, ask.slot_id
            if (sid not in target_ids or uid not in self.people or (uid, sid) in seen
                    or self.scores[uid][sid] >= ASK_THRESHOLD or per_slot[sid] >= 2):
                continue
            seen.add((uid, sid))
            per_slot[sid] += 1
            view = AskView(f"r{rnd}-{i}", sid, self.slots[sid].local_label, self.scores[uid][sid],
                           self.soft_conflicts(uid, sid), ask.text)
            asks[uid].append(view)
            await self.emit("mediator_ask", {
                "round": rnd, "ask_id": view.ask_id, "slot_id": sid,
                "to_user_id": uid, "to_name": self.name(uid), "text": ask.text,
            })
        if not asks:
            return False

        for uid in asks:
            await self.emit("agent_thinking", {"user_id": uid, "round": rnd})

        async def one(uid: str):
            view = self.person_view(uid)
            try:
                return uid, await self.agents.reply(view, asks[uid])
            except AgentError:
                return uid, await _sim.reply(view, asks[uid])

        for coro in asyncio.as_completed([one(uid) for uid in asks]):
            uid, sheet = await coro
            by_id = {a.ask_id: a for a in asks[uid]}
            answered = set()
            for reply in sheet.replies:
                ask = by_id.get(reply.ask_id)
                if ask is None or ask.ask_id in answered:
                    continue
                answered.add(ask.ask_id)
                await self.apply_reply(rnd, uid, ask, reply.response, reply.new_score, reply.text)
            for ask in asks[uid]:
                if ask.ask_id not in answered:
                    await self.apply_reply(rnd, uid, ask, "hold", ask.current_score, "No answer.")
        return True

    async def apply_reply(self, rnd: int, uid: str, ask: AskView, response: str, new: int, text: str) -> None:
        old = ask.current_score
        new = old if response == "hold" else max(old, min(100, new))
        self.scores[uid][ask.slot_id] = new
        if response == "flex" and new > old:
            self.flexed[ask.slot_id].add(uid)
        self.replies.append(f"{self.name(uid)} answered '{response}' on {ask.label}: {text}")
        await self.emit("agent_reply", {
            "round": rnd, "ask_id": ask.ask_id, "user_id": uid, "slot_id": ask.slot_id,
            "response": response, "old_score": old, "new_score": new, "text": text,
        })

    async def decide(self, best: RankedSlot | None, ranked: list[RankedSlot]) -> None:
        status = "converged" if best else "escalated"
        compromises = []
        if best:
            for uid in self.people:
                conflicts = self.soft_conflicts(uid, best.slot_id)
                score = best.scores[uid]
                if conflicts or score < COMFORT or uid in self.flexed[best.slot_id]:
                    gave_up = ", ".join(c.removeprefix("Rule: ") for c in conflicts) or "a preferred time"
                    compromises.append({"user_id": uid, "name": self.name(uid), "gave_up": gave_up, "score": score})
        alternatives = [
            {"slot_id": r.slot_id, "label": self.slots[r.slot_id].local_label,
             "min_score": r.min_score, "avg_score": round(r.avg_score, 1)}
            for r in ranked if not best or r.slot_id != best.slot_id
        ][:3]

        view = DecisionView(
            title=self.meeting.title, status=status,
            chosen_label=self.slots[best.slot_id].local_label if best else None,
            scores={self.name(u): s for u, s in (best.scores if best else {}).items()},
            compromises=[f"{c['name']}: {c['gave_up']}" for c in compromises],
            alternatives=[f"{a['label']} (lowest {a['min_score']})" for a in alternatives],
            replies=self.replies,
        )
        try:
            words = await self.agents.explain(view)
        except AgentError:
            words = await _sim.explain(view)

        slot = self.slots[best.slot_id] if best else None
        self.db.add(models.MeetingDecision(
            meeting_request_id=self.meeting.id, status=status,
            slot_id=slot.id if slot else None, start=slot.start if slot else None,
            end=slot.end if slot else None, label=slot.local_label if slot else None,
            explanation=words.explanation, question=words.question if not best else None,
            scores=best.scores if best else {}, compromises=compromises, alternatives=alternatives,
        ))
        self.meeting.status = "scheduled" if best else "escalated"
        self.session.status = status
        self.session.completed_at = datetime.now(timezone.utc)
        self.db.commit()
        await self.emit("decision", {
            "status": status,
            "slot": slot.to_dict() if slot else None,
            "scores": best.scores if best else {},
            "min_score": best.min_score if best else None,
            "avg_score": round(best.avg_score, 1) if best else None,
            "compromises": compromises,
            "alternatives": alternatives,
            "explanation": words.explanation,
            "question": words.question if not best else None,
        })
