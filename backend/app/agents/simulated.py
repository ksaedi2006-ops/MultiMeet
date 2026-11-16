"""Deterministic stand-in agents, used when no API key is configured and in tests.

They reason only from the same inputs the Claude agents get (soft conflicts, rules,
notes), so negotiations still play out sensibly. The UI labels them SIM.
"""

import hashlib
import re

from app.agents.types import (
    AgentMove,
    Ask,
    AskPlan,
    AskRenderView,
    AskView,
    DecisionView,
    Explanation,
    MoveView,
    PersonView,
    Reply,
    ReplySheet,
    ScoreSheet,
    ShortlistView,
    SlotScore,
)
from app.scheduling.rules import WEEKDAY_NAMES, ParsedPreference, PreferenceRule

HARD_WORDS = re.compile(r"\b(never|can't|cannot|can not|no exceptions|absolutely|impossible)\b", re.I)
TIME = r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?"
DAY_WORDS = {name.lower(): i for i, name in enumerate(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])}


def _jitter(*parts: str, spread: int = 8) -> int:
    digest = hashlib.sha256("|".join(parts).encode()).digest()
    return digest[0] % (2 * spread + 1) - spread


def _hhmm(hour: str, minute: str | None, meridiem: str | None) -> str:
    h = int(hour)
    if meridiem:
        meridiem = meridiem.lower()
        if meridiem == "pm" and h < 12:
            h += 12
        if meridiem == "am" and h == 12:
            h = 0
    elif h < 7:  # "after 5" in a scheduling context almost always means the afternoon
        h += 12
    return f"{h:02d}:{int(minute or 0):02d}"


class SimulatedAgents:
    name = "simulated"
    carrier = "SIM"

    async def parse_preference(self, text: str) -> ParsedPreference:
        text = text.replace("\u2019", "'").replace("\u2018", "'")  # smart quotes from pasted or suggested text
        strength = "hard" if HARD_WORDS.search(text) else "soft"
        rules: list[PreferenceRule] = []
        lower = text.lower()
        days = sorted({i for word, i in DAY_WORDS.items() if re.search(rf"\b{word}s?\b", lower)})
        on_days = f" on {', '.join(WEEKDAY_NAMES[d] for d in days)}" if days else ""

        # "wrap up / finish / be done before 4:30" is an end-of-day limit, not a start.
        if m := re.search(rf"\b(?:wrap(?:ped)? up|finish(?:ed)?|done|end|out)\s+(?:by|before)\s+{TIME}", lower):
            t = _hhmm(*m.groups())
            rules.append(PreferenceRule(kind="not_after", strength=strength, time=t, weekdays=days or None,
                                        summary=f"Done by {t}{on_days}"))
        elif m := re.search(rf"\b(?:before|earlier than|until)\s+{TIME}", lower):
            t = _hhmm(*m.groups())
            rules.append(PreferenceRule(kind="not_before", strength=strength, time=t, weekdays=days or None,
                                        summary=f"Nothing before {t}{on_days}"))
        if m := re.search(rf"\b(?:after|later than|past)\s+{TIME}", lower):
            t = _hhmm(*m.groups())
            rules.append(PreferenceRule(kind="not_after", strength=strength, time=t, weekdays=days or None,
                                        summary=f"Nothing after {t}{on_days}"))
        graded_day = bool(days and re.search(r"\b(rough|not great|aren't great|hard|tough|bad)\b", lower))
        if days and not graded_day and re.search(r"\b(avoid|no|not|free|off|keep|busy)\b", lower):
            names = ", ".join(WEEKDAY_NAMES[d] for d in days)
            rules.append(PreferenceRule(kind="avoid_weekdays", strength=strength, weekdays=days,
                                        summary=f"Avoid {names}"))
        if m := re.search(rf"\b(?:ideally|around|preferably|best)\s+(?:around\s+|at\s+)?{TIME}", lower):
            t = _hhmm(*m.groups())
            rules.append(PreferenceRule(kind="time_of_day", strength="soft", time=t, width_minutes=120,
                                        summary=f"Ideally around {t}"))
        if graded_day:
            weights = [1.0] * 7
            for d in days:
                weights[d] = 0.3
            rules.append(PreferenceRule(kind="day_weights", strength="soft", day_weights=weights,
                                        summary=f"{', '.join(WEEKDAY_NAMES[d] for d in days)} not great"))
        if m := re.search(r"(\d{1,3})\s*(?:min|minute)s?\b.*\b(buffer|between|break|gap)", lower):
            mins = int(m.group(1))
            rules.append(PreferenceRule(kind="buffer_minutes", strength=strength, minutes=mins,
                                        summary=f"{mins} min buffer around other things"))
        if not rules:
            rules.append(PreferenceRule(kind="free_text", strength="soft", summary=text.strip()[:80]))
            ack = "Noted. I'll keep that in mind when I weigh the options."
        else:
            ack = "Got it: " + "; ".join(r.summary.lower() for r in rules) + "."
        return ParsedPreference(rules=rules, ack=ack)

    async def score(self, person: PersonView) -> ScoreSheet:
        scores = []
        for slot in person.slots:
            value = 86 + _jitter(person.user_id, slot.slot_id)
            if slot.conflicts:
                value -= 38 * len(slot.conflicts)
            value = max(5, min(100, value))
            reason = f"Clashes with {slot.conflicts[0]}" if slot.conflicts else "Clear for me"
            scores.append(SlotScore(slot_id=slot.slot_id, score=value, reason=reason))
        counts: dict[str, int] = {}
        for s in person.slots:
            for c in s.conflicts:
                counts[c] = counts.get(c, 0) + 1
        if counts:
            worst = max(counts, key=counts.get)
            summary = (f"Holding to my rule: {worst.removeprefix('Rule: ').lower()}." if worst.startswith("Rule: ")
                       else f"Pushing for times that don't clash with {worst}.")
        else:
            summary = "Wide open this week; most times work for me."
        return ScoreSheet(scores=scores, summary=summary)

    async def plan_asks(self, title: str, people: dict[str, str], shortlist: list[ShortlistView]) -> AskPlan:
        ids = {name: uid for uid, name in people.items()}
        asks = []
        for slot in shortlist:
            low = sorted((s, n) for n, s in slot.scores.items() if s < 70)[:2]
            for _, name in low:
                conflicts = slot.conflicts.get(name) or []
                first = name.split()[0]
                if conflicts and conflicts[0].startswith("Rule: "):
                    ask = f"{first}, could you bend '{conflicts[0].removeprefix('Rule: ').lower()}' for {slot.label}?"
                elif conflicts:
                    ask = f"{first}, could {conflicts[0]} move for {slot.label}?"
                else:
                    ask = f"{first}, is {slot.label} workable for you?"
                asks.append(Ask(slot_id=slot.slot_id, user_id=ids[name], text=ask))
        return AskPlan(asks=asks)

    async def reply(self, person: PersonView, asks: list[AskView]) -> ReplySheet:
        replies = []
        for ask in asks:
            old = ask.current_score
            if not ask.conflicts:
                replies.append(Reply(ask_id=ask.ask_id, response="accept", new_score=max(old, 72),
                                     text="That one works for me as it is."))
                continue
            conflict = ask.conflicts[0]
            is_rule = conflict.startswith("Rule: ")
            label = conflict.removeprefix("Rule: ")
            # Some asks are refused, deterministically per person and time, so runs vary.
            stubborn = _jitter(person.user_id, ask.slot_id, "hold", spread=50) > 25 or (is_rule and old < 30)
            if stubborn:
                text = (f"I'd rather keep my rule ({label.lower()})." if is_rule
                        else f"{label} matters that day, I can't move it.")
                replies.append(Reply(ask_id=ask.ask_id, response="hold", new_score=old, text=text))
            else:
                new = min(100, max(old + (14 if is_rule else 24), 58 if is_rule else 66))
                text = (f"I can bend my rule ({label.lower()}) this once." if is_rule
                        else f"I can move {label} that day.")
                replies.append(Reply(ask_id=ask.ask_id, response="flex", new_score=new, text=text))
        return ReplySheet(replies=replies)

    async def render_ask(self, view: AskRenderView) -> str:
        first = view.to_name.split()[0]
        label = view.rule_label.removeprefix("Rule: ")
        if view.rule_kind == "event":
            return f"{first}, could {label} move for {view.target_label}? That time would work best for the group."
        return f"{first}, could you bend '{label.lower()}' for {view.target_label}? It would help the group most."

    async def move(self, view: MoveView) -> AgentMove:
        """One structured move, decided from the same inputs a Claude agent gets."""
        label = view.rule_label.removeprefix("Rule: ")
        thing = label if view.rule_kind == "event" else label.lower()
        if not view.target_hurts:
            return AgentMove(move="accept", text=f"{view.target_label} already works for me.")
        # Some asks are refused, deterministically per person and rule, so runs vary.
        if _jitter(view.user_id, view.rule_id, "hold", spread=50) > 25:
            return AgentMove(move="hold", text=(f"{label} matters that day; I can't move it." if view.rule_kind == "event"
                                                else f"I'd rather keep my rule ({thing})."))
        return AgentMove(move="flex", rule_id=view.rule_id, new_weight=view.floor,
                         text=(f"I can move {label} for {view.target_label}." if view.rule_kind == "event"
                               else f"I can bend my rule ({thing}) for {view.target_label}."))

    async def explain(self, d: DecisionView) -> Explanation:
        if d.status == "escalated":
            return Explanation(
                explanation="No time worked for everyone without someone giving up something they marked firm.",
                question="Which of the near-misses should we take, or can anyone loosen a firm rule?",
            )
        if d.decisive and d.runner_up_label:
            cost = f" ({d.decisive_reason.removeprefix('Rule: ').lower()})" if d.decisive_reason else ""
            # True by construction: the pick is Pareto-optimal for the reports, so any time
            # better for the bottleneck person is worse for someone else.
            serves = (f" {d.bottleneck} is the person this time suits least; any time that suits them better"
                      " would cost someone else." if d.bottleneck and d.bottleneck != d.decisive else "")
            tie = (f" {d.tied_labels[0]} suits everyone exactly as well, so the earlier date won."
                   if d.tied_labels else "")
            return Explanation(explanation=(
                f"The runner-up, {d.runner_up_label}, would have cost {d.decisive} the most{cost}.{serves}{tie}"
            ).strip())
        low = min(d.scores.values()) if d.scores else 0
        moved = " once a commitment moved" if d.compromises else " with nobody giving anything up"
        return Explanation(explanation=f"It was the only time left, and the least-happy person is at {low}{moved}.")
