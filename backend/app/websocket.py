from fastapi import WebSocket


class NegotiationConnectionManager:
    """Tracks WebSocket clients subscribed to a given meeting request's live negotiation feed."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, meeting_request_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(meeting_request_id, []).append(websocket)

    def disconnect(self, meeting_request_id: str, websocket: WebSocket):
        if meeting_request_id in self.connections:
            self.connections[meeting_request_id] = [
                ws for ws in self.connections[meeting_request_id] if ws is not websocket
            ]

    async def broadcast(self, meeting_request_id: str, message: dict):
        for ws in self.connections.get(meeting_request_id, []):
            await ws.send_json(message)


manager = NegotiationConnectionManager()
