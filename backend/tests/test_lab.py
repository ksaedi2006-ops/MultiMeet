import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c



def test_lab_streams_scored_meetings(client):
    res = client.get("/lab/run", params={"mechs": "nash,old,when2meet", "n": 3, "attack": "fakehard", "count": 4})
    assert res.status_code == 200
    rows = [json.loads(line) for line in res.text.splitlines() if line]
    assert rows and all(r["n"] == 3 for r in rows)
    for r in rows:
        assert set(r["results"]) == {"nash", "old", "when2meet"}
        for o in r["results"].values():
            assert 0 < o["ratio"] <= 1.0 + 1e-9 and o["violation"] is False and "gain" in o


def test_lab_instance_has_everything_to_draw(client):
    data = client.get("/lab/instance", params={"idx": 0, "n": 3}).json()
    assert data["slots"] and len(data["people"]) == 3
    assert all(set(p["scores"]) == {s["id"] for s in data["slots"]} for p in data["people"])


def test_lab_rejects_unknown_rules(client):
    assert client.get("/lab/run", params={"mechs": "nope"}).status_code == 400


def test_lab_meeting_runs_every_rule_with_the_people_in_their_own_words(client):
    data = client.get("/lab/meeting", params={"idx": 2, "n": 5, "attack": "inflater"}).json()
    assert len(data["results"]) == 14 and data["liars"]
    assert all(p["said"] for p in data["people"])
    assert "dictator" in data["results"]["random_dictator"]["extra"]
    assert "condorcet" in data["results"]["condorcet"]["extra"]
    assert data["results"]["vcg"]["payments"]
    assert all("gain" in r for r in data["results"].values())


def test_lab_decide_redraws_a_person_and_reruns_every_rule(client):
    base = client.get("/lab/meeting", params={"idx": 2, "n": 3}).json()
    who = base["people"][0]["user_id"]
    peak = base["slots"][-1]["id"]
    data = client.post("/lab/decide", json={"idx": 2, "n": 3, "edits": {who: {"peak": peak, "avoid": [0]}}}).json()
    me = next(p for p in data["people"] if p["user_id"] == who)
    assert me["edited"] and me["said"][0].startswith("Ideally around")
    assert me["scores"][peak] == 100  # their new favourite is now their best time
    assert len(data["results"]) == 14
