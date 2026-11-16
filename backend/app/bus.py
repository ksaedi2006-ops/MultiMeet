"""Append-only event log per meeting, fanned out over WebSockets.

Every event is written to `negotiation_events` with a per-meeting sequence number
before it is broadcast, so a client that refreshes or joins late replays the exact
same history (`after=<last seq>`) and de-duplicates by `seq`.
"""

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass

from fastapi import WebSocket
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

log = logging.getLogger(__name__)


def serialize(event: models.NegotiationEvent, viewer_id: str | None) -> dict:
    out = {
        "seq": event.seq,
        "type": event.type,
        "at": event.created_at.isoformat() if event.created_at else None,
        **event.payload,
    }
    if event.private and viewer_id and viewer_id == event.owner_id:
        out["private"] = event.private
    return out


@dataclass(eq=False)
class Subscriber:
    socket: WebSocket
    viewer_id: str | None


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[Subscriber]] = defaultdict(set)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def emit(
        self,
        db: Session,
        meeting_id: str,
        type_: str,
        payload: dict,
        *,
        owner_id: str | None = None,
        private: dict | None = None,
    ) -> models.NegotiationEvent:
        async with self._locks[meeting_id]:
            last = (
                db.query(func.max(models.NegotiationEvent.seq))
                .filter(models.NegotiationEvent.meeting_request_id == meeting_id)
                .scalar()
            )
            event = models.NegotiationEvent(
                meeting_request_id=meeting_id,
                seq=(last or 0) + 1,
                type=type_,
                payload=payload,
                owner_id=owner_id,
                private=private,
            )
            db.add(event)
            db.commit()
            db.refresh(event)
        await self._broadcast(meeting_id, event)
        return event

    def history(self, db: Session, meeting_id: str, after: int, viewer_id: str | None) -> list[dict]:
        rows = (
            db.query(models.NegotiationEvent)
            .filter(models.NegotiationEvent.meeting_request_id == meeting_id, models.NegotiationEvent.seq > after)
            .order_by(models.NegotiationEvent.seq)
            .all()
        )
        return [serialize(r, viewer_id) for r in rows]

    def subscribe(self, meeting_id: str, socket: WebSocket, viewer_id: str | None) -> Subscriber:
        sub = Subscriber(socket, viewer_id)
        self._subs[meeting_id].add(sub)
        return sub

    def unsubscribe(self, meeting_id: str, sub: Subscriber) -> None:
        subs = self._subs.get(meeting_id)
        if subs is not None:
            subs.discard(sub)
            if not subs:
                self._subs.pop(meeting_id, None)

    async def _broadcast(self, meeting_id: str, event: models.NegotiationEvent) -> None:
        dead = []
        for sub in list(self._subs.get(meeting_id, ())):
            try:
                await sub.socket.send_json(serialize(event, sub.viewer_id))
            except Exception:
                dead.append(sub)
        for sub in dead:
            log.info("dropping dead socket for meeting %s", meeting_id)
            self.unsubscribe(meeting_id, sub)


bus = EventBus()
