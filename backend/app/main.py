from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import groups, meetings, users
from app.websocket import manager

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MeetMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(groups.router)
app.include_router(meetings.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/negotiation/{meeting_id}")
async def negotiation_ws(websocket: WebSocket, meeting_id: str):
    await manager.connect(meeting_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(meeting_id, websocket)
