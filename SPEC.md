# MultiMeet — Multi-Agent Intelligent Scheduling Platform

## Project Overview

MultiMeet is a When2Meet replacement that uses a multi-agent AI architecture to make group scheduling effortless. Instead of manually painting availability grids, each user gets a personal AI scheduling agent that knows their calendar, understands their soft preferences, and negotiates on their behalf with other users' agents. A mediator agent coordinates the negotiation and finds the optimal meeting time and location that maximizes genuine group satisfaction — not just raw overlap.

The core insight: scheduling is inherently a multi-party negotiation problem where each person has private information (their real preferences, their flexibility, their fatigue levels) and competing priorities. Multi-agent architecture is the natural fit because each agent genuinely advocates for different things, creating productive tension that results in better outcomes than a dumb heatmap.

This is built as a web application. The primary target users are college students scheduling club meetings, study groups, and group project sessions — but the architecture generalizes to any group scheduling use case.

## Architecture

### System Components

The system has four layers:

1. **Client Layer** — React frontend that users interact with. Handles auth, calendar connection, preference input, group management, and real-time visualization of agent negotiations.
2. **API Layer** — Backend server (Node.js or Python FastAPI) that manages users, groups, meeting requests, and orchestrates agent sessions. Handles WebSocket connections for real-time negotiation updates pushed to the frontend.
3. **Agent Layer** — The core multi-agent system. Each user has a Personal Scheduling Agent. Each meeting request spawns a Mediator Agent. Agents communicate through a structured message-passing protocol. All agent reasoning is powered by LLM API calls (Claude API via Anthropic SDK).
4. **Data Layer** — Database storing user profiles, calendar data, preference histories, group memberships, meeting history, and agent configuration. PostgreSQL for structured data. Optionally Redis for real-time agent message passing and session state.

### Agent Types

#### Personal Scheduling Agent (one per user)

Each user has their own persistent agent that represents their scheduling interests. This agent has access to:

- The user's connected calendar (Google Calendar, iCal, Outlook via OAuth)
- The user's explicitly stated preferences (natural language, stored and parsed)
- The user's historical patterns (which meetings they actually attended vs skipped, which times they tend to accept vs reject)
- The user's current schedule density and fatigue estimation for any given day

The Personal Agent's job is to:

- Evaluate any proposed meeting time from the perspective of "is this actually good for my user, not just technically available"
- Assign a satisfaction score (0-100) to any proposed time slot, factoring in hard constraints (class, work) and soft preferences (morning aversion, post-class fatigue, commute considerations)
- Advocate for its user's interests during negotiation — push back on bad times, offer flexibility on times the user doesn't care about
- Distinguish between hard blocks (classes, exams, work shifts) and soft blocks (gym sessions, tentative plans, "I'd rather not but could")
- Learn over time from user corrections ("stop treating my Thursday gym as flexible," "mornings are fine actually if it's important")

**Agent prompt structure**: The Personal Agent receives a system prompt that includes the user's calendar for the relevant date range, their stated preferences as a structured list, their historical acceptance/rejection patterns, and instructions to advocate for the user while remaining cooperative. It outputs structured JSON responses with satisfaction scores, objections, and counterproposals.

#### Mediator Agent (one per meeting request)

When someone creates a meeting request, a Mediator Agent is spawned for that specific negotiation. The Mediator has access to:

- The meeting parameters (duration, recurring or one-time, any location constraints, urgency level)
- The satisfaction scores and constraints from all participating Personal Agents
- The full set of candidate time slots

The Mediator's job is to:

- Collect initial availability and satisfaction scores from all Personal Agents
- Identify the candidate slots with highest aggregate satisfaction
- When there's no perfect slot, identify the minimum set of compromises needed and propose them
- Break ties intelligently (prefer the slot where the lowest individual satisfaction is highest — maximize the minimum, Rawlsian fairness)
- Detect when negotiation is stuck (all agents have hard conflicts) and escalate to humans with targeted questions
- Produce a final recommendation with a plain-English explanation of why this time was chosen, who's compromising and how
- Handle location selection if building/room data is available (pick the location that minimizes total travel for all participants)

**Agent prompt structure**: The Mediator receives a system prompt with the meeting requirements, the number of participants, and instructions to find a fair solution. It processes batched responses from Personal Agents each round and outputs proposals, counterproposals, or a final decision with explanation.

#### Nudge Agent (optional, enhances the system)

A lightweight agent responsible for getting non-responsive users to engage. When a meeting request is pending and some users haven't connected their calendar or confirmed preferences, the Nudge Agent:

- Determines the minimum information needed from the non-responder to unblock the negotiation
- Crafts a personalized, specific message ("Tuesday at 3 is winning and works for 7 of 8 people — does it work for you?") rather than generic "fill out the poll" spam
- Chooses the right channel and timing for the nudge (don't ping someone at midnight)
- If the non-responder's calendar is connected but they haven't confirmed, the agent can check their calendar and propose a yes/no confirmation instead of requiring manual input
- Escalates to the group organizer if someone remains unresponsive after N nudges

## Negotiation Protocol

How a negotiation actually works, step by step:

1. **Meeting Request Created.** A user (typically a club president or group organizer) creates a meeting request specifying: group/members, desired duration, date range to search within, whether it's one-time or recurring, any hard constraints (must be after 5pm, must be in a specific building, etc.), and urgency level.
2. **Personal Agents Activated.** The system sends the meeting request to every member's Personal Agent simultaneously. Each agent evaluates all candidate time slots within the date range and returns a structured response:

```json
{
  "user_id": "sarah_123",
  "slots": [
    {
      "datetime": "2026-10-15T14:00",
      "satisfaction": 92,
      "constraint_type": "free",
      "notes": "Completely free, good energy time of day"
    },
    {
      "datetime": "2026-10-15T09:00",
      "satisfaction": 15,
      "constraint_type": "soft_preference",
      "notes": "User has expressed strong morning aversion"
    },
    {
      "datetime": "2026-10-16T16:00",
      "satisfaction": 60,
      "constraint_type": "soft_block",
      "notes": "Gym session scheduled but historically flexible"
    }
  ],
  "hard_blocks": ["2026-10-15T11:00-12:30", "2026-10-16T09:00-10:30"],
  "general_notes": "User prefers afternoon slots. Heavy course load on Mondays."
}
```

3. **Mediator Aggregates.** The Mediator collects all Personal Agent responses and builds a matrix of slots x participants x satisfaction scores. It identifies:
   - Perfect slots: Everyone scores above 80. If these exist, pick the highest aggregate score. Done.
   - Good-enough slots: Everyone scores above 50. Rank by aggregate and by minimum individual score (Rawlsian fairness — prefer the slot where the least happy person is still reasonably happy).
   - Compromise slots: Some people score below 50 but no one has a hard block. The Mediator identifies who would need to compromise and on what.
   - Impossible range: No slot works without someone missing a hard commitment. Mediator expands the search range or escalates.
4. **Negotiation Rounds (if needed).** If there's no clear winner, the Mediator runs negotiation rounds:
   - Round 1: Mediator proposes the top 3 candidates to all Personal Agents with context ("This slot has the highest aggregate satisfaction but Sarah's agent flagged morning aversion")
   - Personal Agents respond with acceptance, rejection, or counterproposal
   - Round 2: Mediator adjusts based on feedback, narrows to top 1-2 options, asks specific agents to flex ("Jake's agent: would your user consider moving their gym session? That unlocks a slot that works for everyone else at 85+ satisfaction")
   - Round 3 (max): If still stuck, Mediator escalates to humans with a specific ask, not a generic poll
5. **Final Decision.** Mediator selects the winning slot and generates:
   - The chosen time and location
   - A plain-English explanation of why this was selected
   - A breakdown showing each participant's satisfaction score
   - Who compromised and what they gave up
   - Calendar invites sent automatically (if permissions granted)
6. **Post-Decision Learning.** After the meeting actually happens (or doesn't), the system records:
   - Who actually attended vs who said they would
   - Whether anyone complained about the time
   - Whether the meeting ran over or was cut short
   - This data feeds back into Personal Agents to improve future scoring

## Core Features

### 1. Calendar Auto-Sync

OAuth integration with Google Calendar, Outlook, and Apple Calendar. When a user connects their calendar, their Personal Agent ingests all events and classifies each one:

- Hard commitment: Classes, exams, work shifts, medical appointments. These are immovable.
- Soft commitment: Gym, casual plans, recurring events the user sometimes skips. These are potentially flexible.
- Tentative: Events marked as tentative or "maybe" in the calendar.
- Buffer time: The agent identifies when a user has back-to-back commitments and automatically adds buffer time around hard blocks (configurable per user — some people need 10 minutes between things, some need 30).

The classification is done by the Personal Agent using the LLM — it reads event titles, descriptions, and patterns to make intelligent guesses. Users can correct classifications and the agent learns from corrections.

Calendar sync is real-time via webhooks where supported (Google Calendar push notifications) or polled periodically. Changes to a user's calendar mid-negotiation trigger a re-evaluation.

### 2. Natural Language Preferences

Users don't fill out forms. They type or say things like:

- "I hate mornings, don't schedule anything before 11"
- "Fridays I'm mentally checked out after 2pm"
- "I don't mind late meetings on weekdays but weekends are off limits"
- "If it's a short meeting I can squeeze it in anywhere, but for longer ones I need a real break before and after"
- "I have a long walk from the engineering building so anything right after my 10am class needs to be nearby"
- "I'd rather meet twice a week for 30 minutes than once for an hour"

The Personal Agent parses these into structured preference rules that it stores and applies to all future scheduling requests. Preferences are ranked by strength (hard rule vs soft preference) and can conflict — the agent resolves conflicts using the most recent and most specific statement.

Users can view, edit, and delete their parsed preferences in a settings panel. Each preference shows the original natural language input and the agent's interpretation so users can verify it understood correctly.

### 3. Smart Resolution with Explanation

The system doesn't just show a heatmap — it makes the decision and explains it. The final output for any meeting request includes:

- The chosen time in a clear, prominent display
- Why this time was chosen in plain English: "Thursday at 3pm was selected because all 8 members are available, it avoids back-to-back meetings for 3 members who have class right before, and it scores highest on the group satisfaction metric (avg: 87/100, min: 72/100)."
- Who's compromising and what they're giving up: "Maria's agent noted she usually goes to the gym at this time but has historically been flexible with it. Jake's agent accepted despite a mild preference against Thursday afternoons."
- Alternative options ranked: "If Thursday doesn't end up working, Wednesday at 2pm is the next best option (avg satisfaction: 81/100)."
- One-click accept/reject for each participant, with the option to provide a reason if rejecting

### 4. Real-Time Negotiation Visualization

When a meeting negotiation is running, users can watch it happen live on a dashboard. This serves two purposes: transparency (users understand how the decision was made) and demo appeal (this is the hackathon wow moment).

The visualization shows:

- Each Personal Agent as a node/avatar in a network
- Messages flying between agents and the Mediator in real time
- A shrinking set of candidate time slots as agents eliminate options
- Each agent's current top preference and what they're pushing for
- The Mediator's current best proposal and aggregate satisfaction score
- A convergence indicator showing how close the agents are to agreement
- A running log of agent reasoning: "Sarah's agent rejected 9am (morning aversion, satisfaction: 15). Jake's agent offered gym slot as flexible (satisfaction bumped from 40 to 65). Mediator proposed Tuesday 2pm. 6/8 agents accepted..."

This should be built with WebSockets pushing updates to a React frontend. The visualization should feel alive — agents communicating, options narrowing, convergence happening in real time. Even if the actual negotiation takes 3-5 seconds of compute, animate it over 10-15 seconds so users can follow along.

### 5. Group and Club Management

Users can create persistent groups that map to real-world organizations:

- Club groups with a president/admin who can create meeting requests on behalf of the group
- Study groups that are smaller, more informal
- Project teams for class group projects
- Custom groups for anything else (friend groups, intramural teams)

Each group has:

- A member list with roles (admin, member)
- A join link or invite system (link-based for ease, email invite for specificity)
- A meeting history showing all past scheduled meetings, attendance, and satisfaction scores
- Group-level preferences that the Mediator respects ("this club always meets in the evening," "this study group prefers the library")
- Recurring meeting support with automatic rescheduling when semester schedules change

### 6. Recurring Meeting Intelligence

For groups that meet regularly (weekly club meetings, biweekly study sessions), the system doesn't just find one good time — it finds the recurring slot that works best across the entire semester or specified date range.

The Mediator evaluates each candidate recurring slot against every instance over the date range:

- "Tuesday at 3pm works for all members 11 out of 13 weeks. Week 5 has a conflict for 2 members (midterms). Week 10 has a conflict for 1 member (career fair)."
- It recommends the slot with the highest overall coverage and flags the specific weeks that need exceptions
- For exception weeks, it automatically proposes alternatives or asks if the group wants to skip

When someone's schedule changes mid-semester (dropped a class, picked up a shift), their Personal Agent detects the change from the calendar sync and alerts the Mediator, which re-evaluates and either confirms the existing time still works or proposes a new one.

### 7. Nudge System

The anti-ghosting feature. When a meeting request is pending:

- After 2 hours with no response: gentle reminder with the current winning time and a one-tap confirm button
- After 12 hours: more specific nudge — "We're waiting on you and 2 others. Tuesday at 3 is winning. Your calendar shows you're free — can you confirm?"
- After 24 hours: escalation to group admin — "3 members haven't responded. Here's what we can determine from their calendars. Do you want to proceed with the best available option?"
- If a user's calendar is connected, the Nudge Agent can propose a pre-filled response: "Based on your calendar, it looks like the proposed time works. Tap to confirm or let us know if something's off."

Nudges are delivered via in-app notification, email, or SMS depending on user preferences. The Nudge Agent tracks which channels get the fastest responses per user and adapts.

### 8. Location-Aware Scheduling (Stretch Feature)

If users provide their class schedule or the system knows building locations on campus:

- The Mediator considers where each participant is coming from at the proposed meeting time
- It suggests a meeting location that minimizes total travel distance or is closest to the majority
- It accounts for building hours (library closes at midnight, student union closes at 10pm)
- It can suggest room bookings if integrated with a campus room reservation system
- For back-to-back situations: "5 of your members have class in the engineering quad right before — the study room in Kim Building is a 2-minute walk"

### 9. Schedule Density and Fatigue Awareness

The Personal Agent doesn't just check if a slot is empty — it evaluates the user's full day context:

- Back-to-back detection: If the user has had 3 hours of straight classes before the proposed meeting, the agent lowers the satisfaction score and flags fatigue risk
- Long day detection: If the meeting would make the user's day exceed a threshold (configurable, default 10 hours of commitments), the agent pushes back
- Day balance: The agent prefers spreading meetings across the week rather than clustering them
- Post-meeting buffer: The agent knows if the user has something immediately after and factors in whether they'll feel rushed
- Weekly load: If the user already has 5 meetings scheduled this week and this would be the 6th, the agent notes diminishing tolerance

### 10. Analytics Dashboard

Users and group admins get insights over time:

- Personal analytics: Your most productive meeting times, how often you compromise, your actual attendance rate vs commitment rate, preference patterns the agent has learned
- Group analytics: Average scheduling time (how long negotiations take), member responsiveness rankings, most common meeting times, attendance trends, satisfaction score trends over the semester
- Agent performance: How often the agent's initial proposal was accepted without modification, how often users overrode their agent, whether satisfaction scores correlate with actual attendance

## Technical Implementation Details

### LLM Integration

All agent reasoning is powered by Claude API (claude-sonnet-4-6 for Personal Agents, claude-sonnet-4-6 for the Mediator — Mediator needs more reasoning capability for complex multi-party optimization).

**Personal Agent prompt template:**

```
You are a personal scheduling agent representing {user_name}. Your job is to evaluate proposed meeting times and advocate for your user's preferences while remaining cooperative.

USER'S CALENDAR (next 2 weeks):
{calendar_events_json}

USER'S STATED PREFERENCES:
{parsed_preferences_list}

USER'S HISTORICAL PATTERNS:
- Average meeting acceptance rate: {rate}
- Times they tend to reject: {patterns}
- Soft commitments they've previously been flexible about: {flexible_events}

MEETING REQUEST:
{meeting_details}

CANDIDATE TIME SLOTS:
{slots_list}

Evaluate each candidate slot and return a JSON response with satisfaction scores (0-100), constraint classifications, and reasoning for each score. Advocate for your user but be willing to compromise on soft preferences when it helps the group. Flag any slot where your user would need to give something up.
```

**Mediator prompt template:**

```
You are a mediator agent coordinating a group scheduling negotiation. Your goal is to find the time slot that maximizes overall group satisfaction while being fair to all participants.

MEETING REQUEST:
{meeting_details}

PARTICIPANT RESPONSES:
{all_personal_agent_responses_json}

Find the optimal meeting time. Prioritize:
1. No hard constraint violations for anyone
2. Maximize minimum individual satisfaction (Rawlsian fairness)
3. Maximize aggregate satisfaction as a tiebreaker
4. Prefer slots that don't require anyone to sacrifice soft commitments

If no slot achieves >50 satisfaction for all participants, identify the minimum set of compromises needed and which specific users you'd need flexibility from.

Return a JSON response with your top 3 recommended slots, satisfaction breakdowns per participant, a plain-English explanation of your reasoning, and any specific asks for flexibility from individual agents.
```

### API Rate Limiting and Cost

For a group of 30 people, one negotiation round requires:

- 30 Personal Agent calls (one per user, can be parallelized)
- 1 Mediator call to aggregate
- Potentially 1-2 more rounds if negotiation is needed
- Estimated ~35-65 API calls per meeting scheduled

To manage costs:

- Cache calendar data and preference parsing (don't re-parse preferences every time)
- Batch Personal Agent evaluations where possible
- Use claude-sonnet-4-6 for Personal Agents (cheaper, fast enough for scoring)
- Reserve more expensive models for the Mediator's final reasoning
- Set a max negotiation rounds limit (3 rounds, then escalate to humans)
- For hackathon demo: mock some of the agent calls with pre-computed responses to avoid rate limits during live demo

### Database Schema (Core Tables)

```
users
  - id, email, name, created_at
  - calendar_provider (google, outlook, apple)
  - calendar_oauth_token (encrypted)
  - notification_preferences (json: channels, quiet hours)

user_preferences
  - id, user_id, raw_text, parsed_rules (json), strength (hard/soft), created_at, active (bool)

groups
  - id, name, type (club, study_group, project_team, custom), created_at
  - default_duration, default_location_preference
  - recurring_schedule (json, nullable)

group_members
  - group_id, user_id, role (admin, member), joined_at

meeting_requests
  - id, group_id, requested_by, title, duration_minutes
  - date_range_start, date_range_end
  - is_recurring, recurrence_pattern (json, nullable)
  - location_constraint (nullable)
  - urgency (low, normal, high)
  - status (negotiating, scheduled, cancelled, rescheduled)
  - created_at

negotiation_sessions
  - id, meeting_request_id, round_number
  - mediator_proposal (json)
  - status (active, converged, escalated)
  - started_at, completed_at

agent_responses
  - id, negotiation_session_id, user_id, round_number
  - slot_evaluations (json: array of slot scores)
  - hard_blocks (json)
  - notes (text)
  - responded_at

meeting_decisions
  - id, meeting_request_id
  - chosen_datetime, chosen_location (nullable)
  - explanation (text: the mediator's plain-English reasoning)
  - satisfaction_breakdown (json: user_id -> score mapping)
  - alternatives (json: ranked backup options)
  - decided_at

meeting_attendance
  - meeting_decision_id, user_id
  - rsvp_status (accepted, declined, pending)
  - actually_attended (bool, nullable — filled in post-meeting)
  - override_reason (text, nullable — if user rejected agent's recommendation)

nudge_log
  - id, meeting_request_id, user_id
  - nudge_type (gentle, specific, escalation)
  - channel (in_app, email, sms)
  - sent_at, responded_at (nullable)
```

### Frontend Pages and Components

1. **Dashboard (Home)**
   - Today's meetings
   - Pending meeting requests needing your attention
   - Your agent's status (connected, preferences loaded, calendar synced)
   - Quick actions: create meeting, join group
2. **Meeting Request Creation**
   - Select group or add individual members by email/link
   - Set title, duration, date range, any constraints
   - Toggle recurring
   - Natural language constraint input: "needs to be after everyone's classes" parsed in real time
   - Launch negotiation button
3. **Negotiation Live View**
   - Real-time visualization of agents negotiating (the demo money shot)
   - Agent avatars with status indicators
   - Candidate slots shrinking as agents eliminate options
   - Running reasoning log
   - Convergence progress bar
   - Final result display with explanation and satisfaction breakdown
4. **Group Management**
   - Create/join groups
   - Member list with roles
   - Group meeting history and analytics
   - Group-level preference settings
   - Share/invite link generation
5. **Personal Preferences**
   - Natural language input box for new preferences
   - List of current preferences with the raw text and parsed interpretation
   - Edit/delete preferences
   - Calendar connection status and classification review (see which events are marked hard vs soft, correct misclassifications)
6. **Calendar View**
   - Weekly/daily view of synced calendar
   - Color coding: hard blocks (red), soft blocks (yellow), free (green), scheduled via MultiMeet (blue)
   - Overlay showing meeting proposals and their satisfaction scores
7. **Analytics**
   - Personal: your meeting patterns, compromise frequency, agent accuracy
   - Group: scheduling efficiency, attendance rates, satisfaction trends

### Real-Time Communication

WebSocket connection (Socket.io or native WebSockets) between client and server for:

- Pushing negotiation round updates to the live view
- Sending instant nudge notifications
- Updating calendar sync status
- Broadcasting meeting decisions to all group members
- Agent reasoning log streaming during negotiation

### Authentication and Authorization

- OAuth 2.0 for calendar provider connections (Google, Microsoft, Apple)
- Email/password or magic link for app authentication
- JWT tokens for API authorization
- Group admin permissions for creating meetings and managing members
- Users can only see their own agent's detailed reasoning; they see other agents' satisfaction scores but not the underlying reasoning (privacy)

### Tech Stack Recommendation

- **Frontend**: React with TypeScript, Tailwind CSS, Framer Motion (for negotiation visualization animations), Socket.io client
- **Backend**: Python FastAPI (async, good for concurrent agent calls) or Node.js Express
- **Database**: PostgreSQL with Prisma or SQLAlchemy ORM
- **Real-Time**: Socket.io or WebSockets
- **AI**: Anthropic Claude API (claude-sonnet-4-6 for agents)
- **Calendar Integration**: Google Calendar API, Microsoft Graph API for Outlook
- **Auth**: NextAuth.js or custom JWT
- **Deployment**: Vercel (frontend), Railway or Fly.io (backend), Supabase or Neon (database)
- **Caching**: Redis for agent session state and calendar data caching

## Hackathon Demo Script

If presenting this at a hackathon, the demo flow should be:

1. **The pain point (15 seconds).** "Everyone here has used When2Meet. You paint a grid, wait 3 days for responses, stare at a heatmap, and still argue in the group chat about which time to pick."
2. **The product (15 seconds).** "MultiMeet gives every group member an AI scheduling agent. You connect your calendar, tell it your preferences in plain English, and it negotiates on your behalf."
3. **Live demo — preference setup (20 seconds).** Show one user typing "I hate mornings and I need at least 30 minutes between my classes and meetings" and the agent parsing it into structured rules.
4. **Live demo — create meeting (10 seconds).** Club president creates a meeting request for 8 members, Tuesday through Thursday next week, 1 hour.
5. **Live demo — negotiation visualization (30 seconds).** THIS IS THE MONEY SHOT. Show the 8 agents activating simultaneously, evaluating slots, the mediator proposing options, agents pushing back, the candidate set narrowing, and convergence on a final time. Show the reasoning log scrolling in real time. The audience should be able to see agents advocate for their users — "Sarah's agent rejected 9am due to morning preference" — "Jake's agent offered flexibility on gym slot" — "Mediator proposed Tuesday 2pm" — "Consensus reached: satisfaction range 72-95."
6. **The result (15 seconds).** Show the final decision card with time, explanation, satisfaction breakdown, and the one-click accept button. Compare to When2Meet: "This took 10 seconds and nobody had to paint a grid."
7. **Architecture slide (15 seconds).** Quick technical slide showing multi-agent architecture: personal agents, mediator, negotiation protocol. Mention the tech stack. This is where you say "multi-agent system," "adversarial cooperation," and "Rawlsian fairness optimization" for the judge buzzword points.

Total: ~2 minutes.

## MVP vs Stretch Features

### MVP (Build This for the Hackathon)

- Google Calendar OAuth sync
- Natural language preference input with LLM parsing
- Personal Scheduling Agent that scores time slots
- Mediator Agent that aggregates and picks the best time with explanation
- Real-time negotiation visualization
- Group creation with invite links
- Final decision display with satisfaction breakdown and reasoning

### Stretch (If Time Permits)

- Recurring meeting support
- Nudge agent for non-responders
- Location-aware scheduling
- Schedule density and fatigue scoring
- Analytics dashboard
- Multiple calendar provider support (Outlook, Apple)
- SMS/email notifications
- Meeting attendance tracking and feedback loop
- Mobile-responsive design or native app

### Post-Hackathon (Future Roadmap)

- Agent learning from user corrections and attendance history
- Collaborative filtering: "students with similar schedules liked this slot"
- Room booking integration with campus systems
- Weather-aware suggestions for in-person meetings
- Integration with Slack, Discord, GroupMe for nudges
- API for third-party integrations
- Campus-specific deployments with building and transit data
