"""Record real Claude negotiations into a replayable bank (app/live_bank/*.json).

Each recording runs the product's own pipeline (app.negotiation.Negotiation) with the
Claude agents, in a scratch SQLite database, and saves the meeting, its people and the full
event log. The deployed site replays a recording instead of calling the API, so visitors see
genuine LLM negotiation at no runtime cost.

Spend is metered from every response's usage and the run stops before the cap is crossed.

    venv/bin/python -m scripts.record_live --count 3 --cap 1.00
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
BANK = Path(os.environ["RECORD_DRY"]) if os.environ.get("RECORD_DRY") else BACKEND / "app" / "live_bank"
DRY = bool(os.environ.get("RECORD_DRY"))  # simulated agents, for testing the replay side only
LEDGER = BACKEND / "eval" / "out" / "live_spend.json"

# $ per million tokens: input, output, cache read, cache write.
PRICES = {
    "claude-haiku-5-5": (0.10, 0.50, 0.01, 0.125),
    "claude-sonnet-5-5": (2.00, 10.00, 0.10, 2.50),
    "claude-sonnet-5": (2.00, 10.00, 0.20, 2.50),
    "claude-opus-5-5": (4.00, 20.00, 0.20, 5.00),
}


class Budget(Exception):
    pass


class Meter:
    def __init__(self, cap: float, spent: float) -> None:
        self.cap, self.spent, self.calls = cap, spent, 0
        self.run_spent = 0.0

    def check(self) -> None:
        if self.spent >= self.cap:
            raise Budget(f"cap ${self.cap:.2f} reached (spent ${self.spent:.4f})")

    def add(self, model: str, usage) -> None:
        key = next((k for k in PRICES if model.startswith(k)), "claude-opus-5-5")
        p_in, p_out, p_cr, p_cw = PRICES[key]
        cost = (
            (usage.input_tokens or 0) * p_in
            + (usage.output_tokens or 0) * p_out
            + (getattr(usage, "cache_read_input_tokens", 0) or 0) * p_cr
            + (getattr(usage, "cache_creation_input_tokens", 0) or 0) * p_cw
        ) / 1e6
        self.spent += cost
        self.run_spent += cost
        self.calls += 1


def setup_db() -> str:
    path = Path(tempfile.mkdtemp()) / "record.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{path}"
    os.environ["MULTIMEET_AGENTS"] = "anthropic"
    os.environ.setdefault("MULTIMEET_AGENT_MODEL", "claude-haiku-5-5")
    os.environ.setdefault("MULTIMEET_MEDIATOR_MODEL", "claude-sonnet-5-5")
    return str(path)


def load_env() -> None:
    env = BACKEND / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


async def record_one(seed: int, size: int, meter: Meter) -> dict:
    from app import models
    from app.agents.llm import AGENT_MODEL, MEDIATOR_MODEL, AnthropicAgents
    from app.database import SessionLocal
    from app.negotiation import Negotiation, event_slots
    from app.sample import create_sample_users, generate_crowd

    if DRY:
        from app.agents.simulated import SimulatedAgents
        agents = SimulatedAgents()
    else:
        agents = AnthropicAgents(concurrency=6)
        parse = agents._client.beta.messages.parse

        async def metered(**kw):
            meter.check()
            response = await parse(**kw)
            meter.add(response.model or kw["model"], response.usage)
            return response

        agents._client.beta.messages.parse = metered

    db = SessionLocal()
    try:
        tz = "America/New_York"
        start = date.today() + timedelta(days=1)
        owner = models.User(name="Alex")
        db.add(owner)
        group = models.Group(name="Sample negotiation")
        db.add(group)
        db.flush()
        meeting = models.MeetingRequest(
            group_id=group.id, requested_by=owner.id, title="Sample negotiation", duration_minutes=60,
            start_date=start, end_date=start + timedelta(days=11), timezone=tz,
            earliest_hour=9, latest_hour=21, weekdays=[0, 1, 2, 3, 4],
        )
        db.add(meeting)
        db.add(models.GroupMember(group_id=group.id, user_id=owner.id, role="admin", ready=True))
        db.commit()

        rng = random.Random(seed)
        people = generate_crowd(rng, size - 1, event_slots(meeting), tz, meeting.start_date, meeting.end_date)
        users = create_sample_users(db, people, tz, meeting.start_date, meeting.end_date)

        # The agents read each person's own words, rather than the generator's ready-made rules.
        said = [(p, u) for u in users for p in db.query(models.UserPreference).filter_by(user_id=u.id).all()]
        parsed = await asyncio.gather(*(agents.parse_preference(p.raw_text) for p, _ in said), return_exceptions=True)
        for (pref, _), out in zip(said, parsed):
            if isinstance(out, Budget):
                raise out
            if isinstance(out, Exception):
                pref.parse_ok = False
                continue
            pref.rules = [r.model_dump(exclude_none=True) for r in out.rules]
            if getattr(out, "ack", None):
                pref.ack = out.ack
        for u in users:
            db.add(models.GroupMember(group_id=group.id, user_id=u.id, role="member", ready=True))
        db.add(models.NegotiationSession(meeting_request_id=meeting.id, agent_backend=agents.name))
        meeting.status = "negotiating"
        db.commit()

        calls_before = meter.calls
        await Negotiation(db, meeting.id, agents).run()
        db.refresh(meeting)
        if not DRY and meter.calls == calls_before:
            raise RuntimeError("no Claude call succeeded during the negotiation; not a live recording")

        members = db.query(models.GroupMember).filter_by(group_id=group.id).order_by(models.GroupMember.joined_at).all()
        user_rows = []
        for m in members:
            u = db.get(models.User, m.user_id)
            user_rows.append({
                "id": u.id, "name": u.name, "calendar": u.calendar, "role": m.role,
                "prefs": [{"raw_text": p.raw_text, "rules": p.rules, "ack": p.ack, "parse_ok": p.parse_ok}
                          for p in db.query(models.UserPreference).filter_by(user_id=u.id).all()],
            })
        events = (db.query(models.NegotiationEvent).filter_by(meeting_request_id=meeting.id)
                  .order_by(models.NegotiationEvent.seq).all())
        t0 = events[0].created_at if events else None
        decision = db.query(models.MeetingDecision).filter_by(meeting_request_id=meeting.id).one_or_none()
        return {
            "version": 1,
            "seed": seed,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "models": {"agent": AGENT_MODEL, "mediator": MEDIATOR_MODEL},
            "cost_usd": round(meter.run_spent, 4),
            "owner_id": owner.id,
            "meeting": {
                "id": meeting.id, "title": meeting.title, "duration_minutes": meeting.duration_minutes,
                "start_date": meeting.start_date.isoformat(), "end_date": meeting.end_date.isoformat(),
                "timezone": tz, "earliest_hour": 9, "latest_hour": 21, "weekdays": [0, 1, 2, 3, 4],
                "status": meeting.status,
            },
            "users": user_rows,
            "events": [{
                "seq": e.seq, "type": e.type, "payload": e.payload, "owner_id": e.owner_id, "private": e.private,
                "offset": (e.created_at - t0).total_seconds() if t0 and e.created_at else 0,
            } for e in events],
            "decision": None if decision is None else {
                c: (getattr(decision, c).isoformat() if isinstance(getattr(decision, c), datetime) else getattr(decision, c))
                for c in ("status", "slot_id", "start", "end", "label", "explanation", "question",
                          "scores", "compromises", "alternatives")
            },
        }
    finally:
        db.close()


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--sizes", default="5", help="comma-separated group sizes, cycled")
    ap.add_argument("--cap", type=float, default=1.0, help="hard cap in $ across all runs (ledger included)")
    ap.add_argument("--seed", type=int, default=1000)
    args = ap.parse_args()

    load_env()
    setup_db()
    if not DRY and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is not set (backend/.env)")
    from app.database import Base, engine
    from app import models  # noqa: F401
    Base.metadata.create_all(engine)

    import anthropic
    try:
        if DRY:
            raise StopIteration  # fail fast on a bad key instead of recording a fallback negotiation
        await anthropic.AsyncAnthropic().models.retrieve("claude-haiku-5-5")
    except StopIteration:
        pass
    except anthropic.AuthenticationError:
        sys.exit("The API key in backend/.env was rejected (401). Put a valid key there and rerun.")

    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() and not DRY else {"spent": 0.0, "runs": []}
    meter = Meter(args.cap, ledger["spent"])
    BANK.mkdir(parents=True, exist_ok=True)
    sizes = [int(s) for s in args.sizes.split(",")]

    for i in range(args.count):
        seed = args.seed + i
        size = sizes[i % len(sizes)]
        meter.run_spent = 0.0
        name = f"live-{seed}-n{size}.json"
        try:
            rec = await record_one(seed, size, meter)
        except Budget as exc:
            print(f"stopped: {exc}")
            break
        except Exception as exc:  # keep going; log what broke
            print(f"{name}: FAILED {type(exc).__name__}: {exc}")
            ledger["runs"].append({"file": name, "ok": False, "cost": round(meter.run_spent, 4), "error": str(exc)})
        else:
            ok = rec["meeting"]["status"] in ("scheduled", "escalated")
            (BANK / name).write_text(json.dumps(rec, indent=1, default=str))
            print(f"{name}: {rec['meeting']['status']}, {len(rec['events'])} events, "
                  f"{meter.calls} calls so far, ${meter.run_spent:.4f} this run, ${meter.spent:.4f} total")
            ledger["runs"].append({"file": name, "ok": ok, "cost": round(meter.run_spent, 4)})
        finally:
            ledger["spent"] = round(meter.spent, 6)
            if not DRY:
                LEDGER.write_text(json.dumps(ledger, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
