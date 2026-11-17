import random
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.sample import _open_count, generate_crowd
from app.scheduling.slots import generate_slots

NY = "America/New_York"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_crowd_is_varied_and_leaves_room_to_negotiate():
    start = date.today() + timedelta(days=1)
    end = start + timedelta(days=11)
    slots = generate_slots(start_date=start, end_date=end, tz=NY, duration_minutes=60, weekdays=frozenset(range(5)))
    for n in (8, 20, 36):
        people = generate_crowd(random.Random(n), n, slots, NY, start, end)
        assert len({p.name for p in people}) == n
        assert _open_count(people, slots, NY, start, end) >= 6
        assert any(p.items for p in people)
    kinds = {i.kind for p in people for i in p.items}
    assert kinds == {"hard", "soft"}  # not everything is immovable


def wait_decision(client, event_id, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        log = client.get(f"/events/{event_id}/log").json()
        done = [e for e in log if e["type"] in ("decision", "negotiation_failed")]
        if done:
            return log, done[0]
        time.sleep(0.25)
    raise AssertionError("sample negotiation never finished")


def test_one_click_sample_runs_end_to_end(client):
    uid = client.post("/users/anon").json()["id"]
    client.patch(f"/users/{uid}", json={"name": "Ava"})
    event = client.post("/events/sample", params={"user_id": uid, "count": 16}).json()
    log, final = wait_decision(client, event["event_id"])
    assert final["type"] == "decision"
    started = next(e for e in log if e["type"] == "negotiation_started")
    assert len(started["participants"]) == 17  # 16 generated plus the organiser
    assert sum(e["type"] == "member_joined" for e in log) == 17
    assert client.post(f"/events/{event['event_id']}/start", params={"user_id": uid}).status_code == 409


def test_thirty_agent_negotiation_completes(client):
    uid = client.post("/users/anon").json()["id"]
    event = client.post("/events/sample", params={"user_id": uid, "count": 30}).json()
    log, final = wait_decision(client, event["event_id"], timeout=90)
    assert final["type"] == "decision"
    started = next(e for e in log if e["type"] == "negotiation_started")
    assert len(started["participants"]) == 31
    assert len(started["slots"]) <= 72


def test_add_sample_people_and_sample_calendar(client):
    uid = client.post("/users/anon").json()["id"]
    today = datetime.now(ZoneInfo(NY)).date()
    event = client.post("/events", params={"requested_by": uid}, json={
        "title": "Manual", "start_date": (today + timedelta(days=1)).isoformat(),
        "end_date": (today + timedelta(days=8)).isoformat(), "timezone": NY,
    }).json()
    other = client.post("/users/anon").json()["id"]
    assert client.post(f"/events/{event['event_id']}/sample", params={"user_id": other}).status_code == 403
    assert client.post(f"/events/{event['event_id']}/sample", params={"user_id": uid, "count": 5}).status_code == 200
    deadline = time.time() + 20
    while time.time() < deadline:
        members = client.get(f"/events/{event['event_id']}/members").json()
        if len(members) == 6 and all(m["ready"] for m in members if m["role"] != "admin"):
            break
        time.sleep(0.2)
    assert len(members) == 6
    assert all(m["calendar_events"] > 0 for m in members if m["role"] != "admin")

    cal = client.post(f"/users/{uid}/calendar/sample", params={"timezone": NY}).json()
    assert len(cal["events"]) > 10
    assert {e["kind"] for e in cal["events"]} <= {"hard", "soft"}


def test_simulated_parser_treats_smart_apostrophes_like_plain_ones():
    import asyncio

    from app.agents.simulated import SimulatedAgents

    agents = SimulatedAgents()
    plain = asyncio.run(agents.parse_preference("I can't do anything before 11am")).rules[0]
    smart = asyncio.run(agents.parse_preference("I can’t do anything before 11am")).rules[0]
    assert plain.strength == smart.strength == "hard"
    assert smart.kind == "not_before" and smart.time == "11:00"


def test_negotiation_events_carry_solver_fields_without_dropping_old_ones(client):
    uid = client.post("/users/anon").json()["id"]
    event = client.post("/events/sample", params={"user_id": uid, "count": 12}).json()
    log, final = wait_decision(client, event["event_id"])
    assert final["type"] == "decision"
    # Fields the frontend reads are all still there.
    for key in ("status", "slot", "scores", "min_score", "avg_score", "compromises", "alternatives", "explanation"):
        assert key in final
    # Additive: how the solver decided.
    assert final["selector"] == "nash" and final["normalization"] == "topk"
    assert final["faithful"] is True and final["bottleneck"]["user_id"] in final["scores"]
    assert final["binding"]["pick"] == final["slot"]["id"]
    # Every alternative rule, run on the same final reports.
    rules = {r["rule"]: r for r in final["rules"]}
    assert set(rules) == {"nash", "leximin", "utilitarian", "borda", "approval"}
    assert rules["nash"]["slot_id"] == final["slot"]["id"]
    assert rules["nash"]["pareto_dominated_by"] is None  # Nash on the reports is Pareto-optimal
    best_nw = max(r["nash_welfare"] for r in rules.values())
    assert rules["nash"]["nash_welfare"] == best_nw
    assert rules["leximin"]["min_score"] >= rules["nash"]["min_score"]
    for e in log:
        if e["type"] == "shortlist":
            assert all({"slot_id", "min_score", "avg_score", "scores", "unhappy", "nash"} <= set(r) for r in e["ranked"])
        if e["type"] == "agent_reply":
            assert e["response"] in ("accept", "flex", "hold") and "valid" in e and "move" in e
        if e["type"] == "agent_scored":
            assert e["source"] == "rules" and all(0 <= v <= 100 for v in e["scores"].values())
    asks = [e for e in log if e["type"] == "mediator_ask"]
    assert len(asks) <= 3 and all("rule_id" in a and "zeuthen_gain" in a for a in asks)
