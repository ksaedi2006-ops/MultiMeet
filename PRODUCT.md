# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

College students scheduling club meetings, study groups and group-project sessions: an organiser creates an event and shares a link; members join, upload their calendar and tell their agent their preferences.

The people who will mainly see MeetMind right now are evaluators, not schedulers:

- **Hackathon judges** watching a roughly two-minute live demo on a projector, where the negotiation is the moment that has to land.
- **Recruiters and portfolio visitors** opening the link on their own, often on a phone, with nobody explaining it.

Real student use is a later audience, not the current priority.

## Product Purpose

A When2Meet replacement where nobody paints an availability grid. Each person's AI agent negotiates on their behalf and the group gets one decided time, with an explanation of why and who gave something up. Success for the demo: a viewer understands within seconds that several agents are arguing over real constraints and watches them converge on a fair answer.

## Positioning

Code decides what is possible; agents argue about what is preferable. Hard calendar conflicts and firm rules are enforced deterministically before any model sees the options. Personal agents score the remaining times, a mediator asks specific people to flex over up to three rounds, and the final choice is ranked by Rawlsian fairness (the best outcome for the least-happy person, then the average), with compromises named.

## Operating Context

- Linear guest flow, no accounts: create event (title, date range, duration, daily window, weekdays, time zone) → share invite link with a live roster → upload a .ics calendar → tell your agent your preferences in chat → organiser starts the negotiation → live negotiation view → decision with RSVP and add-to-calendar.
- Every negotiation step is an event in a replayable, sequence-numbered log streamed over WebSockets; the live view is built from that stream and can be replayed.
- Demo data: `backend/scripts/seed_demo_group.py` adds seven personas with recurring calendars and preferences, or runs a full negotiation from the terminal.

## Capabilities and Constraints

- Backend: FastAPI, SQLAlchemy + Alembic, SQLite locally. Frontend: React, TypeScript, Vite, Tailwind v4, framer-motion.
- Agents run on Claude (structured output) or a deterministic simulated backend when no API key is set; simulated agents must be labelled as such, never passed off as real.
- Each person sees everyone's scores but only their own agent's reasoning.
- Negotiations are expected to involve up to ~30 participants and up to ~80 candidate slots.
- Out of scope for now: competing LLM providers (the agent layer is built to allow it later), Google Calendar sign-in, real accounts, nudges, recurring meetings, location, analytics.

## Brand Commitments

- Name: MeetMind.
- Visual identity: a radar-style scope on a dark console, manila paper cards, safety-orange marks. The scope stays the hero.
- Plain language, always (direction set 2026-11-16): the look borrows from air-traffic control but the words never do. A recruiter on a phone must understand any screen in five seconds with no glossary.
- Vocabulary: people and their agents (dots labelled with first names), times (marks on the ring), the mediator (centre), "can't make it" (crossed-out times), "Can move" / "Won't move" / "Agrees" (replies), "Booked" (the chosen time), "No time works" (no agreement). Steps: New meeting, Invite people, Your calendar, Your preferences, Negotiating, Booked.
- Not used anywhere user-visible: tower, TWR, runway, approach, cleared, holding, fixes, callsigns, flight plan, frequency, manifest, briefing, ATIS, Zulu time.

## Evidence on Hand

- `SPEC.md` (product spec), the seed personas, and the live negotiation itself are the only demo material.
- No real users, testimonials, usage numbers or benchmarks exist; do not fabricate any.

## Product Principles

1. Show the mechanism, not a spinner: every agent action is visible and attributable.
2. Constraints are enforced, not suggested: a time someone can't make is visibly crossed out and names whose commitment did it.
3. Fairness is explained: the decision always says who compromised and what the fallback is.
4. Honest about machinery: failures and simulated agents are labelled, never hidden.
5. Legible to a stranger: the screen must make sense without a presenter.
