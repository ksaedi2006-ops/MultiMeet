import math
import random
from datetime import datetime, timezone

import pytest

from app.scheduling.ics import BusyInterval
from app.scheduling.normalize import SCHEMES, normalize
from app.scheduling.rules import PreferenceRule
from app.scheduling.selector import (
    approval_select,
    borda_select,
    leximin_select,
    maxmin_raw_select,
    nash_select,
    nash_welfare,
    pareto_dominator,
    utilitarian_select,
)
from app.scheduling.slots import generate_slots
from app.scheduling.utility import build_model

SLOTS = ["a", "b", "c", "d"]


def norm_profile(raw, scheme="borda"):
    return {agent: normalize(row, scheme) for agent, row in raw.items()}


# ---------- normalization ----------

def test_range_maps_onto_unit_interval_and_ignores_affine_rescaling():
    raw = {"a": 3.0, "b": 7.0, "c": 5.0}
    out = normalize(raw, "range")
    assert out == {"a": 0.0, "b": 1.0, "c": 0.5}
    assert normalize({k: 10 * v - 4 for k, v in raw.items()}, "range") == out


def test_borda_averages_ties_and_an_indifferent_agent_sits_in_the_middle():
    assert normalize({"a": 1.0, "b": 0.0, "c": 0.0}, "borda") == {"a": 1.0, "b": 0.25, "c": 0.25}
    assert set(normalize({"a": 0.3, "b": 0.3, "c": 0.3}, "borda").values()) == {0.5}


def test_borda_removes_intensity():
    mild = normalize({"a": 0.6, "b": 0.5, "c": 0.4}, "borda")
    extreme = normalize({"a": 1.0, "b": 0.01, "c": 0.0}, "borda")
    assert mild == extreme


@pytest.mark.parametrize("scheme", [s for s in SCHEMES if s != "none"])
def test_every_scheme_lands_in_unit_interval(scheme):
    rng = random.Random(scheme)
    raw = {f"s{i}": rng.uniform(-3, 2) for i in range(9)}
    vals = normalize(raw, scheme).values()
    assert all(-1e-12 <= v <= 1 + 1e-12 for v in vals)


# ---------- selector ----------

def test_nash_is_invariant_to_one_agent_rescaling_its_raw_utilities():
    rng = random.Random(7)
    raw = {ag: {s: rng.random() for s in SLOTS} for ag in ("x", "y", "z")}
    d = {ag: 0.0 for ag in raw}
    for scheme in ("borda", "range"):
        base = nash_select(norm_profile(raw, scheme), d, SLOTS).slot_id
        rescaled = dict(raw, y={s: 100 * v + 40 for s, v in raw["y"].items()})
        assert nash_select(norm_profile(rescaled, scheme), d, SLOTS).slot_id == base
    # The pure Nash product (eps = 0, no normalization) is invariant to scaling gains.
    pos = {ag: {s: 0.1 + v for s, v in row.items()} for ag, row in raw.items()}
    base = nash_select(pos, d, SLOTS, eps=0.0).slot_id
    scaled = dict(pos, x={s: 25 * v for s, v in pos["x"].items()})
    assert nash_select(scaled, d, SLOTS, eps=0.0).slot_id == base


def test_maxmin_over_raw_scores_is_not_scale_invariant():
    # The current rule: an agent who uses only 40-60 outweighs one who uses 0-100.
    honest = {"x": {"a": 100, "b": 0}, "y": {"a": 0, "b": 100}}
    assert maxmin_raw_select(honest, ["a", "b"]).slot_id == "a"  # tie on min, tie on average: earlier
    compressed = {"x": {"a": 100, "b": 0}, "y": {"a": 40, "b": 60}}
    assert maxmin_raw_select(compressed, ["a", "b"]).slot_id == "a"
    squeezed = {"x": {"a": 100, "b": 45}, "y": {"a": 40, "b": 60}}
    assert maxmin_raw_select(squeezed, ["a", "b"]).slot_id == "b"


def test_leximin_breaks_ties_in_the_nash_product():
    # Same product (0.2 * 0.8 == 0.4 * 0.4 at eps=0), b leaves the worst-off better off.
    u = {"x": {"a": 0.2, "b": 0.4}, "y": {"a": 0.8, "b": 0.4}}
    sel = nash_select(u, {"x": 0, "y": 0}, ["a", "b"], eps=0.0)
    assert sel.slot_id == "b"


def test_eps_floor_stops_a_single_zero_vetoing_a_slot():
    u = {"x": {"a": 0.0, "b": 0.05}, "y": {"a": 1.0, "b": 0.06}, "z": {"a": 1.0, "b": 0.06}}
    d = {"x": 0, "y": 0, "z": 0}
    assert nash_select(u, d, ["a", "b"], eps=0.0).slot_id == "b"  # unanimity: any zero vetoes
    assert nash_select(u, d, ["a", "b"], eps=0.05).slot_id == "a"


def test_no_individually_rational_slot_is_an_explicit_outcome_with_a_near_miss():
    u = {"x": {"a": 0.9, "b": 0.2}, "y": {"a": 0.1, "b": 0.9}}
    sel = nash_select(u, {"x": 0.5, "y": 0.5}, ["a", "b"])
    assert sel.slot_id is None and sel.status == "no_ir_slot"
    assert sel.near_miss in ("a", "b")


def test_fairness_floor_excludes_slots_that_sacrifice_someone():
    u = {"x": {"a": 1.0, "b": 0.6}, "y": {"a": 1.0, "b": 0.6}, "z": {"a": 0.25, "b": 0.5}}
    d = {k: 0.0 for k in u}
    assert nash_select(u, d, ["a", "b"]).slot_id == "a"
    assert nash_select(u, d, ["a", "b"], tau=0.3).slot_id == "b"
    assert nash_select(u, d, ["a", "b"], tau=0.9).status == "floor_unmet"


def test_bottleneck_is_the_lowest_gain_at_the_pick():
    u = {"x": {"a": 0.9}, "y": {"a": 0.3}, "z": {"a": 0.6}}
    assert nash_select(u, {k: 0.1 for k in u}, ["a"]).bottleneck == "y"


def test_nash_pick_is_pareto_optimal_and_dominated_slots_are_found():
    rng = random.Random(3)
    for _ in range(200):
        u = {ag: {s: rng.random() for s in SLOTS} for ag in "xyz"}
        pick = nash_select(u, {ag: 0.0 for ag in u}, SLOTS).slot_id
        assert pareto_dominator(u, pick, SLOTS) is None
    u = {"x": {"a": 0.5, "b": 0.6}, "y": {"a": 0.5, "b": 0.5}}
    assert pareto_dominator(u, "a", ["a", "b"]) == "b"
    assert pareto_dominator(u, "b", ["a", "b"]) is None


def test_baselines_do_what_their_names_say():
    raw = {"x": {"a": 0.9, "b": 0.5, "c": 0.0}, "y": {"a": 0.0, "b": 0.5, "c": 0.9}}
    assert utilitarian_select(raw, ["a", "b", "c"]).slot_id == "b"  # sums 0.9, 1.0, 0.9
    assert borda_select(raw, ["a", "b", "c"]).slot_id == "a"  # all tie on Borda: earliest
    assert leximin_select(raw, {"x": 0, "y": 0}, ["a", "b", "c"]).slot_id == "b"
    approvals = {"x": {"a", "b"}, "y": {"b", "c"}}
    assert approval_select(approvals, ["a", "b", "c"]).slot_id == "b"


def test_nash_welfare_of_no_meeting_is_everyone_at_the_disagreement_point():
    u = {"x": {"a": 0.9}, "y": {"a": 0.9}}
    assert nash_welfare(u, {"x": 0, "y": 0}, None) == pytest.approx(2 * math.log(0.05))


# ---------- utilities come from rules, not scores ----------

def test_utilities_are_computed_from_rules_and_soft_commitments():
    tz = "America/New_York"
    slots = {s.id: s for s in generate_slots(
        start_date=datetime(2026, 11, 30).date(), end_date=datetime(2026, 11, 30).date(), tz=tz,
        duration_minutes=60, earliest_hour=9, latest_hour=17,
    )}
    gym = BusyInterval(datetime(2026, 11, 30, 18, 0, tzinfo=timezone.utc),  # 1 PM New York
                       datetime(2026, 11, 30, 19, 0, tzinfo=timezone.utc), "Gym", "soft")
    rules = [
        PreferenceRule(kind="time_of_day", strength="soft", time="15:00", width_minutes=60, summary="Ideally 3 PM"),
        PreferenceRule(kind="not_before", strength="hard", time="09:00", summary="Nothing before 9"),
    ]
    model = build_model("u1", slots, [gym], rules, tz)
    assert [c.rule_id for c in model.criteria] == ["r0:time_of_day", "event:Gym"]  # hard rule is the filter's job
    raw = model.raw(list(slots))
    best = max(raw, key=raw.get)
    assert "3:00 PM" in slots[best].local_label
    one_pm = next(s for s in slots if "1:00 PM" in slots[s].local_label)
    assert raw[one_pm] < raw[best] - 0.6  # gym clash costs its weight on top of the distance
    assert set(raw) == set(slots)  # every slot got a utility


def test_lowering_a_weight_never_lowers_any_utility():
    tz = "UTC"
    slots = {s.id: s for s in generate_slots(
        start_date=datetime(2026, 11, 30).date(), end_date=datetime(2026, 12, 1).date(), tz=tz,
        duration_minutes=60, earliest_hour=9, latest_hour=17,
    )}
    rules = [PreferenceRule(kind="avoid_weekdays", strength="soft", weekdays=[0], summary="Avoid Mon", weight=0.8)]
    model = build_model("u", slots, [], rules, tz)
    before = model.raw(list(slots))
    after = model.with_weight("r0:avoid_weekdays", 0.3).raw(list(slots))
    assert all(after[s] >= before[s] for s in slots)
    assert any(after[s] > before[s] for s in slots)
