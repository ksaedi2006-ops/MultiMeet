---
name: MeetMind
description: Group scheduling negotiated by agents, shown as a night air-traffic tower
colors:
  board: "#22313f"
  board-raised: "#2a3b4b"
  board-line: "#3c5266"
  glass: "#0c131d"
  strip: "#ecdfc2"
  strip-ink: "#2a2015"
  clearance: "#d4551c"
  clearance-dim: "#a13f13"
  signal: "#f4844f"
  amber: "#e8a93a"
  mist: "#93aabd"
  score-low: "#dcd1b6"
  score-mid: "#e2ac4e"
  score-high: "#684616"
typography:
  display:
    fontFamily: "Big Shoulders Display, IBM Plex Sans, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Big Shoulders Display, IBM Plex Sans, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  stamp:
    fontFamily: "Big Shoulders Display, IBM Plex Sans, sans-serif"
    fontSize: "clamp(1.875rem, 6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "tnum"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.6
    fontFeature: "tnum"
  callsign:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.025em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "0.16em"
rounded:
  cell: "1px"
  sm: "2px"
  md: "3px"
  pip: "9999px"
spacing:
  hairline: "1px"
  cell-gap: "3px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-clearance:
    backgroundColor: "{colors.clearance}"
    textColor: "{colors.strip}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-clearance-hover:
    backgroundColor: "{colors.clearance-dim}"
  button-console:
    backgroundColor: "transparent"
    textColor: "{colors.strip}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  button-console-hover:
    textColor: "{colors.amber}"
  button-ink:
    backgroundColor: "transparent"
    textColor: "{colors.strip-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-ink-pressed:
    backgroundColor: "{colors.strip-ink}"
    textColor: "{colors.strip}"
  flight-strip:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.strip-ink}"
    rounded: "{rounded.sm}"
    height: "48px"
  console-panel:
    backgroundColor: "{colors.board-raised}"
    textColor: "{colors.strip}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  speaker-chip-tower:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.board}"
    typography: "{typography.callsign}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  stamp-large:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.clearance}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
---

# Design System: MeetMind

## Overview

**Creative North Star: "The Night Tower"**

MeetMind is a control tower after dark. The ground is a steel-blue console board; the radar scope is a darker pane of glass set into it; live traffic is amber phosphor; people are manila flight strips racked in a bay; and safety orange appears only when something is closed, called, or cleared. The screen shows the mechanism at work: every agent is an aircraft, every candidate time a fix on the rim, and the decision is a landing followed by an ink stamp.

Density is operational. Small mono readouts, hairline rules and tight strip rows sit beside one large instrument (the scope) and a few loud display-face statements (the event title, the cleared time, the stamp). Contrast comes from the material, not from effects. Phosphor is drawn as afterglow on the canvas, never as CSS glow. Strips lift off the board with a soft drop shadow, and panels are outlined in hairlines. Nothing is blurred or glassy.

The identity is binding (PRODUCT.md): go deeper into the tower and flight-strip world rather than replacing it.

**Key Characteristics:**
- Steel-blue board, darker scope glass, manila strips, amber live traffic, orange reserved for closure and clearance.
- Three faces, three jobs: Big Shoulders Display announces, Plex Mono reads out data, Plex Sans speaks prose.
- Hairline borders and 2px corners everywhere; the only round shapes are the scope and status pips.
- Motion runs on a continuous sweep, critically damped flight and one-shot pulses, and every animation respects reduced motion.

## Colors

The palette is a night tower: cool, low-saturation steel for everything structural, with two warm signals of different weight. Amber means live. Orange means official.

### Primary
- **Safety Orange** (`clearance`): Used only for closures, clearances, tower calls, the runway corridor, the winning score cell's ring, the fairness meter's least-happy marker, primary action fills, the routing stripe on a strip's top edge, and the stamp. It is used as a fill or stroke, never as small text on the board.
- **Burnt Clearance** (`clearance-dim`): Hover state for orange fills. Also the readable form of orange on manila (status words after a clearance, the "who gave something up" label, errors on a strip).
- **Signal Orange** (`signal`): Safety orange used as text on the board: the decided phase readout, LEAST HAPPY, and the close/clear/warn lines in the tower log. It exists for contrast, so it never replaces `clearance` on a fill.

### Secondary
- **Phosphor Amber** (`amber`): Live traffic. Aircraft, sweep, data tags, agent speakers, rank numerals, the average marker, the on-frequency pip, hover and focus states, and the text caret.

### Tertiary
- **Score Ink** (`score-low` → `score-mid` → `score-high`): How much a person wants a time, inked onto their strip. The ramp runs from barely-there manila through amber to a deep amber-brown and is interpolated linearly through the midpoint at 50. Unscored cells are strip-ink at 8% and closed cells are strip-ink at 28%, squeezed to a 1.5px line.

### Neutral
- **Console Steel** (`board`): The page ground.
- **Raised Steel** (`board-raised`): Panel fills, applied at 40-60% over the board.
- **Board Hairline** (`board-line`): Every border and divider on the board, and the scrollbar.
- **Scope Glass** (`glass`): Anything that sits on the radar: the scope's outer edge (its radial fill runs from `#102030` to the glass) and the large stamp's fill.
- **Manila** (`strip`): Flight strips and the decision brief. It is also primary text on the board at 75-90% opacity.
- **Strip Ink** (`strip-ink`): Text on manila. Secondary text on manila is strip-ink at 65%.
- **Instrument Mist** (`mist`): Metadata on the board: clocks, panel labels, day labels, the HOLD state, and placeholders.

### Named Rules
**The Reserved Orange Rule.** Safety orange marks closures, clearances, tower calls, the runway, the winning cell, primary actions and the stamp, and nothing else. If an element is merely important, use amber or manila instead.

**The Signal-for-Text Rule.** Orange text on the board is always `signal`, and orange text on manila is always `clearance-dim`. Raw `clearance` appears as text only inside the stamp.

**The Ink-Not-Orange Rule.** Scores are inked manila → amber → amber-brown. A high score is never orange, because orange already means "closed" or "cleared".

## Typography

**Display Font:** Big Shoulders Display (fallback IBM Plex Sans), weights 600-800 loaded, 700 used
**Body Font:** IBM Plex Sans (400, 500, 600)
**Label/Mono Font:** IBM Plex Mono (400-700, italic 400)

**Character:** Big Shoulders is condensed and loud like airfield signage, Plex Mono reads like a teleprinter, and Plex Sans is the controller's plain voice. The three never trade roles.

### Hierarchy
- **Display** (700, 30px to 36px, line-height 1, tracking -0.025em): Event title in the status bar. The cleared time on the decision brief uses the same face at 30px with line-height 1.05.
- **Headline** (700, 24px): Panel statements such as "3 of 7 checked in" and "The negotiation stopped".
- **Stamp** (700, 30px to 48px, tracking 0.12em, uppercase): The large stamp's word only. Its detail line is mono.
- **Body** (400, 15px, 1.375-1.625): Radio ticker transcript and decision explanation. Body-sm (13-14px) is used for log message text and panel notes.
- **Figure** (mono 600, 24px, tabular): LEAST HAPPY / AVERAGE values.
- **Data** (mono 500, 12px, tabular): Log clocks and speakers, scope labels, day labels (11px), and status words.
- **Callsign** (mono 600, 14px, tracking 0.025em, uppercase): Strip callsigns and radio speaker chips (12px).
- **Label** (mono 400, 11px, tracking 0.14-0.18em, uppercase): Panel headings (FAIRNESS, TOWER LOG), definition terms, and console button text (tracking 0.05em).

### Named Rules
**The Three Voices Rule.** Plex Mono is for data only (scores, times, callsigns, readouts, controls). Plex Sans is for prose. Big Shoulders Display is for titles, the cleared time and the stamp. A sentence set in mono, or a number set in display, is wrong.

**The Heading-Is-The-Label Rule.** A small tracked mono label is allowed as a panel's own heading or a list's own heading. It never sits above a display heading as an eyebrow.

## Layout

The page is centred to a 1600px maximum with 16px side padding (32px from 640px up). A thin status bar (16px vertical padding, hairline bottom rule) holds the title, phase readout, elapsed clock and playback controls, and wraps on narrow screens.

From 1024px up, the body is a two-column grid: the scope column (1.5fr) and the strip bay (minmax(360px, 1fr)), with a 32px gap (24px below 1024px). The scope is a square capped at the viewport height minus 13rem so it dominates the first viewport. The radio ticker sits directly under it. The bay stacks its state panel (holding, fairness, decision or failure) above the strip board with a 16px gap. The tower log runs full width beneath both at a fixed 22rem height. Below 1024px everything stacks: scope, ticker, panel, strips, log.

Strips are 48px rows on a 6px rhythm. A fixed 10.5rem identity column is followed by a score track whose day groups are separated by 3px and whose slots are separated by 1px. Open slots flex to fill the track, and closed slots collapse to fixed 1.5px lines, animated over 700ms. Panels use 12-16px vertical and 16px horizontal padding.

## Elevation & Depth

The board is flat and tonal. Panels separate from the board with a hairline border and a translucent `board-raised` fill, not a shadow. Only manila lifts. Strips cast a short, tight shadow, and the decision brief casts a deeper, softer one, as if paper had been laid on the console. The scope reads as recessed because its glass is darker than the board. On decision, the scope behind the stamp is darkened by a plain radial gradient, and the stamp itself sits on solid glass.

### Shadow Vocabulary
- **Strip lift** (`box-shadow: 0 6px 14px -8px rgba(0,0,0,0.7)`): Each flight strip in the bay.
- **Brief lift** (`box-shadow: 0 20px 50px -20px rgba(0,0,0,0.8)`): The decision brief, the one large manila card.

### Named Rules
**The No-Glow Rule.** No CSS glows, no blur or frosted plates, and no coloured halos. Phosphor afterglow belongs to the canvas sweep. Ink, text and borders never emit light.

## Shapes

Corners are nearly square. Strips, panels, buttons, chips and the stamp use 2px. Score cells use 1px. The shared Strip and Button components use 3px. Round shapes are reserved for the scope, its range rings and the small status pips (live dot, average marker). Borders are hairlines (1px `board-line` on the board, strip-ink at 15-30% on manila). The heaviest stroke is the stamp's 3px orange border. A manila card may carry a 4px safety-orange routing stripe on its top edge, like a controller's coloured strip holder. Scope geometry uses triangles for fixes and aircraft, crosses for closed fixes, and leader lines from aircraft to their data tags.

## Components

### Buttons
Console hardware: mono, uppercase, flat, nearly square.
- **Shape:** 2px corners (3px on the shared Button component).
- **Clearance (primary):** Safety-orange fill with manila text, 11-12px mono label, 40-44px tall. Used for Start, Add to calendar and other committing actions.
- **Hover / Focus:** The fill darkens to `clearance-dim`. Focus is a 2px amber outline at 2px offset, set globally. Disabled fills drop to 40% orange.
- **Console (on the board):** Hairline `board-line` border with manila text at 80%. On hover the border and text turn amber. 32px tall, with an inline 14px stroke icon and the label hidden below 640px. Disabled at 35% opacity.
- **Ink (on manila):** A strip-ink border at 30% that turns solid on hover. When pressed it fills with strip-ink and the text becomes manila (RSVP).

### Flight Strip (signature)
A manila 48px row per person. The identity column shows the callsign (mono 14/600), a carrier or SIM tag, the name in sans 12px, and a status word on the right. The score track shows one cell per candidate time, inked by score. The winning cell gets a 2px inset safety-orange ring, and the other open cells drop to 40%. A strip the tower is calling slides 14px left out of the bay (spring 260/28). The status word reads strip-ink at full strength while called and `clearance-dim` after clearance. Hovering a strip highlights that agent on the scope and outlines the strip in amber.

### Console Panel
A hairline-bordered box with a translucent raised fill, 2px corners and a mono label heading. It is used for the fairness meter, the holding panel and the tower log. Failure panels swap the border to orange at 60%.

### Fairness Meter
A hairline track with a COMFORT 50 tick, an amber span from least-happy to average, a 3px safety-orange bar at the least-happy score, and an amber ring at the average. All positions ease over 700ms.

### Radio Ticker and Tower Log
The ticker types the latest transmission at about two characters per 16ms behind an amber block cursor. Its speaker chip is manila on board for the tower and amber at 15% for agents. The log is a three-column grid (clock, speaker, message). Speaker colour follows the line's tone (mist for system, amber for agents, manila for the tower, `signal` for close, clear and warn), and rounds are separated by hairline dividers. The viewer's private note is shown in amber at 80%.

### Radar Scope
A canvas instrument: glass fill, mist range rings and bearing ticks, day labels on the rim, and an amber sweep with afterglow on a 5.2s period. Fixes are triangles. A closed fix is crossed out with an orange flicker, the leading fixes are numbered in amber, and the winning fix is solid orange. Aircraft are amber squares with fading trails (orange while called, mist when the agent is simulated or holding), each carrying a two-line mono data tag on a glass plate. The finale draws an orange runway corridor and lands aircraft at 520ms intervals. The scope is decorative to assistive tech, and the strips and log carry the same facts.

### Stamp
A rectangular ink stamp with a 2px orange border (3px when large) and orange lettering. It lands with an overshooting spring (280/14), going from 1.9× scale and +8° to rest at -4°. The large size sets the word in display and the detail in mono, filled with `glass` so the sweep and runway never cross the lettering. The small and medium sizes are mono throughout.

### Flow Pages
The pages before the negotiation share its system. Each is a two-column spread on the board: display headline, one plain sentence, a manila form or list on one side, a live visual on the other, all staggering in on the same ease. The progress nav above them shows the steps the viewer actually does, with a drawn check for finished steps and an amber rule that slides between positions.

- **Landing** puts the radar scope in the hero, replaying a recorded 14-agent negotiation on a loop, with the sample runner (8, 16 or 30 generated people) beside the primary action. It ends with the four-step protocol as drawn rules that fill as they scroll into view.
- **Flight plan** is a printed form on a manila strip with ruled underlines that light on focus, segmented chips for length and days, and a preview grid of the times that will be searched, repainting as settings change.
- **Frequency** pairs the invite link and a roster of strips (CAL, rules, checked-in state) with a holding-pattern scope that gains an aircraft as each person joins. A FILED stamp lands on arrival.
- **Manifest** is a drop zone, a list of commitments that flip between fixed and movable, and a week grid where fixed blocks are solid manila and movable blocks are hatched.
- **Briefing** is a transcript where the agent's replies carry the rules it understood as chips, beside a rulebook of strips that can be removed.

## Do's and Don'ts

### Do:
- **Do** reserve `clearance` for closures, clearances, tower calls, the runway, the winning cell, primary actions and the stamp.
- **Do** use `signal` for orange text on the board and `clearance-dim` for orange text on manila.
- **Do** ink scores along the manila → amber → amber-brown ramp.
- **Do** set data in Plex Mono with tabular figures, prose in Plex Sans, and titles, the cleared time and the stamp in Big Shoulders Display.
- **Do** fill anything that sits on the scope with `glass`.
- **Do** separate panels on the board with 1px `board-line` hairlines and 2px corners, and let only manila cast shadows.
- **Do** give every timed or looping motion a reduced-motion path that jumps to the end state.

### Don't:
- **Don't** set a high score, a leading time or emphasis in safety orange.
- **Don't** use raw `clearance` as small text on the board or on manila.
- **Don't** put a small tracked label above a heading as an eyebrow.
- **Don't** add glows, blur or frosted plates, or coloured halos.
- **Don't** use coloured side borders as accents. The orange routing stripe belongs only on a manila card's top edge.
- **Don't** use text glyphs (✓, →) as icons. Draw icons as inline 16px-grid SVG strokes.
- **Don't** label simulated agents as real. SIM tags and the SIMULATED AGENTS chip stay visible.
