import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app import models  # noqa: E402
from app.agents import get_agents  # noqa: E402
from app.bus import bus  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.routers import events, users  # noqa: E402

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("multimeet")


def migrate() -> None:
    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "head")


def fail_interrupted_negotiations() -> None:
    """A negotiation runs in-process; if the server restarted mid-run, it can't resume."""
    db = SessionLocal()
    try:
        for session in db.query(models.NegotiationSession).filter_by(status="running").all():
            session.status, session.error = "failed", "Server restarted during the negotiation"
            session.completed_at = datetime.now(timezone.utc)
            meeting = db.get(models.MeetingRequest, session.meeting_request_id)
            if meeting:
                meeting.status = "failed"
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate()
    fail_interrupted_negotiations()
    log.info("agents: %s", get_agents().name)
    yield


app = FastAPI(title="MultiMeet API", lifespan=lifespan)

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

app.include_router(users.router)
app.include_router(events.router)


@app.get("/health")
def health():
    return {"status": "ok", "agents": get_agents().name}


@app.websocket("/ws/events/{event_id}")
async def event_stream(websocket: WebSocket, event_id: str, after: int = 0, viewer: str | None = None):
    await websocket.accept()
    db = SessionLocal()
    try:
        if db.get(models.MeetingRequest, event_id) is None:
            await websocket.close(code=4404)
            return
        # Subscribe before replaying so nothing emitted in between is lost; the client
        # de-duplicates by seq.
        sub = bus.subscribe(event_id, websocket, viewer)
        backlog = bus.history(db, event_id, after, viewer)
    finally:
        db.close()
    try:
        for event in backlog:
            await websocket.send_json(event)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(event_id, sub)
