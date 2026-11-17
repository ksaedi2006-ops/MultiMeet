"""The Lab: the preregistered evaluation (backend/eval), streamed one simulated meeting at a time.

Every meeting is generated with hidden true preferences, every chosen rule runs on the same
reports, and the outcome is scored against the truth, never against what agents reported. With
an attacker, one person (or a colluding pair) lies and the Lab measures what lying won them.
The instances are the same seeded ones docs/eval/RESULTS.md reports on.
"""

from __future__ import annotations

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


def _row(inst: Instance, mechs: list[str], attack: str) -> dict:
    best = oracle(inst)
    nw_or = nash_welfare(inst, best)
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
            "min": round(o["min"], 4),
            "util": round(o["util"], 4),
            "pareto": o["pareto"],
            "violation": o["violation"],
        }
        if res.extra:
            r["extra"] = res.extra
        if res.payments:
            r["payments"] = {u: round(v, 4) for u, v in res.payments.items()}
        if res.outcome and res.outcome.rounds:
            # The mediator's concession rounds (only Nash runs them): who was asked, for what, and the answer.
            r["rounds"] = [{
                "user_id": rd.request.user_id, "rule": rd.request.rule_label, "target": rd.request.target,
                "draft": rd.request.draft, "move": rd.applied.kind, "pick_after": rd.draft.pick,
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


def lab_meeting(idx: int, n: int, attack: str) -> dict | None:
    """One meeting for the playground: every rule, the people in their own words, the truth."""
    data = lab_instance(idx, n, list(MECHANISMS), attack)
    if data is None:
        return None
    inst = make_instance(idx, n)
    said = {p.uid: [s for _, s in p.phrases] for p in inst.people}
    for person in data["people"]:
        person["said"] = said.get(person["user_id"], [])
    data["liars"] = [p["user_id"] for p in data["people"] if p["liar"]]
    return data


def lab_instance(idx: int, n: int, mechs: list[str], attack: str) -> dict | None:
    """One meeting in full, to draw on the radar: its times, people, true scores and every pick."""
    inst = make_instance(idx, n)
    if not inst:
        return None
    row = _row(inst, mechs, attack)
    liars = condition(inst, attack)[2] if attack != "none" else []
    return {
        **row,
        "timezone": "America/New_York",
        "slots": [inst.slots[s].to_dict() for s in inst.feasible],
        "people": [
            {"user_id": p.uid, "name": p.name, "liar": k in liars,
             "scores": {s: int(round(100 * inst.u[p.uid][s])) for s in inst.feasible}}
            for k, p in enumerate(inst.people)
        ],
    }
