import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.main import app

NY = "America/New_York"

LECTURES = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:lec
SUMMARY:CS 301 Lecture
DTSTART;TZID=America/New_York:20260105T090000
DTEND;TZID=America/New_York:20260105T120000
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
END:VEVENT
END:VCALENDAR
"""

GYM = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:gym
SUMMARY:Gym
DTSTART;TZID=America/New_York:20260105T130000
DTEND;TZID=America/New_York:20260105T150000
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
END:VEVENT
END:VCALENDAR
"""


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def guest(client, name):
    uid = client.post("/users/anon").json()["id"]
    assert client.patch(f"/users/{uid}", json={"name": name}).status_code == 200
    return uid


def wait_for(client, event_id, type_, viewer=None, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        log = client.get(f"/events/{event_id}/log", params={"viewer": viewer} if viewer else {}).json()
        if any(e["type"] == type_ for e in log):
            return log
        time.sleep(0.1)
    raise AssertionError(f"no {type_} event; last types: {[e['type'] for e in log][-5:]}")


def test_full_negotiation(client):
    organiser = guest(client, "Ava")
    marcus = guest(client, "Marcus")
    kate = guest(client, "Katherine")

    today = datetime.now(ZoneInfo(NY)).date()
    start = today + timedelta(days=(7 - today.weekday()) % 7 or 7)  # next Monday
    created = client.post("/events", params={"requested_by": organiser}, json={
        "title": "CS Club", "duration_minutes": 60, "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=4)).isoformat(), "timezone": NY,
        "earliest_hour": 9, "latest_hour": 18,
    })
    assert created.status_code == 200, created.text
    event = created.json()
    eid = event["event_id"]

    for uid in (marcus, kate):
        assert client.post(f"/events/join/{event['invite_code']}", params={"user_id": uid}).status_code == 200

    cal = client.post(f"/users/{marcus}/calendar", params={"event_id": eid},
                      json={"raw_ics": LECTURES, "timezone": NY, "filename": "m.ics"})
    assert cal.status_code == 200 and cal.json()["events"]
    assert client.post(f"/users/{kate}/calendar", json={"raw_ics": GYM, "timezone": NY}).status_code == 200
    pref = client.post(f"/users/{organiser}/preferences", json={"raw_text": "I can never do anything after 5pm"})
    assert pref.status_code == 200 and pref.json()["rules"][0]["kind"] == "not_after"

    # Only the organiser can start, and only once someone is ready.
    assert client.post(f"/events/{eid}/start", params={"user_id": marcus}).status_code == 403
    assert client.post(f"/events/{eid}/start", params={"user_id": organiser}).status_code == 409
    for uid in (organiser, marcus, kate):
        assert client.post(f"/events/{eid}/ready", params={"user_id": uid}).status_code == 200

    t0 = time.time()
    started = client.post(f"/events/{eid}/start", params={"user_id": organiser})
    assert started.status_code == 200 and time.time() - t0 < 2
    assert client.post(f"/events/{eid}/start", params={"user_id": organiser}).status_code == 409

    log = wait_for(client, eid, "decision", viewer=kate)
    seqs = [e["seq"] for e in log]
    assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)

    types = [e["type"] for e in log]
    assert types.index("negotiation_started") < types.index("slots_closed") < types.index("decision")

    closed = next(e for e in log if e["type"] == "slots_closed")
    reasons = {b["reason"] for c in closed["closed"] for b in c["blockers"]}
    assert "CS 301 Lecture" in reasons
    assert any(r.startswith("Rule:") for r in reasons)

    decision = next(e for e in log if e["type"] == "decision")
    assert decision["status"] == "converged"
    chosen = datetime.fromisoformat(decision["slot"]["start"]).astimezone(ZoneInfo(NY))
    assert chosen.hour >= 12  # lecture until noon
    assert chosen.hour + 1 <= 17  # organiser's hard rule

    # Privacy: Katherine sees only her own agent's reasoning.
    scored = [e for e in log if e["type"] == "agent_scored"]
    assert len(scored) == 3
    assert all(("private" in e) == (e["user_id"] == kate) for e in scored)

    # Late joiners replay from a sequence number.
    tail = client.get(f"/events/{eid}/log", params={"after": seqs[-3]}).json()
    assert [e["seq"] for e in tail] == seqs[-2:]

    summary = client.get(f"/events/{eid}/decision").json()
    assert summary["status"] == "converged"
    ics = client.get(f"/events/{eid}/calendar.ics")
    assert ics.status_code == 200 and "BEGIN:VEVENT" in ics.text

    assert client.post(f"/events/{eid}/rsvp", params={"user_id": kate}, json={"response": "accepted"}).status_code == 200
    assert client.get(f"/events/{eid}").json()["status"] == "scheduled"


def test_websocket_replays_then_streams(client):
    uid = guest(client, "Solo")
    start = date.today() + timedelta(days=2)
    ev = client.post("/events", params={"requested_by": uid}, json={
        "title": "Solo", "start_date": start.isoformat(), "end_date": (start + timedelta(days=3)).isoformat(),
        "weekdays": [0, 1, 2, 3, 4, 5, 6],
    }).json()
    with client.websocket_connect(f"/ws/events/{ev['event_id']}?after=0&viewer={uid}") as ws:
        first = ws.receive_json()
        assert first["type"] == "member_joined" and first["seq"] == 1
        client.post(f"/events/{ev['event_id']}/ready", params={"user_id": uid})
        nxt = ws.receive_json()
        assert nxt["type"] == "member_updated" and nxt["ready"] is True and nxt["seq"] == 2


def test_rejects_bad_calendar_and_settings(client):
    uid = guest(client, "X")
    assert client.post(f"/users/{uid}/calendar", json={"raw_ics": "nope"}).status_code == 422
    today = date.today()
    bad = client.post("/events", params={"requested_by": uid}, json={
        "title": "Too long", "start_date": today.isoformat(), "end_date": (today + timedelta(days=60)).isoformat(),
    })
    assert bad.status_code == 422
