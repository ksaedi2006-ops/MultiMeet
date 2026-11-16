---
name: MultiMeet
description: Group scheduling negotiated by agents, shown on a radar-style scope in plain language
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
  name-tag:
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
  person-card:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.strip-ink}"
    rounded: "{rounded.sm}"
    height: "48px"
  console-panel:
    backgroundColor: "{colors.board-raised}"
    textColor: "{colors.strip}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  speaker-chip-mediator:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.board}"
    typography: "{typography.name-tag}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  stamp-large:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.clearance}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
---

# Design System: MultiMeet

## Overview

**Creative North Star: "The Night Console, Spoken Plainly"**

MultiMeet looks like an instrument and talks like a person. The ground is a steel-blue console; the scope is a darker pane of glass set into it; people's agents are amber dots that drift toward the times they prefer; people and forms are manila paper cards; and safety orange appears only when a time is crossed out, someone is asked to move, or a time is booked. The look borrows from a radar room. The words never do: every label, status and sentence is plain English a stranger on a phone understands in five seconds (PRODUCT.md).

The whole app is one console that never reloads. The scope stays mounted; a route only changes the step, which moves the scope's camera and swaps what the left and right panels hold.

Density is operational. Small readouts, hairline rules and tight rows sit beside one large instrument (the scope) and a few loud display-face statements (titles, the booked time, the stamp). Contrast comes from the material, not from effects. Phosphor afterglow lives on the scope canvas only; cards lift off the console with a soft drop shadow, and panels are outlined in hairlines. Nothing is blurred or glassy.

**Key Characteristics:**
- Steel-blue console, darker scope glass, manila cards, amber live state, orange reserved for crossed-out, asked and booked.
- Three faces, three jobs: Big Shoulders Display announces, Plex Mono reads out data, Plex Sans speaks prose and names.
- Hairline borders and 2px corners everywhere; the only round shapes are the scope and status pips.
- Motion runs on a continuous sweep, eased camera moves, critically damped drift and one-shot pulses, and every animation respects reduced motion.

**Vocabulary (user-visible):** dots are people's agents, labelled with first names; marks on the ring are times; the centre is the Mediator; a crossed-out time is one someone can't make ("Can't: Nora's bookstore shift"); replies are Can move / Won't move / Agrees; the result is Booked, or No time works. Steps are New meeting, Invite people, Your calendar, Your preferences, Negotiating, Booked. Never shown: tower, TWR, runway, approach, cleared, holding, fixes, callsigns, flight plan, frequency, manifest, briefing, ATIS, Zulu time.

## Colors

The palette is a night console: cool, low-saturation steel for everything structural, with two warm signals of different weight. Amber means live. Orange means official.

### Primary
- **Safety Orange** (`clearance`): Used only for crossed-out times, people the mediator is asking, the chosen-time corridor, the winning score cell's ring, the fairness meter's least-happy marker, primary action fills, the coloured end of the main action card, and the stamp. It is used as a fill or stroke, never as small text on the board.
- **Burnt Clearance** (`clearance-dim`): Hover state for orange fills. Also the readable form of orange on manila ("Booked" status words, the "who gave something up" label, errors on a card).
- **Signal Orange** (`signal`): Safety orange used as text on the board: the booked phase readout, LEAST HAPPY, "Asked to move" tags, the "Can't" line in a time's readout, and the crossed-out/booked/warning lines in the activity list. It exists for contrast, so it never replaces `clearance` on a fill.

### Secondary
- **Phosphor Amber** (`amber`): Live state. Agent dots, the sweep, status lines on name tags, the leading-time labels, agent speakers, the average marker, the live pip, hover and focus states, and the text caret.

### Tertiary
- **Score Ink** (`score-low` → `score-mid` → `score-high`): How much a person wants a time, inked onto their row. The ramp runs from barely-there manila through amber to a deep amber-brown and is interpolated linearly through the midpoint at 50. Unscored cells are strip-ink at 8% and closed cells are strip-ink at 28%, squeezed to a 1.5px line.

### Neutral
- **Console Steel** (`board`): The page ground.
- **Raised Steel** (`board-raised`): Panel fills, applied at 40-60% over the board.
- **Board Hairline** (`board-line`): Every border and divider on the board, and the scrollbar.
- **Scope Glass** (`glass`): Anything that sits on the scope: the scope's outer edge (its radial fill runs from `#102030` to the glass) and the large stamp's fill, and the plate behind the booked time.
- **Manila** (`strip`): Paper cards, person rows, the new-meeting form and the decision brief. It is also primary text on the board at 75-90% opacity.
- **Strip Ink** (`strip-ink`): Text on manila. Secondary text on manila is strip-ink at 65%.
- **Instrument Mist** (`mist`): Metadata on the board: clocks, panel labels, day labels, the legend under the scope, "Won't move", and placeholders.

### Named Rules
**The Reserved Orange Rule.** Safety orange marks crossed-out times, people being asked, the chosen-time corridor, the winning cell, primary actions and the stamp, and nothing else. If an element is merely important, use amber or manila instead.

**The Signal-for-Text Rule.** Orange text on the board is always `signal`, and orange text on manila is always `clearance-dim`. Raw `clearance` appears as text only inside the stamp.

**The Ink-Not-Orange Rule.** Scores are inked manila → amber → amber-brown. A high score is never orange, because orange already means "can't make it" or "booked".

## Typography

**Display Font:** Big Shoulders Display (fallback IBM Plex Sans), weights 600-800 loaded, 700 used
**Body Font:** IBM Plex Sans (400, 500, 600)
**Label/Mono Font:** IBM Plex Mono (400-700, italic 400)

**Character:** Big Shoulders is condensed and loud like signage, Plex Mono reads like an instrument printout, and Plex Sans is the plain voice that explains it. The three never trade roles.

### Hierarchy
- **Display** (700, 30px to 36px, line-height 1, tracking -0.025em): Event title in the status bar. The booked time on the decision brief uses the same face at 30px with line-height 1.05.
- **Headline** (700, 24px): Panel statements such as "3 of 7 ready" and "The negotiation stopped".
- **Stamp** (700, 30px to 48px, tracking 0.12em, uppercase): The large stamp's word only (BOOKED, NO TIME WORKS). The booked day and time beneath it are display 700 at 26-42px, day in manila, time in amber.
- **Body** (400, 15px, 1.375-1.625): Radio ticker transcript and decision explanation. Body-sm (13-14px) is used for log message text and panel notes.
- **Figure** (mono 600, 24px, tabular): LEAST HAPPY / AVERAGE values.
- **Data** (mono 500, 12px, tabular): Log clocks, day labels on the ring (11px), leading-time labels, phase readouts.
- **Name tag** (sans 600, 12.5px on the scope, 14px on rows): People's first names on dots and rows, with a sans 500 status line beneath. Speaker chips use sans 600 at 12px.
- **Label** (mono 400, 11px, tracking 0.14-0.18em, uppercase): Panel headings (FAIRNESS, WHAT'S HAPPENING), definition terms, and console button text (tracking 0.05em).

### Named Rules
**The Three Voices Rule.** Plex Mono is for data only (scores, times, readouts, controls). Plex Sans is for prose and people's names. Big Shoulders Display is for titles, the booked time and the stamp. A sentence set in mono, or a number set in display, is wrong.

**The Heading-Is-The-Label Rule.** A small tracked mono label is allowed as a panel's own heading or a list's own heading. It never sits above a display heading as an eyebrow.

## Layout

The app is one console filling the viewport (no page scroll from 1024px up). A 44px top bar holds the wordmark, the current step in plain words, and the local time. Below it the scope canvas fills the whole body; the left panel (people, actions, the new-meeting form) and the right panel (the explainer, the activity) sit over it as console furniture. The scope's camera frames the largest square in the space the panels leave, with 30px kept underneath for its one-line legend. Panel widths are per step (left 360px, or 660px when the new-meeting form is open; right 400px, or slid away) and shrink with narrow desktops (27% / 29%, never under 280px) so the scope keeps the middle.

Below 1024px the console stacks: top bar, scope band (max(52svh, min(100vw, 88svh))) with its legend, then the explainer, then the cards. The explainer comes before the cards so a phone visitor reads what the app is before what to press.

The negotiation screen (not yet moved into the console) is a two-column grid: the scope column with its legend and ticker, and a column with the state panel above the person rows; the activity list runs full width beneath. Person rows are 48px on a 6px rhythm with a 10.5rem name column and a score track; closed slots collapse to 1.5px lines over 700ms.

## Elevation & Depth

The board is flat and tonal. Panels separate from the board with a hairline border and a translucent `board-raised` fill, not a shadow. Only manila lifts. Cards and person rows cast a short, tight shadow, and the decision brief casts a deeper, softer one, as if paper had been laid on the console. The scope reads as recessed because its glass is darker than the board. On decision, the scope behind the stamp is darkened by a plain radial gradient, and the stamp itself sits on solid glass.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 6px 14px -8px rgba(0,0,0,0.7)`): Each paper card and person row.
- **Brief lift** (`box-shadow: 0 20px 50px -20px rgba(0,0,0,0.8)`): The decision brief, the one large manila card.

### Named Rules
**The No-Glow Rule.** No CSS glows, no blur or frosted plates, and no coloured halos. Phosphor afterglow belongs to the scope canvas (a WebGL persistence buffer, about 0.86 decay per 60Hz frame, with fine grain; a plain canvas fallback without WebGL2). Ink, text and borders never emit light.

## Shapes

Corners are nearly square. Cards, rows, panels, buttons, chips and the stamp use 2px. Score cells use 1px. The shared Strip and Button components use 3px. Round shapes are reserved for the scope, its range rings and the small status pips (live dot, average marker). Borders are hairlines (1px `board-line` on the board, strip-ink at 15-30% on manila). The heaviest stroke is the stamp's 3px orange border. A paper card's coloured end is a 28px block holding a 15px icon (never a thin side stripe): orange for Schedule a meeting, steel for Run a sample, ochre for Recent. Scope geometry uses triangles for times, squares for agent dots, crosses for times someone can't make, and leader lines from dots to their name tags.

## Components

### Buttons
Flat, nearly square, with mono uppercase labels.
- **Shape:** 2px corners (3px on the shared Button component).
- **Primary:** Safety-orange fill with manila text, 11-12px mono label, 40-44px tall. Used for Create meeting, Start, Add to calendar and other committing actions.
- **Hover / Focus:** The fill darkens to `clearance-dim`. Focus is a 2px amber outline at 2px offset, set globally. Disabled fills drop to 40% orange.
- **Console (on the board):** Hairline `board-line` border with manila text at 80%. On hover the border and text turn amber. 32px tall, with an inline 14px stroke icon and the label hidden below 640px. Disabled at 35% opacity.
- **Ink (on manila):** A strip-ink border at 30% that turns solid on hover. When pressed it fills with strip-ink and the text becomes manila (RSVP).

### Paper Card (signature)
Manila ruled into boxes by 1px strip-ink rules, with a coloured end and an icon. On the first screen the cards are the actions: Schedule a meeting, Run a sample (with 8 / 16 / 30 people), and Recent meetings. Choosing Schedule a meeting slides that card out (shared layout) and opens it into the New meeting form: boxes labelled in plain sans ("What's it for", "Your name", "From", "Until", "Time zone", "Length", "Between", "Days"), hours as "9 AM", and a Create meeting button.

### Person Row
A manila 48px row per person on the negotiation screen. The name column shows the full name (sans 14/600, "(you)" for the viewer) and a plain status beneath (Ready, Thinking…, Rated, Asked to move, Can move, Won't move, Agrees, Booked). The score track shows one cell per possible time, inked by score; a one-line caption above explains it. The winning cell gets a 2px inset safety-orange ring and the other open cells drop to 40%. A row whose person the mediator is asking gets a 2px orange outline; hovering a row highlights that dot on the scope in amber.

### Console Panel
A hairline-bordered box with a translucent raised fill, 2px corners and a mono label heading. It is used for the fairness meter, the who-is-ready panel and the activity list. Failure panels swap the border to orange at 60%.

### Fairness Meter
A hairline track with an OK AT 50 tick, an amber span from least-happy to average, a 3px safety-orange bar at the least-happy score, and an amber ring at the average. All positions ease over 700ms.

### Ticker and Activity List
The ticker types the latest message at about two characters per 16ms behind an amber block cursor. Its speaker chip is manila for the Mediator and amber at 15% for people. The activity list ("What's happening") is a three-column grid (clock, speaker, message) with plain sentences: "Crossed out 55 of 72 times someone can't make, e.g. Nora's bookstore shift", "In the lead: Thu Nov 19, 6:00 PM", "Can move. …", "Booked: …". Rounds are separated by hairline dividers. The viewer's private note is shown in amber at 80%.

### Scope
A canvas instrument: glass fill, mist range rings and ticks, plain day labels on the ring ("Tue 18"), and an amber sweep with phosphor afterglow on a 5.2s period. Times are triangles; new ones pop on with a short overshoot and removed ones fade where they stood, and bearings ease when the ring re-lays out. A time someone can't make is crossed out with an orange flicker. The three leading times are filled and labelled with day and time ("Thu 6 PM") on glass plates just inside the ring; the labels step inward to avoid each other and name tags steer around them. Pointing at (or tapping) any time shows a readout: "Wed Nov 25, 12:00 PM · 14 of 16 can make it", with "Can't: Nora's bookstore shift" in signal orange when it is crossed out.

Agent dots are amber squares with fading trails (orange while being asked), each with a name tag on a glass plate: first name (last initial only when two people share it), and a short status line. Above 12 people only names show, unless the person is pointed at, being asked or has just replied. The centre is the Mediator; asks travel from it as a pulse ring and a dashed line to the person. The finale draws an orange corridor to the chosen time and brings the dots in one by one, then the BOOKED stamp lands with the day and time written large beneath it. A one-line legend under the scope says what the marks mean. Leaving a replay, its dots peel off outward. The scope's aria label states the same facts in a sentence.

### Stamp
A rectangular ink stamp with a 2px orange border (3px when large) and orange lettering. It lands with an overshooting spring (280/14), going from 1.9× scale and +8° to rest at -4°. Words: BOOKED, NO TIME WORKS (large, on glass), CREATED (medium, when a meeting is made).

### The Console Steps
Each step is a camera position, not a page.
- **How it works** (first screen): a recorded 14-person negotiation replays on the scope; the right panel types a four-line plain explanation under the heading "Agents that schedule your meeting", then shows the replay's latest message with a "simulated agents" chip; the left panel holds the action cards.
- **New meeting**: the form card opens on the left, the right panel slides away, and the scope eases over to preview every possible time live as days, hours and length change, with a count ("64 possible times over 8 days").
- Still on the earlier page shell, sharing this vocabulary: Invite people, Your calendar, Your preferences (rules shown as MUST / PREFER), Negotiating.

## Do's and Don'ts

### Do:
- **Do** reserve `clearance` for crossed-out times, people being asked, the chosen-time corridor, the winning cell, primary actions and the stamp.
- **Do** use `signal` for orange text on the board and `clearance-dim` for orange text on manila.
- **Do** ink scores along the manila → amber → amber-brown ramp.
- **Do** write every label, status and sentence so a stranger on a phone understands it in five seconds.
- **Do** set data in Plex Mono with tabular figures, prose in Plex Sans, and titles, the booked time and the stamp in Big Shoulders Display.
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
- **Don't** label simulated agents as real. Disclose it once, in plain words ("simulated agents"), rather than tagging every dot.
- **Don't** put aviation words on screen: tower, runway, approach, cleared, holding, fixes, callsigns, flight plan, frequency, manifest, briefing, ATIS or Zulu time. If a stranger would need a glossary, rewrite it.
