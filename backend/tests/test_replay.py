"""Recorded Claude runs replayed as fresh events (app/replay.py)."""

import json
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

from app import replay
from tests.test_sample import client, wait_decision  # noqa: F401  (shared fixture)

FIXTURES = Path(__file__).parent / "fixtures" / "live_bank"
NAME = "live-test-n5.json"


@pytest.fixture
def bank(monkeypatch):
    monkeypatch.setattr(replay, "BANK", FIXTURES)
    replay.bank.cache_clear()
    yield
    replay.bank.cache_clear()


def test_load_moves_dates_by_whole_weeks_and_keeps_local_times(bank):
    raw = json.loads((FIXTURES / NAME).read_text())
    start = date.fromisoformat(raw["meeting"]["start_date"])
    recording = replay.plan(NAME, today=start + timedelta(days=100))
    weeks = int(recording.split("|")[2])
    assert weeks * 7 >= 100
    rec = replay.load(recording, "owner-x", "Ava")

    new_start = date.fromisoformat(rec["meeting"]["start_date"])
    assert new_start == start + timedelta(days=weeks * 7)
    assert new_start.weekday() == start.weekday()

    old_slots = next(e for e in raw["events"] if e["type"] == "negotiation_started")["payload"]["slots"]
    new_slots = next(e for e in rec["events"] if e["type"] == "negotiation_started")["payload"]["slots"]
    for old, new in zip(old_slots, new_slots):
        assert old["label"].split(", ")[-1] == new["label"].split(", ")[-1]  # same clock time
        assert old["label"][:3] == new["label"][:3]  # same weekday
        assert datetime.fromisoformat(new["start"]).date() > datetime.fromisoformat(old["start"]).date()
        assert new["id"] != old["id"]


def test_load_is_deterministic_and_puts_the_viewer_in_charge(bank):
    recording = replay.plan(NAME)
    a = replay.load(recording, "owner-x", "Ava")
    b = replay.load(recording, "owner-x", "Ava")
    assert a == b
    started = next(e for e in a["events"] if e["type"] == "negotiation_started")["payload"]
    me = next(p for p in started["participants"] if p["user_id"] == "owner-x")
    assert me["name"] == "Ava"
    other = replay.load(replay.plan(NAME), "owner-x", "Ava")
    assert other["meeting"]["id"] != a["meeting"]["id"]  # each event gets its own ids


def test_sample_event_replays_a_recorded_run(client, bank):
    uid = client.post("/users/anon").json()["id"]
    client.patch(f"/users/{uid}", json={"name": "Ava"})
    event = client.post("/events/sample", params={"user_id": uid, "count": 4}).json()
    log, final = wait_decision(client, event["event_id"], timeout=60)
    assert final["type"] == "decision"
    started = next(e for e in log if e["type"] == "negotiation_started")
    assert started["recorded"] is True
    assert len(started["participants"]) == 5
    assert any(p["user_id"] == uid and p["name"] == "Ava" for p in started["participants"])
    assert sum(e["type"] == "member_joined" for e in log) == 5
    assert client.get(f"/events/{event['event_id']}/decision").json()["status"] == "converged"


def test_without_a_bank_samples_are_generated(client):
    uid = client.post("/users/anon").json()["id"]
    event = client.post("/events/sample", params={"user_id": uid, "count": 4}).json()
    log, final = wait_decision(client, event["event_id"])
    started = next(e for e in log if e["type"] == "negotiation_started")
    assert "recorded" not in started
