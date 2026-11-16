# MultiMeet

Multi-agent AI scheduling platform. See [SPEC.md](./SPEC.md) for the full product and architecture spec.

## User flow

A linear, no-login wizard: **Create event → Share link → Upload calendar → Talk to your agent → Negotiation**.

1. **Create** — enter a title, get an event.
2. **Share** — copy an invite link (`/join/:inviteCode`); anyone who opens it joins the event and goes through their own onboarding.
3. **Calendar** — upload an `.ics` export (or skip); parsed into hard-block events for the Personal Agent.
4. **Agent** — a chat with your Personal Agent where natural-language preferences get parsed and stored.
5. **Negotiate** — triggers the negotiation; a WebSocket streams live Personal Agent / Mediator Agent events, ending in a decision with a satisfaction breakdown.

Identity is a lightweight anonymous guest user created on first visit and cached in `localStorage` — no accounts.

## Structure

- `backend/` — FastAPI app: models, `/events` (create/share/join), calendar upload, Personal/Mediator agent logic (Claude API), negotiation orchestration, WebSocket live-negotiation feed.
- `frontend/` — React + TypeScript + Vite + Tailwind app implementing the five-step flow above.

## Running locally

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in ANTHROPIC_API_KEY (required for agent/negotiation calls)
uvicorn app.main:app --reload
```

Uses SQLite by default (`backend/multimeet.db`, gitignored) — no database setup needed. Set `DATABASE_URL` in `.env` to point at Postgres instead if you want that.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend expects the backend at `http://localhost:8000` (configurable via `.env`).

## Status

MVP: the full linear flow above works end-to-end, including live WebSocket negotiation events. Without `ANTHROPIC_API_KEY` set, event/group creation, sharing, joining, and calendar upload all work — only the agent preference-parsing (falls back to a generic acknowledgement) and the negotiation call itself (errors) need the key. Stretch features (nudges, recurring meetings, location-aware scheduling, analytics, real calendar OAuth) are not yet implemented — see SPEC.md.
