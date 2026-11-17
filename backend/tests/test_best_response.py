import itertools
import random

from app.scheduling.fairness import rank_slots
from app.scheduling.normalize import normalize
from app.scheduling.selector import nash_select
from eval.best_response import _ours_oneshot_reachable, weak_order_borda

SLOTS = ["s0", "s1", "s2", "s3"]


def test_weak_order_counts_are_the_fubini_numbers():
    assert [len(weak_order_borda(m)) for m in (1, 2, 3, 4, 5)] == [1, 3, 13, 75, 541]


def test_enumerated_reachable_set_matches_brute_force_over_cardinal_reports():
    rng = random.Random(11)
    for _ in range(25):
        others = {f"o{k}": normalize({s: rng.random() for s in SLOTS}, "borda") for k in range(2)}
        reach = set(_ours_oneshot_reachable(None, others, SLOTS))
        brute = set()
        grid = [0.0, 0.25, 0.5, 0.75, 1.0]  # every weak order of 4 slots is expressible on this grid
        for vec in itertools.product(grid, repeat=len(SLOTS)):
            u = dict(others)
            u["dev"] = normalize(dict(zip(SLOTS, vec)), "borda")
            brute.add(nash_select(u, {k: 0.0 for k in u}, SLOTS, require_ir=False).slot_id)
        assert reach == brute


def test_maxmin_target_report_reaches_exactly_what_any_report_reaches():
    rng = random.Random(5)
    for _ in range(25):
        others = {f"o{k}": {s: rng.randrange(0, 101) for s in SLOTS} for k in range(2)}
        by_target = {rank_slots(SLOTS, {**others, "dev": {s: 100 if s == t else 0 for s in SLOTS}})[0].slot_id
                     for t in SLOTS}
        brute = set()
        for vec in itertools.product([0, 30, 70, 100], repeat=len(SLOTS)):
            brute.add(rank_slots(SLOTS, {**others, "dev": dict(zip(SLOTS, vec))})[0].slot_id)
        assert by_target == brute
