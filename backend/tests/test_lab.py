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
