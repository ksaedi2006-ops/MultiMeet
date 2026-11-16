"""Run the whole evaluation: `cd backend && venv/bin/python -m eval.run`.

Options: --quick (a few instances per n, for a smoke test), --workers N, --llm (B2, B6
and the LLM attackers; needs ANTHROPIC_API_KEY, skipped cleanly without it).

Writes docs/eval/results.json, docs/eval/*.png and docs/eval/RESULTS.md, and the
per-instance rows to backend/eval/out/rows.jsonl (not committed).
"""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics as st
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "eval"
OUT = Path(__file__).resolve().parent / "out"

PER_N = 510
SMALL_PER_N = 150
NS = (3, 5, 8)


def _sync(coro):
    """Run a coroutine that never awaits (the simulated agents) without an event loop."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    raise RuntimeError("coroutine awaited")


def _translation(inst) -> list[dict]:
    from app.agents.simulated import SimulatedAgents

    sim = SimulatedAgents()
    out = []
    for p in inst.people:
        for rule, said in p.phrases:
            parsed = _sync(sim.parse_preference(said)).rules

            def same(r):
                if r.kind != rule.kind:
                    return False
                if rule.kind in ("not_before", "not_after", "time_of_day"):
                    return r.time == rule.time
                if rule.kind == "avoid_weekdays":
                    return sorted(r.weekdays or []) == sorted(rule.weekdays or [])
                if rule.kind == "day_weights":
                    return (r.day_weights or [1] * 7).index(min(r.day_weights or [1])) == rule.day_weights.index(min(rule.day_weights))
                if rule.kind == "buffer_minutes":
                    return r.minutes == rule.minutes
                return True

            hit = next((r for r in parsed if same(r)), None)
            out.append({"kind": rule.kind, "match": hit is not None,
                        "strength": hit is not None and hit.strength == rule.strength})
    return out


def _faithful(inst, outcome) -> bool | None:
    from app.agents.simulated import SimulatedAgents
    from app.agents.types import DecisionView
    from app.scheduling.protocol import binding_reason, faithful

    draft = outcome.final
    if draft.pick is None:
        return None
    names = {p.uid: p.name for p in inst.people}
    binding = binding_reason(draft, {s.user_id: s.model for s in outcome.states})
    label = lambda s: inst.slots[s].local_label  # noqa: E731
    view = DecisionView(
        title="Eval", status="converged", chosen_label=label(draft.pick),
        scores={names[u]: int(100 * draft.utilities[u][draft.pick]) for u in names},
        compromises=[], alternatives=[], replies=[],
        runner_up_label=label(binding.runner_up) if binding.runner_up else None,
        decisive=names.get(binding.decisive), decisive_reason=binding.decisive_label,
        bottleneck=names.get(binding.bottleneck),
        tied_labels=[label(s) for s in binding.tied[:1]],
    )
    text = _sync(SimulatedAgents().explain(view)).explanation
    return faithful(text, binding, names)


def evaluate(args: tuple[int, int]) -> dict:
    n, idx = args
    from eval.instances import make_instance
    from eval.mechanisms import ATTACKED, CONDITIONS, MECHANISMS, condition, oracle, run
    from eval.metrics import nash_welfare, outcome, utilities_at

    inst = make_instance(idx, n)
    if inst is None:
        return {"n": n, "idx": idx, "dropped": True}
    orc = oracle(inst)
    nw_orc = nash_welfare(inst, orc)
    row = {"n": n, "idx": idx, "density": inst.density, "multi_tz": inst.multi_tz, "m": len(inst.feasible),
           "redraws": inst.redraws, "honest": {}, "attacks": {}, "violations": 0}
    honest_u = {}
    for cond in CONDITIONS:
        reports, slots, dev = condition(inst, cond)
        mechs = MECHANISMS if cond == "honest" else ATTACKED
        if cond != "honest":
            row["attacks"][cond] = {}
        for mech in mechs:
            t0 = time.perf_counter()
            res = run(mech, inst, reports, slots)
            ms = (time.perf_counter() - t0) * 1000
            met = outcome(inst, res.pick, nw_orc)
            row["violations"] += int(met["violation"])
            if cond == "honest":
                honest_u[mech] = met["u"]
                row["honest"][mech] = {k: met[k] for k in ("nw", "ratio", "dist", "util", "min", "prop", "pareto")}
                row["honest"][mech].update(rounds=res.rounds, ms=round(ms, 3))
                if mech == "Ours" and res.outcome is not None:
                    row["faithful"] = _faithful(inst, res.outcome)
            else:
                base = honest_u[mech]
                devs = [inst.uids[i] for i in dev]
                rest = [u for u in inst.uids if u not in devs]
                gain = sum(met["u"][u] - base[u] for u in devs)
                harm = (sum(met["u"][u] - base[u] for u in rest) / len(rest)) if rest else 0.0
                gm_h = math.exp(row["honest"][mech]["nw"] / n)
                gm_a = math.exp(met["nw"] / n)
                row["attacks"][cond][mech] = {"gain": gain, "harm": harm, "psb": gm_h / gm_a,
                                              "pareto": met["pareto"], "rounds": res.rounds}
    # Amendment 2: fake hard constraints limited to 2 declared rules (hard tokens).
    from eval.mechanisms import BUDGETED, budget_attack
    row["attacks"]["fakehard-2tok"] = {}
    for mech in BUDGETED:
        res, chosen = budget_attack(inst, mech)
        met = outcome(inst, res.pick, nw_orc)
        row["violations"] += int(met["violation"])
        base = honest_u[mech]
        a0 = inst.uids[0]
        rest = [u for u in inst.uids if u != a0]
        row["attacks"]["fakehard-2tok"][mech] = {
            "gain": met["u"][a0] - base[a0],
            "harm": sum(met["u"][u] - base[u] for u in rest) / len(rest),
            "psb": math.exp(row["honest"][mech]["nw"] / n) / math.exp(met["nw"] / n),
            "pareto": met["pareto"], "rounds": res.rounds, "tokens": len(chosen),
        }
    row["oracle_nw"] = nw_orc
    row["translation"] = _translation(inst)
    # Would the old product have escalated (min score below 40) instead of scheduling?
    from eval.mechanisms import _b3_scores
    reports, slots, _ = condition(inst, "honest")
    from app.scheduling.fairness import rank_slots
    ranked = rank_slots(slots, {r.uid: _b3_scores(r, r.model, slots) for r in reports})
    row["b3_would_escalate"] = ranked[0].min_score < 40
    del utilities_at
    return row


def evaluate_small(args: tuple[int, int]) -> dict:
    n, idx = args
    from eval.best_response import analyse
    from eval.instances import make_small_instance

    inst = make_small_instance(idx, n)
    if inst is None:
        return {"n": n, "idx": idx, "dropped": True}
    return analyse(inst)


# ---------- statistics ----------

def boot_ci(xs: list[float], seed: int = 7, reps: int = 2000) -> tuple[float, float, float]:
    import random

    if not xs:
        return (float("nan"),) * 3
    rng = random.Random(seed)
    n = len(xs)
    means = sorted(sum(xs[rng.randrange(n)] for _ in range(n)) / n for _ in range(reps))
    return sum(xs) / n, means[int(0.025 * reps)], means[int(0.975 * reps) - 1]


def paired_ci(a: list[float], b: list[float]) -> tuple[float, float, float]:
    return boot_ci([x - y for x, y in zip(a, b)])


def summarise(rows: list[dict], small: list[dict]) -> dict:
    from eval.mechanisms import MECHANISMS

    kept = [r for r in rows if not r.get("dropped")]
    res: dict = {"instances": {}, "honest": {}, "paired": {}, "attacks": {}, "best_response": {}, "checks": {}}
    for n in NS:
        rs = [r for r in kept if r["n"] == n]
        res["instances"][n] = {
            "kept": len(rs), "dropped": sum(1 for r in rows if r["n"] == n and r.get("dropped")),
            "feasible_median": st.median(r["m"] for r in rs), "feasible_min": min(r["m"] for r in rs),
            "feasible_max": max(r["m"] for r in rs), "redraws": sum(r["redraws"] for r in rs),
            "multi_tz": sum(r["multi_tz"] for r in rs),
        }
        res["honest"][n] = {}
        for mech in MECHANISMS:
            col = lambda k: [r["honest"][mech][k] for r in rs]  # noqa: E731
            res["honest"][n][mech] = {
                "ratio": boot_ci(col("ratio")), "min": boot_ci(col("min")), "nw": boot_ci(col("nw")),
                "util": boot_ci(col("util")), "prop": boot_ci(col("prop")), "dist": boot_ci(col("dist")),
                "pareto_rate": sum(col("pareto")) / len(rs),
                "rounds_median": st.median(col("rounds")), "rounds_mean": sum(col("rounds")) / len(rs),
                "ms_median": st.median(col("ms")),
            }
        res["paired"][n] = {}
        for other in ("B0", "B1", "B3", "B4", "B5"):
            for k in ("nw", "min"):
                a = [r["honest"]["Ours"][k] for r in rs]
                b = [r["honest"][other][k] for r in rs]
                res["paired"][n][f"Ours-{other}:{k}"] = paired_ci(a, b)
    for cond in ("inflater", "victim", "fakehard", "stubborn", "pair", "fakehard-2tok"):
        res["attacks"][cond] = {}
        for mech in kept[0]["attacks"].get(cond, {}):
            g = [r["attacks"][cond][mech]["gain"] for r in kept]
            h = [r["attacks"][cond][mech]["harm"] for r in kept]
            p = [r["attacks"][cond][mech]["psb"] for r in kept]
            res["attacks"][cond][mech] = {
                "gain_median": st.median(g), "gain": boot_ci(g), "gain_positive_rate": sum(x > 1e-9 for x in g) / len(g),
                "harm": boot_ci(h), "psb_mean": sum(p) / len(p),
            }
    sk = [r for r in small if not r.get("dropped")]
    if sk:
        for mech in sk[0]["gain"]:
            g = [r["gain"][mech] for r in sk]
            gs = sorted(g)
            res["best_response"][mech] = {"mean": boot_ci(g), "p95": gs[int(0.95 * (len(gs) - 1))], "max": gs[-1],
                                         "positive_rate": sum(x > 1e-9 for x in g) / len(g)}
        res["best_response"]["paired:Ours-oneshot-B3-oneshot"] = paired_ci(
            [r["gain"]["Ours-oneshot"] for r in sk], [r["gain"]["B3-oneshot"] for r in sk])
        res["best_response"]["instances"] = {"kept": len(sk), "dropped": len(small) - len(sk),
                                             "m_median": st.median(r["m"] for r in sk)}
    trans = [t for r in kept for t in r["translation"]]
    by_kind: dict[str, list] = {}
    for t in trans:
        by_kind.setdefault(t["kind"], []).append(t)
    res["checks"] = {
        "violations": sum(r["violations"] for r in kept),
        "faithful_rate": (lambda f: sum(f) / len(f) if f else None)([r["faithful"] for r in kept if r.get("faithful") is not None]),
        "translation_match": sum(t["match"] for t in trans) / len(trans) if trans else None,
        "translation_strength": sum(t["strength"] for t in trans) / len(trans) if trans else None,
        "translation_by_kind": {k: {"n": len(v), "match": sum(t["match"] for t in v) / len(v)} for k, v in by_kind.items()},
        "b3_would_escalate": sum(r["b3_would_escalate"] for r in kept) / len(kept),
    }
    res["amendment2"] = amendment2(kept)
    return res


# ---------- amendment 2 (docs/eval/preregistration.md) ----------

def amendment2(kept: list[dict]) -> dict:
    from eval.mechanisms import VARIANTS

    out: dict = {"variants": {}, "winner": None}
    for v in VARIANTS:
        ratios = {n: [r["honest"][v]["ratio"] for r in kept if r["n"] == n] for n in NS}
        pooled = [x for xs in ratios.values() for x in xs]
        gains = {c: boot_ci([r["attacks"][c][v]["gain"] for r in kept]) for c in ("inflater", "victim", "pair")}
        pareto = {n: sum(r["honest"][v]["pareto"] for r in kept if r["n"] == n) / len(ratios[n]) for n in NS}
        ok_a = all(g[0] <= 0 for g in gains.values())
        ok_b = all(p >= 0.98 for p in pareto.values())
        ok_c = all(sum(xs) / len(xs) >= 0.95 for xs in ratios.values())
        out["variants"][v] = {
            "ratio_pooled": boot_ci(pooled), "ratio_by_n": {n: sum(xs) / len(xs) for n, xs in ratios.items()},
            "min_by_n": {n: sum(r["honest"][v]["min"] for r in kept if r["n"] == n) / len(ratios[n]) for n in NS},
            "gains": gains, "pareto_by_n": pareto, "eligible": {"a": ok_a, "b": ok_b, "c": ok_c},
        }
    eligible = [v for v, d in out["variants"].items() if all(d["eligible"].values())]
    out["winner"] = max(eligible, key=lambda v: out["variants"][v]["ratio_pooled"][0]) if eligible else "Ours"
    out["winner_was_eligible"] = bool(eligible)
    w = out["winner"]
    # Hard tokens: budgeted vs unbudgeted fake-hard gain under the winner, paired.
    a = [r["attacks"]["fakehard-2tok"][w]["gain"] for r in kept]
    b = [r["attacks"]["fakehard"][w]["gain"] for r in kept]
    out["tokens"] = {"budgeted": boot_ci(a), "unbudgeted": boot_ci(b), "diff": paired_ci(a, b)}
    out["tokens"]["adopt"] = out["tokens"]["diff"][2] < 0
    # Q2 for the winner against B3, as preregistered.
    out["q2"] = {}
    for n in NS:
        rs = [r for r in kept if r["n"] == n]
        for k in ("nw", "min"):
            out["q2"][f"{n}:{k}"] = paired_ci([r["honest"][w][k] for r in rs], [r["honest"]["B3"][k] for r in rs])
    return out


def amendment2_md(a2: dict, res: dict) -> list[str]:
    lines = ["", "## Amendment 2: capped intensity, a fairness floor and hard tokens", "",
             "Variants and the decision rule were fixed in [Amendment 2](preregistration.md) before this run.", "",
             "| variant | ratio to oracle (pooled) | by n (3/5/8) | min gain by n | lying gain: inflater / victim / pair | Pareto ≥98% | eligible |",
             "|---|---|---|---|---|---|---|"]
    for v, d in a2["variants"].items():
        r = d["ratio_pooled"]
        g = d["gains"]
        e = d["eligible"]
        lines.append(
            f"| {v} | {r[0]:.3f} [{r[1]:.3f}, {r[2]:.3f}] | " + " / ".join(f"{d['ratio_by_n'][n]:.3f}" for n in NS)
            + " | " + " / ".join(f"{d['min_by_n'][n]:+.3f}" for n in NS)
            + f" | {g['inflater'][0]:+.3f} / {g['victim'][0]:+.3f} / {g['pair'][0]:+.3f} | "
            + ("yes" if e["b"] else "no") + " | " + ("**yes**" if all(e.values()) else
                                                     "no (" + ", ".join(k for k, ok in e.items() if not ok) + ")") + " |")
    w = a2["winner"]
    lines += ["", f"**Decision:** the new default is **{w}**" + ("" if a2["winner_was_eligible"] else
              " (no variant met (a)–(c), so the default stays Ours)") + ".", ""]
    t = a2["tokens"]
    lines += [f"**Hard tokens (under {w}):** budgeted fake-hard gain {t['budgeted'][0]:+.3f} "
              f"[{t['budgeted'][1]:+.3f}, {t['budgeted'][2]:+.3f}] vs unbudgeted {t['unbudgeted'][0]:+.3f}; "
              f"paired difference {t['diff'][0]:+.3f} [{t['diff'][1]:+.3f}, {t['diff'][2]:+.3f}] → "
              + ("**adopt**." if t["adopt"] else "**do not adopt** (the CI does not lie below 0)."), ""]
    lines += [f"**Q2 for {w} against B3** (paired difference, 95% CI; pass = entirely above 0):", "",
              "| n | Nash welfare | min utility |", "|---|---|---|"]
    for n in NS:
        cells = []
        for k in ("nw", "min"):
            m, lo, hi = a2["q2"][f"{n}:{k}"]
            cells.append(f"{m:+.3f} [{lo:+.3f}, {hi:+.3f}] {'pass' if lo > 0 else 'MISS'}")
        lines.append(f"| {n} | {cells[0]} | {cells[1]} |")
    fh = res["attacks"].get("fakehard-2tok", {})
    if fh:
        lines += ["", "Budgeted fake-hard gain by mechanism (mean, unbudgeted in brackets): " + ", ".join(
            f"{m} {v['gain'][0]:+.3f} ({res['attacks']['fakehard'][m]['gain'][0]:+.3f})" for m, v in fh.items()) + "."]
    return lines


# ---------- thresholds ----------

def thresholds(res: dict) -> list[dict]:
    rows = []
    for n in NS:
        r = res["honest"][n]["Ours"]["ratio"][0]
        rows.append({"id": "Q1", "n": n, "claim": "Ours mean ratio to oracle ≥ 0.95", "value": f"{r:.3f}", "pass": r >= 0.95})
    for n in NS:
        for other in ("B1", "B3"):
            for k in ("nw", "min"):
                m, lo, hi = res["paired"][n][f"Ours-{other}:{k}"]
                a = res["honest"][n]["Ours"][k]
                b = res["honest"][n][other][k]
                overlap = not (a[1] > b[2] or b[1] > a[2])
                rows.append({"id": "Q2", "n": n, "claim": f"Ours > {other} on {'Nash welfare' if k == 'nw' else 'min utility'}",
                             "value": f"Δ {m:+.3f} [{lo:+.3f}, {hi:+.3f}]; marginal CIs {'overlap' if overlap else 'separate'}",
                             "pass": lo > 0})
    for n in NS:
        p = res["honest"][n]["Ours"]["pareto_rate"]
        rows.append({"id": "E1", "n": n, "claim": "Ours Pareto-optimal ≥ 98%", "value": f"{100 * p:.1f}%", "pass": p >= 0.98})
    for cond in ("inflater", "victim", "fakehard"):
        o = res["attacks"][cond]["Ours"]
        b = res["attacks"][cond]["B3"]
        if b["gain_median"] > 1e-12:
            ok = o["gain_median"] <= 0.5 * b["gain_median"]
            val = f"median {o['gain_median']:.3f} vs B3 {b['gain_median']:.3f}"
        else:
            ok = o["gain"][0] <= 0.5 * b["gain"][0] if b["gain"][0] > 0 else o["gain"][0] <= 0
            val = f"B3 median 0 → means: {o['gain'][0]:.3f} vs B3 {b['gain'][0]:.3f}"
        rows.append({"id": "R1", "n": "all", "claim": f"{cond}: Ours gain ≤ 0.5 × B3", "value": val, "pass": ok})
    br = res["best_response"]
    if br:
        m, lo, hi = br["paired:Ours-oneshot-B3-oneshot"]
        o = br["Ours-oneshot"]
        rows.append({"id": "R2", "n": "3–4", "claim": "Exact BR gain: Ours-oneshot below B3-oneshot",
                     "value": f"mean {o['mean'][0]:.3f} (p95 {o['p95']:.3f}, max {o['max']:.3f}); Δ {m:+.3f} [{lo:+.3f}, {hi:+.3f}]",
                     "pass": hi < 0})
    rows.append({"id": "R3", "n": "—", "claim": "Injection / persuasion gain ≈ 0", "value": "not run (needs an LLM); structural unit test only", "pass": None})
    v = res["checks"]["violations"]
    rows.append({"id": "S1", "n": "all", "claim": "0 hard-constraint violations", "value": str(v), "pass": v == 0})
    for n in NS:
        r = res["honest"][n]["Ours"]["rounds_median"]
        rows.append({"id": "C1", "n": n, "claim": "Ours median rounds ≤ 2", "value": f"{r:g} (median runtime {res['honest'][n]['Ours']['ms_median']:.0f} ms)", "pass": r <= 2})
    f = res["checks"]["faithful_rate"]
    rows.append({"id": "F1", "n": "all", "claim": "≥ 95% explanations name the decisive person (simulated explainer)",
                 "value": f"{100 * f:.1f}%" if f is not None else "n/a", "pass": None if f is None else f >= 0.95})
    t = res["checks"]["translation_match"]
    rows.append({"id": "T1", "n": "all", "claim": "Translation match rate (simulated parser), reported",
                 "value": f"{100 * t:.1f}% kind+value; {100 * res['checks']['translation_strength']:.1f}% incl. hard/soft", "pass": None})
    return rows


# ---------- charts ----------

COLORS = {"Ours": "#2a78d6", "B1": "#eb6834", "B3": "#1baf7a", "B4": "#eda100", "B5": "#e87ba4", "B0": "#008300"}
INK, MUTED, GRID, SURFACE = "#1d1d1b", "#6b6a63", "#e4e3dd", "#fcfcfb"
LABEL = {"Ours": "Ours (Nash + mediator)", "B1": "B1 When2Meet (approval)", "B3": "B3 old MultiMeet (max-min)",
         "B4": "B4 utilitarian", "B5": "B5 Borda", "B0": "B0 random"}


def _style(ax, title, ylabel):
    ax.set_facecolor(SURFACE)
    ax.set_title(title, loc="left", color=INK, fontsize=12, fontweight="bold", pad=10)
    ax.set_ylabel(ylabel, color=MUTED, fontsize=10)
    ax.tick_params(colors=MUTED, labelsize=9, length=0)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def _grouped(ax, groups, mechs, value, err=None):
    import numpy as np

    width = 0.8 / len(mechs)
    x = np.arange(len(groups))
    for k, mech in enumerate(mechs):
        vals = [value(g, mech) for g in groups]
        pos = x - 0.4 + width * (k + 0.5)
        ax.bar(pos, vals, width * 0.86, color=COLORS[mech], label=LABEL[mech], edgecolor=SURFACE, linewidth=1)
        if err:
            lo = [vals[i] - err(g, mech)[0] for i, g in enumerate(groups)]
            hi = [err(g, mech)[1] - vals[i] for i, g in enumerate(groups)]
            ax.errorbar(pos, vals, yerr=[lo, hi], fmt="none", ecolor=INK, elinewidth=1, capsize=2)
    ax.set_xticks(x)
    return x


def charts(res: dict) -> list[str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update({"font.family": "DejaVu Sans", "figure.facecolor": SURFACE})
    made = []
    mechs = ["Ours", "B1", "B3", "B4", "B5", "B0"]

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    _grouped(axes[0], NS, mechs, lambda n, m: res["honest"][n][m]["ratio"][0],
                 lambda n, m: res["honest"][n][m]["ratio"][1:])
    axes[0].set_xticklabels([f"{n} people" for n in NS])
    axes[0].axhline(0.95, color=INK, linewidth=1, linestyle=(0, (3, 3)))
    axes[0].set_ylim(0.5, 1.02)
    _style(axes[0], "Welfare vs. the oracle (honest agents)", "geometric-mean welfare ÷ oracle (dashed: 0.95 target)")
    _grouped(axes[1], NS, mechs, lambda n, m: res["honest"][n][m]["min"][0],
             lambda n, m: res["honest"][n][m]["min"][1:])
    axes[1].set_xticklabels([f"{n} people" for n in NS])
    _style(axes[1], "Worst-off person", "min true gain over no meeting")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    fig.legend(handles, labels, frameon=False, fontsize=8, loc="lower center", ncol=6, labelcolor=INK)
    fig.savefig(DOCS / "quality.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    made.append("quality.png")

    fig, ax = plt.subplots(figsize=(8, 3.6))
    _grouped(ax, NS, mechs, lambda n, m: 100 * res["honest"][n][m]["pareto_rate"])
    ax.set_xticklabels([f"{n} people" for n in NS])
    ax.axhline(98, color=INK, linewidth=1, linestyle=(0, (3, 3)))
    ax.set_ylim(0, 103)
    _style(ax, "Picks no other time beats for everyone", "Pareto-optimal on ground truth (%)")
    ax.legend(frameon=False, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.1), ncol=3, labelcolor=INK)
    fig.tight_layout()
    fig.savefig(DOCS / "pareto.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    made.append("pareto.png")

    conds = ["inflater", "victim", "fakehard", "stubborn", "pair"]
    amechs = ["Ours", "B1", "B3", "B4", "B5"]
    fig, ax = plt.subplots(figsize=(10, 4))
    _grouped(ax, conds, amechs, lambda c, m: res["attacks"][c][m]["gain"][0],
             lambda c, m: res["attacks"][c][m]["gain"][1:])
    ax.set_xticklabels(["Inflater", "Victim", "Fake hard\nconstraint", "Stubborn", "Colluding\npair"])
    ax.axhline(0, color=GRID, linewidth=1)
    _style(ax, "What a liar gains (scripted attackers, all group sizes)", "mean true-utility gain")
    ax.legend(frameon=False, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.16), ncol=5, labelcolor=INK)
    fig.tight_layout()
    fig.savefig(DOCS / "manipulation.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    made.append("manipulation.png")

    br = {k: v for k, v in res["best_response"].items() if isinstance(v, dict) and "mean" in v}
    if br:
        order = [k for k in ("Ours-oneshot", "Ours (approx.)", "B1", "B3-oneshot", "B4", "B5") if k in br]
        color = {"Ours-oneshot": COLORS["Ours"], "Ours (approx.)": COLORS["Ours"], "B1": COLORS["B1"],
                 "B3-oneshot": COLORS["B3"], "B4": COLORS["B4"], "B5": COLORS["B5"]}
        fig, ax = plt.subplots(figsize=(8, 3.6))
        means = [br[k]["mean"][0] for k in order]
        ax.bar(range(len(order)), means, 0.6, color=[color[k] for k in order], edgecolor=SURFACE)
        ax.errorbar(range(len(order)), means, yerr=[[m - br[k]["mean"][1] for m, k in zip(means, order)],
                                                    [br[k]["mean"][2] - m for m, k in zip(means, order)]],
                    fmt="none", ecolor=INK, elinewidth=1, capsize=3)
        ax.scatter(range(len(order)), [br[k]["p95"] for k in order], marker="_", s=300, color=INK, zorder=3, label="95th percentile")
        ax.set_xticks(range(len(order)))
        ax.set_xticklabels(["Ours\n(one-shot)", "Ours\n(+mediator, approx.)", "B1\nWhen2Meet", "B3\nmax-min", "B4\nutilitarian", "B5\nBorda"], fontsize=8)
        _style(ax, "Exact best-response gain (3–4 people, ≤ 8 slots)", "true-utility gain of the optimal lie")
        ax.legend(frameon=False, fontsize=8, labelcolor=INK)
        fig.tight_layout()
        fig.savefig(DOCS / "best_response.png", dpi=160, bbox_inches="tight")
        plt.close(fig)
        made.append("best_response.png")
    return made


# ---------- report ----------

def write_results_md(res: dict, rows: list[dict], made: list[str], elapsed: float, llm_status: str) -> None:
    def mark(p):
        return "—" if p is None else ("**pass**" if p else "**MISS**")

    lines = ["# Evaluation results", "",
             "Generated by `cd backend && venv/bin/python -m eval.run`, against the thresholds in",
             "[preregistration.md](preregistration.md). Simulated agents only (`MULTIMEET_AGENTS=simulated`).",
             f"LLM baselines and attackers: {llm_status}. Runtime {elapsed / 60:.1f} min.", "",
             "## Against the preregistered thresholds", "", "| # | n | Claim | Result | |", "|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['id']} | {r['n']} | {r['claim']} | {r['value']} | {mark(r['pass'])} |")
    lines += ["", "## Instances", "", "| n | kept | dropped | multi-time-zone | feasible slots (median, range) |", "|---|---|---|---|---|"]
    for n in NS:
        i = res["instances"][n]
        lines.append(f"| {n} | {i['kept']} | {i['dropped']} | {i['multi_tz']} | {i['feasible_median']:g} ({i['feasible_min']}–{i['feasible_max']}) |")
    lines += ["", "## Quality with honest agents (mean, 95% bootstrap CI)", "",
              "| n | mechanism | ratio to oracle | min gain | utilitarian | proportional | Pareto-optimal | rounds (median) |",
              "|---|---|---|---|---|---|---|---|"]
    for n in NS:
        for mech, v in res["honest"][n].items():
            r, m = v["ratio"], v["min"]
            lines.append(f"| {n} | {mech} | {r[0]:.3f} [{r[1]:.3f}, {r[2]:.3f}] | {m[0]:+.3f} [{m[1]:+.3f}, {m[2]:+.3f}] | "
                         f"{v['util'][0]:.3f} | {100 * v['prop'][0]:.1f}% | {100 * v['pareto_rate']:.1f}% | {v['rounds_median']:g} |")
    lines += ["", "## Manipulation (pooled over n; gain is the liar's true-utility change)", "",
              "| attacker | mechanism | mean gain [95% CI] | median | share gaining | harm to honest | price of strategic behaviour |",
              "|---|---|---|---|---|---|---|"]
    for cond, mm in res["attacks"].items():
        for mech, v in mm.items():
            g = v["gain"]
            lines.append(f"| {cond} | {mech} | {g[0]:+.3f} [{g[1]:+.3f}, {g[2]:+.3f}] | {v['gain_median']:+.3f} | "
                         f"{100 * v['gain_positive_rate']:.1f}% | {v['harm'][0]:+.3f} | {v['psb_mean']:.3f} |")
    br = res["best_response"]
    if br:
        lines += ["", f"## Exact best response ({br['instances']['kept']} small instances, median {br['instances']['m_median']:g} slots)", "",
                  "| mechanism | mean gain [95% CI] | 95th pct | max | share gaining |", "|---|---|---|---|---|"]
        for k, v in br.items():
            if isinstance(v, dict) and "mean" in v:
                lines.append(f"| {k} | {v['mean'][0]:.3f} [{v['mean'][1]:.3f}, {v['mean'][2]:.3f}] | {v['p95']:.3f} | {v['max']:.3f} | {100 * v['positive_rate']:.1f}% |")
    c = res["checks"]
    lines += ["", "## Other checks", "",
              f"- Hard-constraint violations across every run: {c['violations']}.",
              f"- Old MultiMeet would have escalated (min raw score < 40) on {100 * c['b3_would_escalate']:.1f}% of honest instances; B3 above takes its top-ranked slot regardless.",
              "- Translation (simulated parser) by rule kind: " + ", ".join(
                  f"{k} {100 * v['match']:.0f}% (n={v['n']})" for k, v in sorted(c["translation_by_kind"].items())) + ".",
              "", "## Charts", ""]
    lines += [f"![{m}]({m})" for m in made]
    if res.get("amendment2"):
        lines += amendment2_md(res["amendment2"], res)
    notes = DOCS / "notes.md"
    if notes.exists():
        lines += ["", notes.read_text().strip()]
    (DOCS / "RESULTS.md").write_text("\n".join(lines) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--llm", action="store_true")
    ap.add_argument("--charts-only", action="store_true", help="redraw charts and RESULTS.md from results.json")
    args = ap.parse_args()
    os.environ.setdefault("MULTIMEET_AGENTS", "simulated")
    os.environ.setdefault("MEETMIND_AGENTS", "simulated")  # the name before the rename
    if args.charts_only:
        res = json.loads((DOCS / "results.json").read_text())
        res["honest"] = {int(k): v for k, v in res["honest"].items()}
        res["instances"] = {int(k): v for k, v in res["instances"].items()}
        res["paired"] = {int(k): v for k, v in res["paired"].items()}
        for v in res.get("amendment2", {}).get("variants", {}).values():
            for key in ("ratio_by_n", "min_by_n", "pareto_by_n"):
                v[key] = {int(k): x for k, x in v[key].items()}
        made = charts(res)
        write_results_md(res, res["thresholds"], made, res["elapsed_s"], res["llm"])
        print("charts and RESULTS.md redrawn")
        return
    per, small_per = (12, 6) if args.quick else (PER_N, SMALL_PER_N)
    OUT.mkdir(exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    jobs = [(n, i) for n in NS for i in range(per)]
    small_jobs = [(n, i) for n in (3, 4) for i in range(small_per)]
    with ProcessPoolExecutor(args.workers) as pool:
        rows = list(pool.map(evaluate, jobs, chunksize=4))
        small = list(pool.map(evaluate_small, small_jobs, chunksize=2))
    with open(OUT / "rows.jsonl", "w") as f:
        for r in rows + small:
            f.write(json.dumps(r) + "\n")
    res = summarise(rows, small)
    llm_status = "not run (no --llm)"
    if args.llm:
        from eval.llm import run_llm

        llm_status = run_llm(res)
    res["thresholds"] = thresholds(res)
    res["llm"] = llm_status
    elapsed = time.time() - t0
    res["elapsed_s"] = round(elapsed, 1)
    if args.quick:
        print(json.dumps(res["thresholds"], indent=1, default=str))
        return
    (DOCS / "results.json").write_text(json.dumps(res, indent=1, default=str))
    made = charts(res)
    write_results_md(res, res["thresholds"], made, elapsed, llm_status)
    print(f"done in {elapsed / 60:.1f} min")


if __name__ == "__main__":
    main()
