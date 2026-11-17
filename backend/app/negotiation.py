"""The negotiation, run as a background task and recorded on the event log.

The solver decides; agents only translate and concede; the mediator LLM only talks.
See docs/research/negotiation-layer.md and app/scheduling/protocol.py.

1. Filter: code closes every slot someone has a hard conflict with (unchanged).
2. Utilities: code computes each person's utility for every open slot from their rules
   and movable commitments, and normalizes it (Borda by default). No agent emits a score.
3. Draft: the solver picks the Nash-product optimum (eps floor, leximin ties) and a
   shortlist, and names the bottleneck person.
4. Up to 3 rounds: the mediator asks the one concession that would raise the Nash product
   most; that person's agent answers accept, flex(rule, new weight) or hold. Code enforces
   monotonic concession inside the person's declared flexibility.
5. Decide: the solver's argmax on the final reports. The mediator explains it, and a
   faithfulness check confirms the explanation names the solver's real reason.

Every step is appended to the event log, which is what the live view renders. Event names
and every field the frontend reads are unchanged; new information is in additive fields.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models
from app.agents import Agents
from app.agents.simulated import SimulatedAgents
from app.agents.types import AgentError, AskRenderView, DecisionView, MoveView
from app.bus import bus
from app.database import SessionLocal
from app.scheduling.availability import HARD, Assessment, assess_slot
from app.scheduling.fairness import COMFORT
from app.scheduling.protocol import (
    MAX_ROUNDS,
    AgentState,
    Draft,
    Move,
    Request,
    Solver,
    apply_move,
    binding_reason,
    display_shortlist,
    faithful,
    next_request,
)
from app.scheduling.normalize import normalize
from app.scheduling.selector import (
    approval_select,
    borda_select,
    leximin_select,
    nash_welfare,
    pareto_dominator,
    utilitarian_select,
)
from app.scheduling.utility import build_model
from app.scheduling.ics import BusyInterval
from app.scheduling.rules import PreferenceRule
from app.scheduling.slots import Slot, generate_slots

log = logging.getLogger(__name__)

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


SELECTOR = "nash"
# Ranks overall, real intensity among each person's top choices: the default chosen by the
# preregistered rule in docs/eval/preregistration.md, Amendment 3.
NORMALIZATION = os.environ.get("MULTIMEET_NORMALIZATION") or os.environ.get("MEETMIND_NORMALIZATION") or "topk"
_floor = os.environ.get("MEETMIND_FAIRNESS_FLOOR")
FAIRNESS_FLOOR = float(_floor) if _floor else None  # optional tau; off unless configured


def _pct(x: float) -> int:
    return int(round(100 * max(0.0, min(1.0, x))))


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
        self.states: list[AgentState] = []
        self.solver: Solver | None = None
        self.draft: Draft | None = None
        self.concessions: list[dict] = []
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
            "selector": SELECTOR,
            "normalization": NORMALIZATION,
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
            await self.decide()
            return

        await self.emit("round_started", {"round": 1, "kind": "score"})
        for uid in self.people:
            await self.emit("agent_thinking", {"user_id": uid, "round": 1})
        self.build_reports()
        self.draft = self.solver.solve(self.states)
        for st in self.states:
            await self.emit_scores(st.user_id)
        await self.emit_shortlist(1)

        for rnd in range(2, 2 + MAX_ROUNDS):
            request = next_request(self.states, self.solver, self.draft)
            if request is None:
                break  # no concession inside anyone's range would improve the draft
            conceded = await self.concession_round(rnd, request)
            await self.emit_shortlist(rnd)
            if not conceded:
                break

        await self.decide()

    def filter_slots(self) -> None:
        tz = self.meeting.timezone
        for uid, person in self.people.items():
            self.assessments[uid] = {
                sid: assess_slot(slot, person.intervals, person.rules, tz) for sid, slot in self.slots.items()
            }
        self.open_ids = [
            sid for sid in self.slots if all(self.assessments[uid][sid].status != HARD for uid in self.people)
        ]

    def build_reports(self) -> None:
        open_slots = {sid: self.slots[sid] for sid in self.open_ids}
        tz = self.meeting.timezone
        self.states = [
            AgentState(uid, build_model(uid, open_slots, p.intervals, p.rules, tz))
            for uid, p in self.people.items()
        ]
        self.solver = Solver(self.open_ids, scheme=NORMALIZATION, tau=FAIRNESS_FLOOR)

    def state(self, uid: str) -> AgentState:
        return next(st for st in self.states if st.user_id == uid)

    def score(self, uid: str, sid: str) -> int:
        return _pct(self.draft.utilities[uid][sid])

    def summary(self, uid: str) -> str:
        """What this person's agent is weighing, from their rules: code, not the LLM."""
        model = self.state(uid).model
        hurts = sorted(
            ((sum(c.penalties.get(s, 0.0) for s in self.open_ids) * c.weight, c.label) for c in model.criteria),
            reverse=True,
        )
        labels = [label.removeprefix("Rule: ") for w, label in hurts if w > 0][:2]
        if not labels:
            return "Wide open this week; most times work for me."
        return "Weighing " + " and ".join(lbl.lower() if not lbl[:1].isupper() or " " in lbl else lbl
                                          for lbl in labels) + "."

    def reason(self, uid: str, sid: str) -> str:
        worst = self.state(uid).model.worst_criterion(sid)
        if worst is None:
            return "Clear for me"
        return f"Clashes with {worst.label}" if worst.kind == "event" else f"Bends: {worst.label}"

    async def emit_scores(self, uid: str) -> None:
        row = {sid: self.score(uid, sid) for sid in self.open_ids}
        await self.emit(
            "agent_scored",
            {"user_id": uid, "round": 1, "scores": row, "summary": self.summary(uid), "fallback": False,
             "source": "rules", "normalization": NORMALIZATION,
             "utilities": {sid: round(self.draft.utilities[uid][sid], 4) for sid in self.open_ids}},
            owner_id=uid, private={"reasons": {sid: self.reason(uid, sid) for sid in self.open_ids}},
        )

    def ranked_info(self, sid: str, rank: int) -> dict:
        scores = {uid: self.score(uid, sid) for uid in self.people}
        g = {uid: self.draft.utilities[uid][sid] - self.draft.d[uid] for uid in self.people}
        return {
            "slot_id": sid,
            "min_score": min(scores.values()),
            "avg_score": round(sum(scores.values()) / len(scores), 1),
            "scores": scores,
            "unhappy": sorted((u for u, s in scores.items() if s < COMFORT), key=lambda u: scores[u]),
            "rank": rank,
            "nash": round(self.draft.selection.objective.get(sid, 0.0), 4),
            "bottleneck": min(g, key=g.get),
        }

    async def emit_shortlist(self, rnd: int) -> None:
        sel = self.draft.selection
        await self.emit("shortlist", {
            "round": rnd,
            "ranked": [self.ranked_info(sid, i + 1) for i, sid in enumerate(self.draft.shortlist)],
            "selector": SELECTOR,
            "draft_slot_id": sel.slot_id,
            "status": sel.status,
            "bottleneck": sel.bottleneck,
        })

    async def concession_round(self, rnd: int, req: Request) -> bool:
        uid = req.user_id
        await self.emit("round_started", {"round": rnd, "kind": "asks", "slot_ids": [req.target]})
        title = self.meeting.title
        target_label = self.slots[req.target].local_label
        draft_label = self.slots[req.draft].local_label if req.draft else None
        kind = self.state(uid).model.criterion(req.rule_id)
        render = AskRenderView(title, self.name(uid), req.rule_label, target_label, draft_label,
                               rule_kind=kind.kind if kind else "rule")
        try:
            text = await self.agents.render_ask(render)
        except AgentError:
            text = await _sim.render_ask(render)
        ask_id = f"r{rnd}-0"
        await self.emit("mediator_ask", {
            "round": rnd, "ask_id": ask_id, "slot_id": req.target,
            "to_user_id": uid, "to_name": self.name(uid), "text": text,
            "rule_id": req.rule_id, "rule_label": req.rule_label,
            "current_weight": round(req.current_weight, 3), "floor": round(req.floor, 3),
            "zeuthen_gain": round(req.gain, 4), "draft_slot_id": req.draft, "reason_code": req.reason_code,
        })
        await self.emit("agent_thinking", {"user_id": uid, "round": rnd})

        st = self.state(uid)
        crit = st.model.criterion(req.rule_id)
        person = self.people[uid]
        view = MoveView(
            user_id=uid, name=person.name, ask_id=ask_id, ask_text=text, rule_id=req.rule_id,
            rule_label=req.rule_label, current_weight=req.current_weight, floor=req.floor,
            target_slot_id=req.target, target_label=target_label,
            target_hurts=bool(crit and crit.penalties.get(req.target, 0.0) > 0),
            shortlist=[{"slot_id": sid, "label": self.slots[sid].local_label, "solver_rank": rank}
                       for rank, sid in display_shortlist(self.draft.shortlist, uid, rnd)],
            rules=person.rules, notes=person.notes, rule_kind=crit.kind if crit else "rule",
        )
        try:
            answer = await self.agents.move(view)
        except AgentError:
            answer = await _sim.move(view)
        old = self.score(uid, req.target)
        move = Move(answer.move, answer.rule_id, answer.new_weight, answer.text)  # text never reaches the solver
        idx = self.states.index(st)
        self.states[idx], applied = apply_move(st, move)
        self.draft = self.solver.solve(self.states)
        new = self.score(uid, req.target)
        if applied.kind == "flex":
            self.concessions.append({
                "user_id": uid, "name": self.name(uid), "rule_id": applied.rule_id, "rule_label": req.rule_label,
                "old_weight": round(applied.old_weight, 3), "new_weight": round(applied.new_weight, 3), "round": rnd,
            })
        self.replies.append(f"{self.name(uid)} answered '{applied.kind}' about {req.rule_label}: {answer.text}")
        await self.emit("agent_reply", {
            "round": rnd, "ask_id": ask_id, "user_id": uid, "slot_id": req.target,
            "response": applied.kind, "old_score": old, "new_score": new, "text": answer.text,
            "move": {"type": answer.move, "rule_id": answer.rule_id,
                     "new_weight": answer.new_weight, "old_weight": applied.old_weight},
            "valid": applied.valid, "rejected_reason": applied.reason,
        })
        return applied.kind == "flex"

    def compare_rules(self) -> list[dict]:
        """Every decision rule in docs/research/negotiation-layer.md that the app can run, on the
        same final reports, scored on the same common scale. Additive: what the solver chose is
        unchanged; this is what each alternative rule would have chosen instead."""
        draft = self.draft
        if not draft or not self.open_ids:
            return []
        slots = self.open_ids
        u, d = draft.utilities, draft.d
        raw = {st.user_id: st.model.raw(slots) for st in self.states}
        approvals = {
            uid: {sid for sid in slots
                  if not any(c.severity == "soft" for c in self.assessments[uid][sid].conflicts)}
            for uid in self.people
        }
        picks = [
            ("nash", draft.selection),
            ("leximin", leximin_select(u, d, slots)),
            ("utilitarian", utilitarian_select({a: normalize(r, "range") for a, r in raw.items()}, slots)),
            ("borda", borda_select(raw, slots)),
            ("approval", approval_select(approvals, slots)),
        ]
        out = []
        for rule, sel in picks:
            sid = sel.slot_id
            if sid is None:
                out.append({"rule": rule, "slot_id": None})
                continue
            scores = {uid: self.score(uid, sid) for uid in self.people}
            out.append({
                "rule": rule,
                "slot_id": sid,
                "label": self.slots[sid].local_label,
                "scores": scores,
                "min_score": min(scores.values()),
                "avg_score": round(sum(scores.values()) / len(scores), 1),
                "nash_welfare": round(nash_welfare(u, d, sid), 4),
                "pareto_dominated_by": pareto_dominator(u, sid, slots),
                "available": sum(1 for a in approvals.values() if sid in a),
            })
        return out

    async def decide(self) -> None:
        draft = self.draft
        sel = draft.selection if draft else None
        best = sel.slot_id if sel else None
        status = "converged" if best else "escalated"
        names = {uid: p.name for uid, p in self.people.items()}

        compromises = []
        if best:
            conceded = {c["user_id"]: c["rule_label"] for c in self.concessions}
            for uid in self.people:
                score = self.score(uid, best)
                worst = self.state(uid).model.worst_criterion(best)
                if uid in conceded or (worst and score < COMFORT):
                    gave_up = (conceded.get(uid) or (worst.label if worst else "a preferred time"))
                    compromises.append({"user_id": uid, "name": self.name(uid),
                                        "gave_up": gave_up.removeprefix("Rule: "), "score": score})
        ranking = sel.ranking if sel else []
        alternatives = []
        for sid in ranking:
            if sid == best:
                continue
            info = self.ranked_info(sid, 0)
            alternatives.append({"slot_id": sid, "label": self.slots[sid].local_label,
                                 "min_score": info["min_score"], "avg_score": info["avg_score"]})
            if len(alternatives) == 3:
                break

        binding = binding_reason(draft, {st.user_id: st.model for st in self.states}) if draft and best else None
        best_scores = {uid: self.score(uid, best) for uid in self.people} if best else {}
        view = DecisionView(
            title=self.meeting.title, status=status,
            chosen_label=self.slots[best].local_label if best else None,
            scores={names[u]: s for u, s in best_scores.items()},
            compromises=[f"{c['name']}: {c['gave_up']}" for c in compromises],
            alternatives=[f"{a['label']} (lowest {a['min_score']})" for a in alternatives],
            replies=self.replies,
            runner_up_label=self.slots[binding.runner_up].local_label if binding and binding.runner_up else None,
            decisive=names.get(binding.decisive) if binding and binding.decisive else None,
            decisive_reason=binding.decisive_label if binding else None,
            bottleneck=names.get(binding.bottleneck) if binding and binding.bottleneck else None,
            tied_labels=[self.slots[s].local_label for s in binding.tied[:1]] if binding else [],
        )
        try:
            words = await self.agents.explain(view)
        except AgentError:
            words = await _sim.explain(view)
        is_faithful = faithful(words.explanation, binding, names)

        slot = self.slots[best] if best else None
        self.db.add(models.MeetingDecision(
            meeting_request_id=self.meeting.id, status=status,
            slot_id=slot.id if slot else None, start=slot.start if slot else None,
            end=slot.end if slot else None, label=slot.local_label if slot else None,
            explanation=words.explanation, question=words.question if not best else None,
            scores=best_scores, compromises=compromises, alternatives=alternatives,
        ))
        self.meeting.status = "scheduled" if best else "escalated"
        self.session.status = status
        self.session.completed_at = datetime.now(timezone.utc)
        self.db.commit()
        bottleneck = sel.bottleneck if sel else None
        await self.emit("decision", {
            "status": status,
            "slot": slot.to_dict() if slot else None,
            "scores": best_scores,
            "min_score": min(best_scores.values()) if best_scores else None,
            "avg_score": round(sum(best_scores.values()) / len(best_scores), 1) if best_scores else None,
            "compromises": compromises,
            "alternatives": alternatives,
            "explanation": words.explanation,
            "question": words.question if not best else None,
            # Additive fields: how the solver decided.
            "selector": SELECTOR,
            "normalization": NORMALIZATION,
            "solver_status": sel.status if sel else "no_slots",
            "individually_rational": bool(sel and sel.status == "ok"),
            "near_miss": sel.near_miss if sel else None,
            "nash_score": round(sel.objective.get(best, 0.0), 4) if sel and best else None,
            "bottleneck": ({"user_id": bottleneck, "name": names[bottleneck],
                            "gain": round(draft.utilities[bottleneck][best] - draft.d[bottleneck], 4)}
                           if bottleneck and best else None),
            "binding": binding.to_dict() if binding else None,
            "faithful": is_faithful,
            "concessions": self.concessions,
            "rules": self.compare_rules() if best else [],
        })
