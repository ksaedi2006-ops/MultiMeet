"""Properties the Lab shows as badges, checked here so the UI never claims what the code doesn't do."""

import pytest

from app.scheduling.selector import (
    copeland_select,
    ks_select,
    median_select,
    pareto_dominator,
    plurality_select,
    random_dictator_select,
)
from eval.instances import make_instance
from eval.mechanisms import condition, run
from eval.metrics import utilities_at

SLOTS = ["a", "b", "c", "d"]
REPORT_LIES = ("inflater", "victim", "pair")  # lies about preferences, not about hard constraints


def instances(n: int, k: int = 25):
    for idx in range(k):
        inst = make_instance(idx, n)
        if inst:
            yield inst


def liar_gain(mech: str, inst, cond: str) -> float:
    honest, slots, _ = condition(inst, "honest")
    lied, lslots, liars = condition(inst, cond)
    h, l = run(mech, inst, honest, slots), run(mech, inst, lied, lslots)
    before, after = utilities_at(inst, h.pick), utilities_at(inst, l.pick)
    uids = [inst.uids[k] for k in liars]
    paid = {u: (l.payments or {}).get(u, 0.0) - (h.payments or {}).get(u, 0.0) for u in uids}
    return sum(after[u] - before[u] - paid[u] for u in uids) / len(uids)


@pytest.mark.parametrize("cond", ["inflater", "victim"])
def test_random_dictatorship_never_rewards_a_lone_liar(cond):
    """Random dictatorship (Gibbard 1977): a single agent misreporting never gains."""
    for n in (3, 5):
        for inst in instances(n):
            assert liar_gain("RD", inst, cond) <= 1e-9


def test_clarke_tax_makes_truth_a_dominant_strategy():
    """VCG with Clarke payments (Ephrati & Rosenschein 1991): against true utilities, no
    misreport beats reporting the truth once payments are counted."""
    import itertools
    import random

    from app.scheduling.selector import vcg_select

    rng = random.Random(3)
    slots = ["a", "b", "c", "d"]
    grid = [0.0, 0.5, 1.0]
    for _ in range(40):
        truth = {a: {s: rng.random() for s in slots} for a in ("x", "y", "z")}
        sel, pay = vcg_select(truth, slots)
        honest = truth["x"][sel.slot_id] - pay["x"]
        for vec in itertools.product(grid, repeat=len(slots)):
            lied = dict(truth, x=dict(zip(slots, vec)))
            lsel, lpay = vcg_select(lied, slots)
            assert truth["x"][lsel.slot_id] - lpay["x"] <= honest + 1e-9


def test_nash_can_be_manipulated_somewhere():
    """The contrast the Lab shows: Nash bargaining is not strategy-proof."""
    gains = [liar_gain("Ours-topk", inst, c) for inst in instances(3, 40) for c in REPORT_LIES]
    assert max(gains) > 0


def test_median_is_strategy_proof_on_single_peaked_time_of_day():
    """Moulin 1980: with single-peaked preferences over time of day, no one gains by
    misreporting their peak under the generalized median."""
    minutes = {s: 540 + 60 * i for i, s in enumerate(["h9", "h10", "h11", "h12", "h13", "h14", "h15"])}
    slots = list(minutes)

    def peaked(peak: str) -> dict[str, float]:
        return {s: -abs(minutes[s] - minutes[peak]) for s in slots}

    truths = {"x": "h10", "y": "h12", "z": "h15"}
    honest = {a: peaked(p) for a, p in truths.items()}
    base = median_select(honest, slots, minutes).slot_id
    for liar, peak in truths.items():
        for fake in slots:
            lied = dict(honest, **{liar: peaked(fake)})
            pick = median_select(lied, slots, minutes).slot_id
            assert honest[liar][pick] <= honest[liar][base] + 1e-9


def test_ks_with_leximin_ties_is_pareto_optimal():
    """Roth (1979) shows continuous Kalai-Smorodinsky can be Pareto-inefficient for n >= 3;
    our discrete version breaks ties by leximin over shares, so its pick is never dominated."""
    for inst in instances(5):
        sel = ks_select(inst.u, {u: 0.0 for u in inst.u}, inst.feasible)
        assert pareto_dominator(inst.u, sel.slot_id, inst.feasible) is None


def test_copeland_picks_the_condorcet_winner_when_there_is_one():
    raw = {"x": {"a": 3, "b": 2, "c": 1, "d": 0}, "y": {"a": 2, "b": 3, "c": 1, "d": 0}, "z": {"a": 3, "b": 1, "c": 2, "d": 0}}
    sel, condorcet = copeland_select(raw, SLOTS)
    assert sel.slot_id == "a" and condorcet


def test_copeland_reports_a_cycle():
    # The classic Condorcet paradox: a > b > c > a.
    raw = {"x": {"a": 3, "b": 2, "c": 1}, "y": {"a": 1, "b": 3, "c": 2}, "z": {"a": 2, "b": 1, "c": 3}}
    _, condorcet = copeland_select(raw, ["a", "b", "c"])
    assert not condorcet


def test_plurality_counts_only_favourites():
    raw = {"x": {"a": 1.0, "b": 0.99}, "y": {"a": 1.0, "b": 0.99}, "z": {"a": 0.0, "b": 1.0}}
    assert plurality_select(raw, ["a", "b"]).slot_id == "a"


def test_random_dictator_draw_ignores_reports():
    a = {"x": {"a": 1, "b": 0}, "y": {"a": 0, "b": 1}}
    b = {"x": {"a": 0, "b": 1}, "y": {"a": 1, "b": 0}}
    assert random_dictator_select(a, ["a", "b"], "s")[1] == random_dictator_select(b, ["a", "b"], "s")[1]
