#!/usr/bin/env python3
"""Fill a MeetMind event with seven fake participants for local testing.

    python3 scripts/seed_demo_group.py <invite_code>
        Join an event you created in the browser (the invite code is the last part
        of the share link). Watch its Share page while this runs; then check in and
        press Start yourself.

    python3 scripts/seed_demo_group.py --new [--start]
        Create a fresh event (organised by "Ava"), add everyone, and with --start
        run the negotiation and print it as it happens.

Each persona gets a recurring weekly .ics calendar in local time (also written to
scripts/fixtures/ for manual uploads) and a couple of things told to their agent.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

API = "http://localhost:8000"
TZ = "America/New_York"
FIXTURES = Path(__file__).parent / "fixtures"
WEEKDAYS = "MO,TU,WE,TH,FR"

# (title, BYDAY, start HH:MM, end HH:MM)
PERSONAS = [
    ("Katherine Boyd", [("Gym", WEEKDAYS, "17:00", "18:00"), ("Organic Chem Lab", "TU,TH", "13:00", "15:30")],
     ["I have gym at 5pm most weekdays, I'd rather wrap up before 4:30", "Mornings before 9 are rough for me"]),
    ("Marcus Webb", [("CS 301 Lecture", WEEKDAYS, "09:00", "11:00")],
     ["I can never do anything before 11am, I have class every morning"]),
    ("Priya Nair", [("Team lunch", "WE", "12:00", "13:00"), ("Research meeting", "MO", "15:00", "16:00")],
     ["I have a standing team lunch Wednesdays at noon", "Otherwise I'm pretty flexible during the week"]),
    ("Diego Alvarez", [("Shift at the bookstore", "FR", "14:00", "19:00")],
     ["Fridays after 3pm I'm completely checked out, please avoid Fridays"]),
    ("Lena Fischer", [("Studio", "MO,WE,FR", "10:00", "14:00")],
     ["Studio runs late, I like 15 minutes of buffer between things"]),
    ("Tomas Rivera", [("Family dinner", "MO", "18:00", "20:00"), ("Run club", "TU,TH", "07:00", "08:00")],
     ["I try to keep Mondays free if at all possible"]),
    ("Aisha Rahman", [("TA office hours", "TH", "14:00", "16:00"), ("Coffee with advisor", "WE", "15:00", "16:00")],
     ["I'd rather not meet before 2pm, mornings are my research block", "Never anything after 7pm"]),
]


def api(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> {e.code}: {e.read().decode()}")


def build_ics(events) -> str:
    anchor = date.today() - timedelta(days=date.today().weekday() + 7)  # a Monday in the past
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MeetMind Demo//EN"]
    for i, (title, days, start, end) in enumerate(events):
        first = anchor + timedelta(days=["MO", "TU", "WE", "TH", "FR", "SA", "SU"].index(days.split(",")[0]))
        d = first.strftime("%Y%m%d")
        lines += ["BEGIN:VEVENT", f"UID:demo-{i}-{title}", f"SUMMARY:{title}",
                  f"DTSTART;TZID={TZ}:{d}T{start.replace(':', '')}00",
                  f"DTEND;TZID={TZ}:{d}T{end.replace(':', '')}00",
                  f"RRULE:FREQ=WEEKLY;BYDAY={days}", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\n".join(lines)


def guest(name: str) -> str:
    uid = api("POST", "/users/anon")["id"]
    api("PATCH", f"/users/{uid}", {"name": name})
    return uid


def add_persona(event_id: str, invite: str, name: str, events, prefs) -> str:
    uid = guest(name)
    api("POST", f"/events/join/{invite}?user_id={uid}")
    print(f"+ {name} joined")
    ics = build_ics(events)
    FIXTURES.mkdir(exist_ok=True)
    (FIXTURES / f"{name.split()[0].lower()}.ics").write_text(ics)
    cal = api("POST", f"/users/{uid}/calendar?event_id={event_id}",
              {"raw_ics": ics, "timezone": TZ, "filename": f"{name.split()[0].lower()}.ics"})
    print(f"    calendar: {len(cal['events'])} busy blocks")
    for text in prefs:
        pref = api("POST", f"/users/{uid}/preferences?event_id={event_id}", {"raw_text": text})
        print(f"    told agent: {text!r} -> {[r['summary'] for r in pref['rules']]}")
    api("POST", f"/events/{event_id}/ready?user_id={uid}")
    print("    checked in")
    return uid


def describe(e: dict) -> str | None:
    t = e["type"]
    if t == "negotiation_started":
        return f"negotiation opened: {len(e['participants'])} agents ({e['agent_backend']}), {len(e['slots'])} slots"
    if t == "slots_closed":
        return f"closed {len(e['closed'])} slots on hard conflicts; {len(e['open'])} still open"
    if t == "round_started":
        return f"--- round {e['round']} ({e['kind']}) ---"
    if t == "agent_scored":
        best = max(e["scores"].values(), default=0)
        return f"  {e['user_id'][:6]} scored (best {best}){' [SIM fallback]' if e['fallback'] else ''}: {e['summary']}"
    if t == "agent_failed":
        return f"  ! agent {e['user_id'][:6]} failed: {e['error']}"
    if t == "shortlist":
        return "  shortlist: " + ", ".join(f"{r['slot_id']} (min {r['min_score']})" for r in e["ranked"])
    if t == "mediator_ask":
        return f"  mediator -> {e['to_name']}: {e['text']}"
    if t == "agent_reply":
        return f"    {e['response'].upper()} {e['old_score']}->{e['new_score']}: {e['text']}"
    if t == "decision":
        slot = e["slot"]["label"] if e["slot"] else "none"
        return f"DECISION {e['status']}: {slot} (min {e['min_score']})\n{e['explanation']}"
    if t == "negotiation_failed":
        return f"FAILED: {e['error']}"
    return None


def watch(event_id: str) -> None:
    seq = 0
    while True:
        for e in api("GET", f"/events/{event_id}/log?after={seq}"):
            seq = e["seq"]
            line = describe(e)
            if line:
                print(line)
            if e["type"] in ("decision", "negotiation_failed"):
                return
        time.sleep(0.5)


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--new":
        organiser = guest("Ava Chen")
        start = date.today() + timedelta(days=1)
        event = api("POST", f"/events?requested_by={organiser}", {
            "title": "CS Club weekly meeting", "duration_minutes": 60, "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=9)).isoformat(), "timezone": TZ,
            "earliest_hour": 9, "latest_hour": 21,
        })
        api("POST", f"/users/{organiser}/preferences?event_id={event['event_id']}",
            {"raw_text": "I'd rather not meet after 6pm, I commute home"})
        api("POST", f"/events/{event['event_id']}/ready?user_id={organiser}")
        print(f"event {event['event_id']} organised by Ava ({organiser})")
    else:
        event = api("GET", f"/events/invite/{args[0]}")
        organiser = event["organizer_id"]

    for name, events, prefs in PERSONAS:
        add_persona(event["event_id"], event["invite_code"], name, events, prefs)
        time.sleep(0.8)  # let the roster animate in the browser

    if "--start" in args:
        result = api("POST", f"/events/{event['event_id']}/start?user_id={organiser}")
        print(f"\nstarted with {result['participants']} participants ({result['agent_backend']} agents)\n")
        watch(event["event_id"])
    else:
        print("\nEveryone is in and checked in. The organiser can press Start in the browser.")


if __name__ == "__main__":
    main()
