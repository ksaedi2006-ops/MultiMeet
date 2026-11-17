"""Per-visitor rate limits for the endpoints that cost real CPU on a small public server.

In memory, one process: right for a single free-tier instance. Behind a proxy (Render, Fly),
the visitor is the first address in X-Forwarded-For.
"""

import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

ENABLED = os.environ.get("MULTIMEET_RATE_LIMIT", "on") != "off"
_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def client(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit(name: str, per_minute: int):
    """A FastAPI dependency: at most `per_minute` calls to this endpoint per visitor."""

    def check(request: Request) -> None:
        if not ENABLED:
            return
        now = time.monotonic()
        q = _hits[(name, client(request))]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= per_minute:
            raise HTTPException(429, "Too many requests. Give it a minute and try again.")
        q.append(now)

    return check
