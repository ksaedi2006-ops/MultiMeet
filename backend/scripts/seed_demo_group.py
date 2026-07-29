#!/usr/bin/env python3
"""Seed a MeetMind event with fake participants for local negotiation testing.

Usage:
    python3 scripts/seed_demo_group.py <invite_code>

Get <invite_code> from the Share step after creating an event in the app
(it's the last path segment of the invite link, e.g. the part after
/join/ in http://localhost:5173/join/<invite_code>).

Creates 7 fake users, each with a distinct .ics calendar (also written to
scripts/fixtures/ so they can be uploaded manually too) and a few
natural-language preferences posted like chat messages, joins them to the
event, and marks them ready. Open the event's Share page in the browser
before running this to watch the roster fill in live.
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_BASE = "http://localhost:8000"
FIXTURES_DIR = Path(__file__).parent / "fixtures"

# weekdays: 0=Monday ... 6=Sunday
WEEKDAYS = set(range(5))

PERSONAS = [
    {
        "name": "Katherine Boyd",
        "slug": "katherine",
        "calendar_events": [(WEEKDAYS, 17, 0, 60, "Gym")],
        "preferences": [
            "I have gym at 5pm most weekdays, try to keep meetings wrapped up before 4:30 if possible",
            "Mornings before 9am are rough for me, I'm not sharp yet",
        ],
    },
    {
        "name": "Marcus Webb",
        "slug": "marcus",
        "calendar_events": [(WEEKDAYS, 9, 0, 120, "CS 301 Lecture")],
        "preferences": [
            "Nothing before 11am, I have back-to-back classes every morning",
        ],
    },
    {
        "name": "Priya Nair",
        "slug": "priya",
        "calendar_events": [({2}, 12, 0, 60, "Team lunch")],
        "preferences": [
            "I have a standing team lunch Wednesdays at noon, please avoid that slot",
            "Otherwise I'm pretty flexible during the week",
        ],
    },
    {
        "name": "Diego Alvarez",
        "slug": "diego",
        "calendar_events": [({4}, 15, 0, 300, "Wind down")],
        "preferences": [
            "Fridays after 3pm I'm mentally checked out, please don't schedule then",
        ],
    },
    {
        "name": "Lena Fischer",
        "slug": "lena",
        "calendar_events": [(WEEKDAYS, 8, 0, 360, "Morning/afternoon classes")],
        "preferences": [
            "I have class until 2pm most days, so anything after that works great",
            "Avoid early mornings, I'm usually still commuting",
        ],
    },
    {
        "name": "Tomas Rivera",
        "slug": "tomas",
        "calendar_events": [({0}, 8, 0, 720, "Family commitment (all day)")],
        "preferences": [
            "I try to keep Mondays completely free if at all possible",
        ],
    },
    {
        "name": "Aisha Rahman",
        "slug": "aisha",
        "calendar_events": [(WEEKDAYS, 7, 0, 60, "Morning workout")],
        "preferences": [
            "I'm flexible on timing but strongly prefer avoiding anything right at 8am, I'm usually just getting settled",
            "Longer meetings are easier for me later in the day",
        ],
    },
]


def api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode()}")
        raise


def build_ics(events_spec, days: int = 14) -> str:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MeetMind Demo//EN"]
    for day_offset in range(days):
        day = now + timedelta(days=day_offset)
        weekday = day.weekday()
        for weekdays, hour, minute, duration, title in events_spec:
            if weekday not in weekdays:
                continue
            start = day.replace(hour=hour, minute=minute)
            end = start + timedelta(minutes=duration)
            lines += [
                "BEGIN:VEVENT",
                f"SUMMARY:{title}",
                f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end.strftime('%Y%m%dT%H%M%SZ')}",
                "END:VEVENT",
            ]
    lines.append("END:VCALENDAR")
    return "\n".join(lines)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    invite_code = sys.argv[1]

    event = api("GET", f"/events/invite/{invite_code}")
    event_id = event["event_id"]
    print(f'Seeding "{event["title"]}" ({event_id}) — watch the Share page roster fill in.\n')

    FIXTURES_DIR.mkdir(exist_ok=True)

    for persona in PERSONAS:
        user = api("POST", "/users/anon")
        user_id = user["id"]
        api("PATCH", f"/users/{user_id}", {"name": persona["name"]})

        ics_text = build_ics(persona["calendar_events"])
        (FIXTURES_DIR / f"{persona['slug']}.ics").write_text(ics_text)
        api("POST", f"/users/{user_id}/calendar", {"raw_ics": ics_text})

        api("POST", f"/events/join/{invite_code}?user_id={user_id}")
        print(f"+ {persona['name']} joined")

        for pref in persona["preferences"]:
            api("POST", f"/users/{user_id}/preferences", {"raw_text": pref})
        print(f"    briefed agent: {len(persona['preferences'])} preference(s)")

        api("POST", f"/events/{event_id}/ready?user_id={user_id}")
        print("    checked in\n")

        time.sleep(1.2)  # let the roster animate in the browser

    print("All 7 fake participants joined, briefed, and checked in.")
    print("Open the event in the browser, finish your own upload/agent steps, and check in —")
    print("negotiation starts automatically once everyone (including you) is ready.")


if __name__ == "__main__":
    main()
