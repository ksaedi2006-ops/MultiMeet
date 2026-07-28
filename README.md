# MeetMind

Multi-agent AI scheduling platform. See [SPEC.md](./SPEC.md) for the full product and architecture spec.

## Structure

- `backend/` — FastAPI app: models, Personal/Mediator agent logic (Claude API), negotiation orchestration, WebSocket live-negotiation feed.
- `frontend/` — React + TypeScript + Vite + Tailwind app: Dashboard, Groups, Create Meeting, Negotiation Live View, Preferences.

## Running locally

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in DATABASE_URL and ANTHROPIC_API_KEY
uvicorn app.main:app --reload
```

Requires a running PostgreSQL instance matching `DATABASE_URL`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend expects the backend at `http://localhost:8000` (configurable via `.env`).

## Status

MVP scaffold: user/group/meeting models, Personal Agent + Mediator Agent (single negotiation round), WebSocket negotiation event stream, and the core frontend pages including the live negotiation visualization. Stretch features (nudges, recurring meetings, location-aware scheduling, analytics) are not yet implemented — see SPEC.md.
