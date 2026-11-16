---
version: 1
slug: "frontend-src-pages-negotiationliveview-tsx"
primary_target: "frontend/src/pages/NegotiationLiveView.tsx"
related_targets: []
---

# Live negotiation (tower console)

Scope: `/event/:eventId/negotiate`, the screen where the group's agents negotiate live. Mode: Experience (the negotiation itself is what the visitor watches). Code-led: no image generation on this machine.

Audience: hackathon judges on a projector (~2 min demo, presenter present) and recruiters opening the link alone, often on a phone. Job: understand within seconds that several agents are arguing over real constraints, then watch them converge on a fair time and see who compromised.

Constraints: inherits the established tower / flight-strip world (user-pinned). Must stay smooth at 30 agents and 80 slots, respect reduced motion, work at phone width. Pacing ~30-45s for a full negotiation regardless of backend speed; pause, replay and skip-to-end. Radar scope dominates the first viewport (user-confirmed). Scope is decorative to assistive tech; the strip board and tower log carry the same facts accessibly.

## Direction contract

THESIS: The negotiation is air traffic. Candidate times are fixes on a radar rim, agents are aircraft drawn toward the times they want, the mediator is the tower, and the decision is a landing. Refuses the category default: a spinner, then a result card, or a chat log of agent messages.

OWN-WORLD: Night tower. Steel-blue board ground with a darker scope glass, amber phosphor for live traffic, safety-orange reserved for closures and clearances, manila flight strips for people. Big Shoulders Display for callouts and the cleared time, IBM Plex Mono only for data (scores, times, callsigns), Plex Sans for prose. Hairline range rings, fix triangles, data tags with leader lines.

STORY: The visitor sees traffic holding, then a sweep closes every time someone's calendar forbids, agents score and drift toward their favourites, the tower radios specific people to flex, tags flip to FLEX or HOLD, aircraft vector onto one runway and touch down. They understand the chosen time is the fairest, who gave something up, and can add it to their calendar.

FIRST VIEWPORT: Desktop: thin status bar (event title in display face, phase readout, elapsed, playback controls); scope as a large circle filling ~60% width at left, tower radio ticker under it; right column of manila strips with per-slot score cells, fairness meter above them. Phone: scope full width first, strips below, log last.

FORM: Radar scope plus strip bay, the plan's chosen form, position 1 of 1. No concept roll was run: the user pinned the direction, answering "Keep it and go much deeper" to keeping the tower / flight-strip identity and asking "for now just want the coolest visuals possible during it", then approving the plan that specified this form. seed: none (direction pinned by user; roll not run)

Signature interaction: the finale vectors every aircraft onto a runway corridor to the winning fix and lands them in order, least-compromised first, then the CLEARED stamp lands. Motion grammar: continuous sweep with afterglow, critically damped flight, one-shot pulses for radio calls.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
