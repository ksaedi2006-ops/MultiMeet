---
name: MultiMeet
description: Group scheduling negotiated by agents, shown on a radar-style scope in plain language
colors:
  board: "#22313f"
  board-raised: "#2a3b4b"
  board-line: "#3c5266"
  console: "#1a2531"
  glass: "#0c131d"
  strip: "#ecdfc2"
  strip-dim: "#e0d0a8"
  strip-ink: "#2a2015"
  clearance: "#d4551c"
  clearance-dim: "#a13f13"
  signal: "#f4844f"
  amber: "#e8a93a"
  mist: "#93aabd"
  holder-steel: "#4d6a80"
  holder-ochre: "#8f6f33"
  holder-person: "#5d6e7c"
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
  display-step:
    fontFamily: "Big Shoulders Display, IBM Plex Sans, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 0.95
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
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "0.16em"
  hand:
    fontFamily: "Caveat, Comic Neue, cursive"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  cell: "1px"
  sm: "2px"
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
  paper-card:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.strip-ink}"
    rounded: "{rounded.sm}"
  paper-card-holder-plan:
    backgroundColor: "{colors.clearance}"
    textColor: "{colors.strip}"
    width: "28px"
  paper-card-holder-sim:
    backgroundColor: "{colors.holder-steel}"
    textColor: "{colors.strip}"
    width: "28px"
  paper-card-holder-event:
    backgroundColor: "{colors.holder-ochre}"
    textColor: "{colors.strip}"
    width: "28px"
  paper-card-holder-person:
    backgroundColor: "{colors.holder-person}"
    textColor: "{colors.strip}"
    width: "28px"
  person-row:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.strip-ink}"
    rounded: "{rounded.sm}"
    height: "48px"
  console-panel:
    backgroundColor: "{colors.board-raised}"
    textColor: "{colors.strip}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  top-bar:
    backgroundColor: "{colors.console}"
    textColor: "{colors.strip}"
    height: "44px"
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

MultiMeet looks like an instrument and talks like a person. The scope is a pane of glass on a dark floor; the left and right panels around it are console furniture; people's agents are amber dots that drift toward the times they prefer; people and forms are manila paper cards; and safety orange appears only when a time is crossed out, someone is asked to move, or a time is booked. The look borrows from a radar room. The words never do: every label, status and sentence is plain English a stranger on a phone understands in five seconds (PRODUCT.md).

The whole app is one console that never reloads. Every screen, from the first one to Booked, is a step of it: the scope stays mounted, and a route only changes the step, which moves the scope's camera and swaps what the left and right panels hold.

Density is operational. Small readouts, hairline rules and tight rows sit beside one large instrument (the scope) and a few loud display-face statements (step titles, the booked time, the stamp). Contrast comes from the material, not from effects. Phosphor afterglow lives on the scope canvas only; cards lift off the console with a soft drop shadow, and panels are outlined in hairlines. Nothing is blurred or glassy.

**Key Characteristics:**
- Dark cab floor under the scope, grained console furniture around it, manila cards, amber live state, orange reserved for crossed-out, asked and booked.
- Three faces, three jobs: Big Shoulders Display announces, Plex Mono reads out data, Plex Sans speaks prose and names. One handwritten exception, on your own card.
- Hairline borders and 2px corners everywhere; the only round shapes are the scope and status pips.
- Motion runs on a continuous sweep, eased camera moves, critically damped drift and one-shot pulses, and every animation respects reduced motion.

**Vocabulary (user-visible):** dots are people's agents, labelled with first names; marks on the ring are times; the centre is the Mediator; a crossed-out time is one someone can't make ("Can't: Nora's bookstore shift"); replies are Can move / Won't move / Agrees; the result is Booked, or No time works. Steps are How it works, New meeting, Invite people, You're invited, Your calendar, Your preferences, Negotiating, Booked. Times are 12-hour everywhere, including inside rule text ("Done by 5 PM", never "17:00"). Legends say "Tap" on touch screens and "Point at" with a mouse. Never shown: tower, TWR, runway, approach, cleared, holding, fixes, callsigns, flight plan, frequency, manifest, briefing, ATIS, Zulu time.

## Colors

The palette is a night console: cool, low-saturation steel for everything structural, with two warm signals of different weight. Amber means live. Orange means official.

### Primary
- **Safety Orange** (`clearance`): Used only for crossed-out times, people the mediator is asking, the chosen-time corridor, the winning score cell's ring, the fairness meter's least-happy marker, primary action fills, the plan card's coloured end, the decision brief's top edge, and the stamp. It is used as a fill or stroke, never as small text on the console.
- **Burnt Clearance** (`clearance-dim`): Hover state for orange fills. Also the readable form of orange on manila ("Booked" status words, the "who gave something up" label, "Must:" notes on your card, errors on a card).
- **Signal Orange** (`signal`): Safety orange used as text on the console: the booked phase readout, LEAST HAPPY, the "Can't" line in a time's readout, errors, and the crossed-out/booked/warning lines in the activity list. It exists for contrast, so it never replaces `clearance` on a fill.

### Secondary
- **Phosphor Amber** (`amber`): Live state. Agent dots, the sweep, the wordmark's mark, the first line of the explainer, "Your agent" in the preferences chat, agent speakers, the average marker, the live pip, the sound toggle when on, hover and focus states, and the text caret.

### Tertiary
- **Score Ink** (`score-low` → `score-mid` → `score-high`): How much a person wants a time, inked onto their row. The ramp runs from barely-there manila through amber to a deep amber-brown and is interpolated linearly through the midpoint at 50. Unscored cells are strip-ink at 8% and closed cells are strip-ink at 28%, squeezed to a 1.5px line.

### Neutral
- **Cab Floor** (radial `#1c2a37` → `#141d27`, the `.cab-floor` class): The page ground. A dark ellipse centred slightly right of middle, under the scope.
- **Console** (`console`): The furniture: the top bar, the left panel and the right panel. It carries a very faint fractal-noise grain (an inline SVG at 4.5% white), so the furniture reads as moulded, not painted.
- **Console Steel** (`board`): No longer the page ground. It remains the body's fallback fill, the text on the Mediator's manila chip, the fill inside the fairness meter's average ring, and a hover fill on dark buttons set on cards.
- **Raised Steel** (`board-raised`): Panel fills on the console, applied at 40-60% (the fairness meter, who-is-ready panel, activity list), and solid for the agent's replies in the preferences chat.
- **Board Hairline** (`board-line`): Every border and divider on the console, the edges between the floor and the furniture, and the scrollbar.
- **Scope Glass** (`glass`): Anything that sits on the scope: the scope's outer edge (its radial fill runs from `#102030` to the glass), the large stamp's fill, and the plate behind the booked time.
- **Manila** (`strip`): Paper cards, person rows, the decision brief and your own messages in the preferences chat. It is also primary text on the console at 75-90% opacity.
- **Manila Pressed** (`strip-dim`): A New meeting box while one of its fields has focus.
- **Strip Ink** (`strip-ink`): Text on manila. Secondary text on manila is strip-ink at 60-70%.
- **Instrument Mist** (`mist`): Metadata on the console: the clock, panel labels, day labels, the legend under the scope, notes under headings, the sound toggle when off, "Won't move", and placeholders.
- **Holder Steel / Ochre / Person** (`holder-steel`, `holder-ochre`, `holder-person`): The coloured ends of paper cards that are not the plan card (see Components). They are quiet on purpose, so the one orange end stays meaningful.

### Named Rules
**The Reserved Orange Rule.** Safety orange marks crossed-out times, people being asked, the chosen-time corridor, the winning cell, primary actions, the plan card and the stamp, and nothing else. If an element is merely important, use amber or manila instead. A person's card is never orange.

**The Signal-for-Text Rule.** Orange text on the console is always `signal`, and orange text on manila is always `clearance-dim`. Raw `clearance` appears as text only inside the stamp.

**The Ink-Not-Orange Rule.** Scores are inked manila → amber → amber-brown. A high score is never orange, because orange already means "can't make it" or "booked".

**The Console Ground Rule.** The page ground is the cab floor; the panels and top bar are `console` furniture with its faint grain. This is the owner-approved console look (approved at the prototype checkpoint). The flat `board` fill is not used as a ground.

## Typography

**Display Font:** Big Shoulders Display (fallback IBM Plex Sans), weights 600-800 loaded, 700 used
**Body Font:** IBM Plex Sans (400, 500, 600)
**Label/Mono Font:** IBM Plex Mono (400-700, italic 400)
**Hand Font:** Caveat (fallback Comic Neue, cursive), 500 and 600 loaded; used on one element only

**Character:** Big Shoulders is condensed and loud like signage, Plex Mono reads like an instrument printout, and Plex Sans is the plain voice that explains it. The three never trade roles.

### Hierarchy
- **Display** (700, 30px to 36px, line-height 1, tracking -0.025em): The meeting's title at the top of the negotiation panel. The booked time on the decision brief uses the same face at 30px with line-height 1.05.
- **Display Step** (700, 2.4rem to 2.6rem, line-height 0.95, tracking -0.025em): Each step's own heading in its panel ("Agents that schedule your meeting", "New meeting", "Invite people", "Your preferences", the meeting title when you're invited). Panel-side headings ("Your card", "People", "Already in") are the same face at 1.6rem, line-height 1. Titles on cards are 20-26px. The wordmark is 17px with 0.06em tracking.
- **Headline** (700, 24px): Panel statements such as "3 of 7 ready" and "The negotiation stopped", and your name on your card.
- **Stamp** (700, 30px to 48px, tracking 0.12em, uppercase): The large stamp's word only (BOOKED, NO TIME WORKS). The booked day and time beneath it are display 700 at 26-42px, day in manila, time in amber.
- **Body** (400, 15-17px, 1.375-1.625): The explainer lines, the ticker transcript, the preferences chat and the decision explanation. Body-sm (13-14px) is used for the step name in the top bar (14px), log message text, notes under headings, the legend, and the "mm:ss in" clock.
- **Figure** (mono 600, 24px, tabular): LEAST HAPPY / AVERAGE values, each followed by "/100" in mono 400 at 13px and 60% opacity.
- **Data** (mono 500, 12px, tabular): Log clocks (12-hour, in the meeting's time zone), day labels, phase readouts. The top-bar clock is mono 11px.
- **Name tag** (sans 600, 12.5px on the scope, 14px on rows): People's first names on dots and rows, with a sans status line beneath. Speaker chips use sans 600 at 12px.
- **Label** (mono 400, 11px, tracking 0.14-0.18em, uppercase): Panel headings (FAIRNESS, WHAT'S HAPPENING), definition terms, and button text (tracking 0.05-0.14em). Box labels on paper cards are plain sans 11px at strip-ink 60%, not mono.
- **Hand** (Caveat, 24px, line-height 1.25; no weight is set, so the loaded 500 renders): The notes on "Your card" only. See the Handwritten Note Rule.

### Named Rules
**The Three Voices Rule.** Plex Mono is for data only (scores, times, readouts, controls). Plex Sans is for prose and people's names. Big Shoulders Display is for titles, the booked time and the stamp. A sentence set in mono, or a number set in display, is wrong. The one exception is the Handwritten Note Rule below.

**The Handwritten Note Rule.** On "Your card" in the preferences step, each rule your agent understood is written in the hand face (`--font-hand`, 24px) and written on left to right with a clip-path reveal (`inset(0 100% 0 0)` → `inset(0 0% 0 0)`, 0.9s, `cubic-bezier(0.45, 0, 0.2, 1)`). Musts read "Must: …" in `clearance-dim`; preferences are in `strip-ink`; the empty note ("Nothing yet: …") is 22px at strip-ink 45%. This fourth voice is owner-approved for that one element only. Nothing else uses the hand face, not even the chat beside it.

**The Heading-Is-The-Label Rule.** A small tracked mono label is allowed as a panel's own heading or a list's own heading. It never sits above a display heading as an eyebrow.

## Layout

The app is one console filling the viewport (no page scroll from 1024px up). A 44px top bar holds the wordmark (an amber hexagon mark and MULTIMEET), the current step's name in plain sans, the sound toggle, and the local time. A step can rename itself there: Negotiating becomes "Booked" or "No time works" once the result lands. The name swaps with a short vertical slide.

Below the bar the scope canvas is fixed and fills the whole body; the left panel and the right panel sit over it as console furniture. Each step sets their widths: How it works 360 / 400, New meeting 660 / 0 (the right panel slides away), Invite people 360 / 420, You're invited 340 / 440, Your calendar 440 / 420, Your preferences 380 / 440, Negotiating 520 / 440. On narrow desktops they give way (left 27%, or 50% for panels wider than 500px; right 29%; never under 280px) so the scope keeps the middle. Width changes run over 700ms on the expo ease. The scope's camera frames the largest square in the space the panels leave, with a 28px gutter and 30px kept underneath for its one-line legend.

Below 1024px the console stacks: top bar, the scope band (max(52svh, min(100vw, 88svh))) with its legend, then the right panel, then the left panel. On a phone the scope leaves 64px under itself because the legend wraps to two lines. The right panel comes before the cards so a phone visitor reads what the step is before what to press; on the first screen it also repeats the two actions (Run a sample, Schedule a meeting) as buttons.

On the negotiation step the left panel holds everyone's rows: 48px on a 6px rhythm, a 10.5rem name column and a score track, under a one-line caption. Closed times collapse to 1.5px lines over 700ms. The right panel runs top to bottom: the meeting title with phase and playback controls, the who-is-ready panel (before the start), then the fairness meter, the decision brief or the failure panel, the ticker, and the activity list filling what is left.

## Elevation & Depth

The furniture is flat and tonal. Panels separate from the console with a hairline border and a translucent `board-raised` fill, not a shadow, and the furniture separates from the floor with a hairline. Only manila lifts. Cards and person rows cast a short, tight shadow, and the decision brief casts a deeper, softer one, as if paper had been laid on the console. The scope reads as recessed because its glass is darker than the floor around it. On decision, the scope behind the stamp is darkened by a plain radial gradient, and the stamp itself sits on solid glass.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 1px 0 rgba(0,0,0,0.35), 0 6px 14px -8px rgba(0,0,0,0.6)`): Each paper card.
- **Row lift** (`box-shadow: 0 6px 14px -8px rgba(0,0,0,0.7)`): Each person row on the negotiation step.
- **Brief lift** (`box-shadow: 0 20px 50px -20px rgba(0,0,0,0.8)`): The decision brief, the one large manila card.

### Named Rules
**The No-Glow Rule.** No CSS glows, no blur or frosted plates, and no coloured halos. Phosphor afterglow belongs to the scope canvas (a WebGL persistence buffer, about 0.86 decay per 60Hz frame, with fine grain; a plain canvas fallback without WebGL2). Ink, text and borders never emit light. The console's grain and the floor's radial falloff are texture and tone, not light: they are flat, uncoloured, and never sit behind or around an element to make it glow.

## Shapes

Corners are nearly square. Cards, rows, panels, buttons, chips and the stamp use 2px. Score cells use 1px. Round shapes are reserved for the scope, its range rings and the small status pips (live dot, average marker, connection dot, typing dots). Borders are hairlines (1px `board-line` on the console, strip-ink at 15-30% on manila). The heaviest strokes are the stamp's 3px orange border and the decision brief's 4px orange top edge. A paper card's coloured end is a 28px block holding a 15px stroke icon (never a thin side stripe). Scope geometry uses triangles for times, squares for agent dots, crosses for times someone can't make, and leader lines from dots to their name tags.

## Components

### Buttons
Flat, nearly square, with mono uppercase labels.
- **Shape:** 2px corners.
- **Primary:** Safety-orange fill with manila text, 11-13px mono label, 40-48px tall. Used for Create meeting, Run, I'm ready, Start, Add to my calendar and other committing actions.
- **Hover / Focus:** The fill darkens to `clearance-dim`. Focus is a 2px amber outline at 2px offset, set globally; on manila it becomes a strip-ink outline at -2px offset. Disabled fills drop to 40-60%.
- **Console (on the furniture):** Hairline `board-line` border with manila text at 80%. On hover the border and text turn amber. 32px tall, with an inline 14px stroke icon and the label hidden below 640px. Disabled at 35% opacity.
- **Ink (on manila):** A strip-ink border at 30% that turns solid on hover. When pressed it fills with strip-ink and the text becomes manila (RSVP, sample size, meeting length, days).
- **Suggestion chips:** Sans 13px, hairline border, manila at 80%, used for things you could say to your agent.

### Paper Card (signature)
Manila ruled into boxes (the 1px gaps between boxes show strip-ink at 25% as printed rules), with a coloured end and an icon. The end says what kind of card it is:
- **Plan** (`clearance`, calendar icon): only the "Schedule a meeting" card and the New meeting form it opens into.
- **Sample** (`holder-steel`, play icon): Run a sample (8 / 16 / 30 people), on the first screen and on Invite people.
- **Event** (`holder-ochre`, clock icon): Recent meetings.
- **Person** (`holder-person`, person icon): people's cards (who has joined, who is already in), the name field when you're invited, and Your card.

Choosing Schedule a meeting slides that card out (shared layout) and opens it into the New meeting form: boxes labelled in plain sans ("What's it for", "Your name", "From", "Until", "Time zone", "Length", "Between", "Days"), hours as "9 AM", a box turning `strip-dim` while it has focus, and a Create meeting button.

### Person Row
A manila 48px row per person on the negotiation step. The name column shows the full name (sans 14/600, "(you)" for the viewer) and a plain status beneath (Ready, Thinking…, Rated, Asked to move, Can move, Won't move, Agrees, Booked). The score track shows one cell per possible time, inked by score. The winning cell gets a 2px inset safety-orange ring and the other open cells drop to 40%. A row whose person the mediator is asking gets a 2px orange outline; hovering a row highlights that dot on the scope in amber.

### Console Panel
A hairline-bordered box with a translucent raised fill, 2px corners and a mono label heading. It is used for the fairness meter, the who-is-ready panel and the activity list. Failure panels swap the border to orange at 60%.

### Negotiation Header
The meeting title in display, then the phase readout in mono (amber while live, signal once booked, stopped or with no time), "mm:ss in" in sans 13px mist once playback starts, and a "Simulated agents, not live AI" chip when the agents are simulated. Pause/Play and Replay are console buttons; speed and Skip disappear once there is a decision. The connection is mentioned only when it isn't fine ("Connecting…", "Reconnecting…", "Meeting not found", with a mist dot).

### Who Is Ready
At the top of the right panel before the start: "3 of 7 ready" in headline, who is still setting up, and for the organiser a full-width Start button ("Start with 3", "Start negotiation"); others read "The organiser starts the negotiation."

### Fairness Meter
A hairline track with a "50 = OK" tick, an amber span from least-happy to average, a 3px safety-orange bar at the least-happy score, and an amber ring at the average. All positions ease over 700ms. Figures read "78/100", followed by one line: "Scores are out of 100: how much each person likes the time."

### Decision Brief
The one large manila card, with a 4px orange top edge. The booked time in display, LEAST HAPPY and AVERAGE as "/100" figures with the same one-line scale note, the explanation, who gave something up ("now 62/100"), and if it falls through ("worst-off 55/100"). Actions: Add to my calendar (primary), Google Calendar, and I'll be there / Can't make it as ink buttons.

### Ticker and Activity List
The ticker types the latest message at about two characters per 16ms behind an amber block cursor; before anything happens it reads "Waiting for the organiser to start." Its speaker chip is manila for the Mediator and amber at 15% for people. The activity list ("What's happening") is a three-column grid (12-hour clock in the meeting's time zone, speaker, message) with plain sentences: "Crossed out 55 of 72 times someone can't make, e.g. Nora's bookstore shift", "In the lead: Thu Nov 19, 6:00 PM", "Can move. …", "Booked: …". Rounds are separated by hairline dividers. The viewer's private note is shown in amber at 80%.

### Top Bar
The 44px `console` strip described in Layout. Its sections are split by hairlines. The sound toggle is a speaker stroke icon with "Sound on" / "Sound off" (sans 13px, from 768px up), amber when on and mist when off. Sound is off by default, remembered per browser, and synthesized with Web Audio (no files): a short tick rattle when times are crossed out, a blip when someone joins or is asked, and a two-note chime when a time is booked.

### Scope
A canvas instrument: glass fill, mist range rings and ticks, plain day labels on the ring ("Tue 18"), and an amber sweep with phosphor afterglow on a 5.2s period. Times are triangles; new ones pop on with a short overshoot and removed ones fade where they stood, and bearings ease when the ring re-lays out. A time someone can't make is crossed out with an orange flicker. The three leading times are filled and labelled with day and time ("Thu 6 PM") on glass plates just inside the ring; the labels step inward to avoid each other and name tags steer around them. Pointing at (or tapping) any time shows a readout: "Wed Nov 25, 12:00 PM · 14 of 16 can make it", with "Can't: Nora's bookstore shift" in signal orange when it is crossed out.

Agent dots are amber squares with fading trails (orange while being asked), each with a name tag on a glass plate: first name (last initial only when two people share it), and a short status line. Above 12 people only names show, unless the person is pointed at, being asked or has just replied. The centre is the Mediator; asks travel from it as a pulse ring and a dashed line to the person. The finale draws an orange corridor to the chosen time and brings the dots in one by one, then the BOOKED stamp lands with the day and time written large beneath it. A one-line legend under the scope (sans 13px, mist) says what the marks mean, ending in "Tap a time to read it" or "Point at a time to read it" by pointer type. Leaving a replay, its dots peel off outward. The scope's aria label states the same facts in a sentence.

### Stamp
A rectangular ink stamp with a 2px orange border (3px when large) and orange lettering. It lands with an overshooting spring (280/14), going from 1.9× scale and +8° to rest at -4°. Words: BOOKED, NO TIME WORKS (large, on glass), CREATED (medium, when a meeting is made).

### The Console Steps
Each step is a camera position, not a page.
- **How it works** (first screen): a recorded 14-person negotiation replays on the scope; the right panel types a four-line plain explanation under "Agents that schedule your meeting" (no typing on a phone), then shows the replay's latest message with a "14 people · simulated agents" chip; the left panel holds the action cards. After 20 seconds without input an idle tour points at each person in turn every 3 seconds so their tag shows; any pointer, key or scroll stops it, and it never runs under reduced motion.
- **New meeting**: the form card opens on the left, the right panel slides away, and the scope eases over to preview every possible time live as days, hours and length change, with a count ("64 possible times over 8 days").
- **Invite people**: the right panel holds the invite link and a sample card; the left panel lists people's cards as they join, and their dots wait in the middle of the scope.
- **You're invited**: the meeting's title and times, who is already in, and a person card with a Your name field.
- **Your calendar**: your week on the left, the file drop on the right; your fixed commitments cross times out on the ring.
- **Your preferences**: Your card on the left (with its handwritten notes), a plain chat with your agent on the right ("Got it: …, and that's a must"), suggestion chips, and I'm ready. Musts cross times out on the ring; preferences don't.
- **Negotiating / Booked**: rows on the left, the negotiation panel on the right, the scope centred.

## Do's and Don'ts

### Do:
- **Do** reserve `clearance` for crossed-out times, people being asked, the chosen-time corridor, the winning cell, primary actions, the plan card and the stamp.
- **Do** use `signal` for orange text on the console and `clearance-dim` for orange text on manila.
- **Do** ink scores along the manila → amber → amber-brown ramp, and show them as "/100" with a one-line note on what the scale means.
- **Do** write every label, status and sentence so a stranger on a phone understands it in five seconds, with 12-hour times everywhere.
- **Do** set data in Plex Mono with tabular figures, prose in Plex Sans, and titles, the booked time and the stamp in Big Shoulders Display.
- **Do** fill anything that sits on the scope with `glass`.
- **Do** build new steps on the one console: the cab floor as the ground, `console` furniture for the panels, the scope's camera moved by panel widths.
- **Do** separate panels on the console with 1px `board-line` hairlines and 2px corners, and let only manila cast shadows.
- **Do** give every timed or looping motion a reduced-motion path that jumps to the end state.

### Don't:
- **Don't** set a high score, a leading time or emphasis in safety orange, or give a person's card an orange end.
- **Don't** use raw `clearance` as small text on the console or on manila.
- **Don't** put a small tracked label above a heading as an eyebrow.
- **Don't** use the hand face anywhere but the notes on Your card.
- **Don't** add glows, blur or frosted plates, or coloured halos.
- **Don't** use coloured side borders as accents. The orange edge belongs only on the decision brief's top edge.
- **Don't** use text glyphs (✓, →) as icons. Draw icons as inline 16px-grid SVG strokes.
- **Don't** label simulated agents as real. Disclose it once, in plain words ("simulated agents"), rather than tagging every dot.
- **Don't** play sound unless the viewer turned it on.
- **Don't** put aviation words on screen: tower, runway, approach, cleared, holding, fixes, callsigns, flight plan, frequency, manifest, briefing, ATIS or Zulu time. If a stranger would need a glossary, rewrite it.
