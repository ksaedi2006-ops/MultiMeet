import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import ratelimit


def _req(ip: str) -> Request:
    return Request({"type": "http", "headers": [(b"x-forwarded-for", f"{ip}, 10.0.0.1".encode())], "client": ("10.0.0.1", 1)})


def test_limit_counts_per_visitor(monkeypatch):
    monkeypatch.setattr(ratelimit, "ENABLED", True)
    check = ratelimit.limit("t", 2)
    check(_req("1.1.1.1"))
    check(_req("1.1.1.1"))
    with pytest.raises(HTTPException) as e:
        check(_req("1.1.1.1"))
    assert e.value.status_code == 429
    check(_req("2.2.2.2"))  # someone else is unaffected
