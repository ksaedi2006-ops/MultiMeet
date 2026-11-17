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
        pick = run(mech, inst, honest, slots).pick
        o = outcome(inst, pick, nw_or)
        r = {
            "pick": pick,
            "ratio": round(o["ratio"], 4),
            "min": round(o["min"], 4),
            "util": round(o["util"], 4),
            "pareto": o["pareto"],
            "violation": o["violation"],
        }
        if attack != "none":
            lied, lslots, liars = condition(inst, attack)
            lpick = run(mech, inst, lied, lslots).pick
            before = utilities_at(inst, pick)
            after = utilities_at(inst, lpick)
            uids = [inst.uids[k] for k in liars]
            honest_ids = [u for u in inst.uids if u not in uids]
            r["attack_pick"] = lpick
            # What lying won the liars, and what it cost everyone else, on their true utilities.
            r["gain"] = round(sum(after[u] - before[u] for u in uids) / len(uids), 4)
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
