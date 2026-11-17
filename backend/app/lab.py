"""The Lab: the preregistered evaluation (backend/eval), streamed one simulated meeting at a time.

Every meeting is generated with hidden true preferences, every chosen rule runs on the same
reports, and the outcome is scored against the truth, never against what agents reported. With
an attacker, one person (or a colluding pair) lies and the Lab measures what lying won them.
The instances are the same seeded ones docs/eval/RESULTS.md reports on.
"""

from __future__ import annotations

from dataclasses import replace

from app.scheduling.normalize import normalize
from app.scheduling.utility import Criterion, UtilityModel
from eval.instances import Instance, make_instance
from eval.mechanisms import condition, oracle, run
from eval.metrics import nash_welfare, outcome, utilities_at

# Lab name -> eval mechanism id (docs/eval/preregistration.md, "Baselines").
MECHANISMS: dict[str, str] = {
    "nash": "Ours-topk",  # the product default: Nash + leximin ties + top-k normalization + mediator
    "old": "B3",  # the old MultiMeet rule: max-min over raw 0-100 scores, old mediator loop
    "egalitarian": "Ours-maxmin",  # our pipeline with leximin in place of Nash
    "utilitarian": "B4",
    "borda": "B5",
    "when2meet": "B1",
    "random": "B0",
    # More rules from the literature (eval/mechanisms.py run_extra); not preregistered.
    "plurality": "P1",
    "condorcet": "CW",
    "ks": "KS",
    "median": "MED",
    "random_dictator": "RD",
    "budget": "QV",
    "vcg": "VCG",
}
ATTACKS = ("none", "inflater", "victim", "fakehard", "pair")
SIZES = (3, 5, 8)


def _explain(res) -> dict:
    """How a rule reached its pick: its five best-scoring times, plus votes, the dictator or
    whether a Condorcet winner exists. This is what the radar animates."""
    extra = {k: v for k, v in (res.extra or {}).items() if k != "objective"}
    obj = (res.extra or {}).get("objective") or {}
    if obj:
        top = sorted((s for s in obj if obj[s] > float("-inf")), key=lambda s: obj[s], reverse=True)[:5]
        extra["top"] = [{"slot": s, "value": round(obj[s], 4)} for s in top]
    return extra


def _row(inst: Instance, mechs: list[str], attack: str) -> dict:
    best = oracle(inst)
    nw_or = nash_welfare(inst, best)
    best_util = max(sum(inst.u[u][s] for u in inst.uids) / inst.n for s in inst.feasible)
    best_min = max(min(inst.u[u][s] - inst.d[u] for u in inst.uids) for s in inst.feasible)
    honest, slots, _ = condition(inst, "honest")
    results: dict[str, dict] = {}
    for name in mechs:
        mech = MECHANISMS[name]
        res = run(mech, inst, honest, slots)
        pick = res.pick
        o = outcome(inst, pick, nw_or)
        r = {
            "pick": pick,
            "ratio": round(o["ratio"], 4),
            # Two more yardsticks, so no single welfare criterion grades everyone (truth, not reports).
            "util_ratio": round(o["util"] / best_util, 4) if best_util > 0 else 1.0,
            "min_ratio": round(o["min"] / best_min, 4) if best_min > 0 else (1.0 if o["min"] >= best_min else 0.0),
            "min": round(o["min"], 4),
            "util": round(o["util"], 4),
            "pareto": o["pareto"],
            "violation": o["violation"],
        }
        if extra := _explain(res):
            r["extra"] = extra
        if res.payments:
            r["payments"] = {u: round(v, 4) for u, v in res.payments.items()}
        if res.outcome and res.outcome.rounds:
            # The mediator's concession rounds (only Nash runs them): who was asked, for what, and the answer.
            r["rounds"] = [{
                "user_id": rd.request.user_id, "rule": rd.request.rule_label, "target": rd.request.target,
                "draft": rd.request.draft, "move": rd.applied.kind, "pick_after": rd.draft.pick,
                # A rule can be asked about twice: each flex lowers its weight, never back up (monotonic).
                "from_weight": round(rd.applied.old_weight, 3) if rd.applied.old_weight is not None else None,
                "to_weight": round(rd.applied.new_weight, 3) if rd.applied.new_weight is not None else None,
                "floor": round(rd.request.floor, 3),
            } for rd in res.outcome.rounds]
        if attack != "none":
            lied, lslots, liars = condition(inst, attack)
            lres = run(mech, inst, lied, lslots)
            lpick = lres.pick
            before = utilities_at(inst, pick)
            after = utilities_at(inst, lpick)
            uids = [inst.uids[k] for k in liars]
            honest_ids = [u for u in inst.uids if u not in uids]
            r["attack_pick"] = lpick
            if extra := _explain(lres):
                r["attack_extra"] = extra
            # What lying won the liars, and what it cost everyone else, on their true utilities.
            # Under the Clarke tax, points paid count against the liar too (that is what makes it truthful).
            paid = {u: (lres.payments or {}).get(u, 0.0) - (res.payments or {}).get(u, 0.0) for u in uids}
            r["gain"] = round(sum(after[u] - before[u] - paid[u] for u in uids) / len(uids), 4)
            r["harm"] = round(sum(after[u] - before[u] for u in honest_ids) / max(1, len(honest_ids)), 4)
        results[name] = r
    return {
        "idx": inst.idx,
        "n": inst.n,
        "density": inst.density,
        "multi_tz": inst.multi_tz,
        "feasible": len(inst.feasible),
        "oracle": best,
        "results": results,
    }


def lab_row(idx: int, n: int, mechs: list[str], attack: str) -> dict | None:
    inst = make_instance(idx, n)
    return _row(inst, mechs, attack) if inst else None


DAYS = ("Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays")
PEAK_WIDTH = 240  # minutes from the favourite time at which the time-of-day penalty is full


def _edited_model(inst: Instance, uid: str, peak: str, avoid: list[int]) -> UtilityModel:
    """A person redrawn by hand in the sandbox: single-peaked on time of day around their
    chosen favourite, minus a day penalty on the weekdays they avoid."""
    from zoneinfo import ZoneInfo

    from eval.instances import MEETING_TZ

    zone = ZoneInfo(MEETING_TZ)
    local = {s: inst.slots[s].start.astimezone(zone) for s in inst.feasible}
    at = lambda s: local[s].hour * 60 + local[s].minute  # noqa: E731
    target = at(peak)
    tod = {s: min(1.0, abs(at(s) - target) / PEAK_WIDTH) for s in inst.feasible}
    crits = [Criterion("sandbox:time", "Time of day", "sandbox", 1.0, 1.0, tod)]
    if avoid:
        day = {s: (1.0 if local[s].weekday() in avoid else 0.0) for s in inst.feasible}
        crits.append(Criterion("sandbox:days", "Days", "sandbox", 0.8, 0.8, day))
    return UtilityModel(uid, tuple(crits))


def apply_edits(inst: Instance, edits: dict[str, dict]) -> dict[str, list[str]]:
    """Replace edited people's true preferences (and so their honest reports). Returns what each now says."""
    from zoneinfo import ZoneInfo

    from eval.instances import MEETING_TZ

    said: dict[str, list[str]] = {}
    for uid, e in edits.items():
        k = next((i for i, p in enumerate(inst.people) if p.uid == uid), None)
        peak = e.get("peak")
        if k is None or peak not in inst.feasible:
            continue
        avoid = sorted({int(d) for d in e.get("avoid", []) if 0 <= int(d) <= 4})
        model = _edited_model(inst, uid, peak, avoid)
        inst.people[k] = replace(inst.people[k], model_true=model)
        inst.u[uid] = normalize(model.raw(inst.feasible), "range")
        t = inst.slots[peak].start.astimezone(ZoneInfo(MEETING_TZ))
        clock = t.strftime("%-I:%M %p").replace(":00", "")
        said[uid] = [f"Ideally around {clock}"] + ([f"Avoid {', '.join(DAYS[d] for d in avoid)}"] if avoid else [])
    return said


def lab_meeting(idx: int, n: int, attack: str, edits: dict[str, dict] | None = None) -> dict | None:
    """One meeting for the playground: every rule, the people in their own words, the truth.
    With edits, the named people's preferences are redrawn first (the sandbox)."""
    inst = make_instance(idx, n)
    if not inst:
        return None
    rewritten = apply_edits(inst, edits or {})
    data = _full(inst, list(MECHANISMS), attack)
    said = {p.uid: [s for _, s in p.phrases] for p in inst.people}
    said.update(rewritten)
    for person in data["people"]:
        person["said"] = said.get(person["user_id"], [])
        person["edited"] = person["user_id"] in rewritten
    data["liars"] = [p["user_id"] for p in data["people"] if p["liar"]]
    return data


def lab_instance(idx: int, n: int, mechs: list[str], attack: str) -> dict | None:
    """One meeting in full, to draw on the radar: its times, people, true scores and every pick."""
    inst = make_instance(idx, n)
    return _full(inst, mechs, attack) if inst else None


def _full(inst: Instance, mechs: list[str], attack: str) -> dict:
    row = _row(inst, mechs, attack)
    liars = condition(inst, attack)[2] if attack != "none" else []
    return {
        **row,
        "timezone": "America/New_York",
        "slots": [inst.slots[s].to_dict() for s in inst.feasible],
        "people": [
            {"user_id": p.uid, "name": p.name, "liar": k in liars,
             "d": round(100 * inst.d[p.uid], 1),  # true disagreement point: utility of no meeting
             "scores": {s: int(round(100 * inst.u[p.uid][s])) for s in inst.feasible}}
            for k, p in enumerate(inst.people)
        ],
    }
