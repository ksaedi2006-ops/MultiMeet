# Evaluation preregistration: MeetMind negotiation layer

Committed before any evaluation was run. The thresholds come from
`docs/research/negotiation-layer.md`, section "What counts as convincing". Where that
section was ambiguous, the exact test is fixed here. Results will be reported against
these thresholds, including misses. Nothing below will be changed after seeing results.
Any later change will be a new, dated section that says what changed and why.

## What runs and what does not

`MEETMIND_AGENTS=simulated`. There is no valid Anthropic API key, so everything that
needs a language model is built behind `--llm` and skipped without a key:

- B2 (single-LLM prompt) and B6 (free LLM negotiation, SAOP) baselines;
- the emotional-persuader and prompt-injector attackers;
- LLM rule translation and LLM explanation faithfulness.

**Declared now:** the quality claim "Ours beats B2" and the safety comparison "nonzero
violations for B2" cannot be tested in this run. They are reported as not run, not as
passed.

## Instances

- **Generator:** `backend/eval/instances.py`. It reuses `app/sample.py` people:
  - courses, labs, jobs, gym, clubs and lunch;
  - their stated rules, including the graded `time_of_day` and `day_weights` rules.
- **Groups and density:** n ∈ {3, 5, 8}, 510 instances per n, base seed 20261116.
  Instance i uses calendar density [0.3, 0.5, 0.7][i mod 3]. Density is the share of a
  person's candidate slots that overlap any of their calendar items.
  - DiMES-style random busy blocks (30–120 minutes; 40% hard) are added, or the person's
    own items dropped, until each person is within 0.1 of the target.
- **Time zones:** one third of instances (i mod 9 in {0, 4, 8}) spread participants over
  2–3 US time zones. Their calendars and rules apply in their own zone.
- **Slots:** 1–5 working days, 30-minute meetings, 08:00–18:00 in the meeting's zone,
  produced by the production `generate_slots`.
- **Feasibility:** an instance needs at least 2 hard-feasible slots after the
  production filter. Otherwise it is redrawn, up to 40 times. Redraws and drops are
  reported.

## Ground truth and the honest agent

Hidden per person:

- a true weight w*_r ~ U(0.3, 1.0) for each soft rule and each movable commitment;
- a disagreement point d* ~ U(0, 0.3).

True utility is the production utility model (`app/scheduling/utility.py`) at the true
weights, range-normalized over the true feasible set to [0, 1]. All metrics use it.

The honest agent reports:

- the true rules and commitments;
- weights overstated by a random factor, w = min(1, w*·(1 + U(0, 0.6)));
- a declared flexibility floor of w*·U(0, 1).

When asked to flex a rule whose stated weight exceeds the true one, it concedes to
max(floor, w*). Otherwise it holds, or accepts if the rule does not touch the target.

This overstatement is an assumption: people state preferences more firmly than they
hold them. It is the reason a mediator can add value at all. It applies identically to
every mechanism.

## Mechanisms

All mechanisms run on the same instances, the same hard-feasible set and the same
reports.

| ID | What it is |
|---|---|
| B0 | Random feasible slot (seeded) |
| B1 | When2Meet: approval voting. An agent approves the slots with no movable commitment on them; ties go to the earliest slot. |
| B3 | Current MeetMind: max-min over raw 0–100 scores (`fairness.rank_slots`), with the old mediator loop. See note 1. |
| B4 | Utilitarian sum over range-normalized utilities |
| B5 | Borda over ranks (ties averaged) |
| Ours | Nash product, eps = 0.05, leximin ties, Borda normalization, d = 0 on the common scale, with the mediated protocol (≤ 3 rounds) |
| Ours-d | As Ours, but with an elicited d. See note 2. |
| Oracle | Nash optimum (eps = 0.05, leximin) on the true utilities and the true d |

1. **B3 scores and loop.** Raw scores are each agent's range-normalized stated utility
   mapped onto a personal scale [lo, hi], with lo ~ U(0, 40) and hi ~ U(70, 100). This
   is the scale heterogeneity the report attributes to raw LLM scores. The mediator loop
   is the old one: up to 2 agents scoring below 70 on each of the top 3, then top 2
   slots. They concede on their costliest rule at that slot, using the honest model above.
2. **Ours-d.** The agent reports the share q of feasible slots worse than no meeting.
   The solver maps that quantile through the normalization and requires individual
   rationality.

Ablations of Ours:

- no normalization (raw utilities);
- no mediator (one-shot solver);
- Nash swapped for leximin max-min, keeping everything else.

The report's fourth ablation, hard-token budgets, is not run, because the mechanism
does not implement hard tokens.

## Attackers

Agent 0 deviates. The colluding pair is agents 0 and 1. Each attacker is run against
honest others, under every mechanism above except B0 and the Oracle.

1. **Inflater:** maximum on its true favourite feasible slot, minimum everywhere else.
   - For rule-based mechanisms: a utility report of 1 at the favourite and 0 elsewhere.
   - For B3: scores 100 / 0.
   - For B1: approve only the favourite.
   - This is a utility-space report, a superset of what the rule vocabulary can express,
     so measured gains bound rule-space gains from above.
2. **Victim:** favourite at 1, every other slot just above a claimed d of 0.9. It also
   reports d = 0.9 where d is elicited (Ours-d). For B3: 100 at the favourite, 5
   elsewhere. For B1: the same as the inflater.
3. **Fake hard constraint:** declares every slot whose true utility is below 0.5 as
   hard. Those slots leave the feasible set for every mechanism; otherwise it reports
   honestly.
4. **Stubborn (Boulware):** honest report, never concedes in any mediator loop.
5. **Colluding pair:** agents 0 and 1 both inflate toward their joint favourite,
   argmax(u0 + u1).
6. **Exact best response:**
   - A separate set of 300 small instances (n ∈ {3, 4}, 150 each, ≤ 8 feasible slots).
   - The report suggested up to 12 slots, but the weak orders of 12 slots number about
     2.8·10^10, so exhaustive enumeration is not feasible. 8 slots gives 545,835.
   - For one-shot mechanisms, agent 0's true-utility-maximizing report is computed
     exactly:
     - Ours-oneshot and B5: by enumerating every weak order of the slots;
     - B3-oneshot, B4 and B1: by the monotonicity argument that the report "everything
       on target t" is optimal for making t win, checked for each t.
   - For Ours with the mediator, the one-shot best report is played through the protocol
     with the attacker never conceding. This is labelled "approximate", not "exact".

LLM attackers 7 (persuader) and 8 (injector) are behind `--llm`. Without it, the only
evidence is structural: a unit test shows that free text cannot change the solver's
inputs.

## Metrics

All metrics are computed on ground truth, never on reports. g_i(s) = u_i(s) − d*_i.
"No meeting" leaves everyone at g = 0.

- **Nash welfare:** NW(s) = Σ_i log(0.05 + max(0, g_i(s))). The eps floor makes NW
  defined at zero gain; the Oracle maximizes the same quantity.
- **Ratio to oracle:** exp((NW(s) − NW(oracle)) / n), the ratio of geometric-mean
  welfare.
- **Utilitarian welfare:** the mean of u_i(s). Each max_t u_i(t) is 1 after range
  normalization.
- **Min utility:** min_i g_i(s).
- **Proportionality rate:** the share of agents with u_i(s) ≥ 1/n.
- **Pareto-optimality rate:** the share of instances where no truly feasible slot
  Pareto-dominates the pick on true u.
- **Distance to oracle:** NW(oracle) − NW(s).
- **Manipulation gain:** the deviator's true u at the outcome under the attack, minus
  the same mechanism with everyone honest. For the pair, the sum over both members.
- **Harm to honest agents:** the change in the mean true u of the non-deviators.
- **Empirical price of strategic behaviour:** GM(honest) / GM(attack), where
  GM = exp(NW / n).
- **Hard-constraint violations:** picks outside the true hard-feasible set.
- **Cost:** rounds and wall-clock runtime per instance.
- **Faithfulness:** the share of explanations that name the solver's decisive person.
  Here it is measured on the simulated explainer only, which renders from the solver's
  reason, so it is high by construction. Declared now as not evidence about an LLM.
- **Translation check:** people's sample phrases are parsed by the offline simulated
  parser and compared with their true rules. The rule counts as matched if its kind
  matches, and for timed kinds the time matches too. Reported as a rate. This tests the
  regex parser, not an LLM.

**Statistics:** 95% paired-bootstrap confidence intervals with 2000 resamples (seed 7)
over instances, separately for each n.

## Thresholds

Each is assessed separately for each n unless stated otherwise.

| # | Claim | Test |
|---|---|---|
| Q1 | Quality vs oracle | Ours (honest) mean ratio to oracle ≥ 0.95 at each n. |
| Q2 | Beats B1 and B3 | For both NW and min utility, the paired-bootstrap 95% CI of the mean difference (Ours − Bx) lies entirely above 0 at each n. The report's literal criterion, non-overlapping marginal CIs, is also reported. B2 is not run. |
| E1 | Efficiency | Ours Pareto-optimality rate ≥ 98% at each n. |
| R1 | Robustness | For each of attackers 1–3, pooled across n, Ours' median manipulation gain ≤ 0.5 × B3's median. If B3's median is 0, the comparison falls back to means, with the same factor. |
| R2 | Bounded best response | Exact best-response gain under Ours-oneshot: mean, 95th percentile and max are reported. "Bounded" means its mean is below B3-oneshot's, with a paired-bootstrap CI of the difference entirely below 0. |
| R3 | Injection and persuasion | Not run without an LLM. Only the structural unit test is cited. |
| S1 | Safety | 0 hard-constraint violations across every run of every mechanism and attacker. The B2 comparison is not run. |
| C1 | Cost | Ours (honest) median rounds ≤ 2. Token cost is not applicable for simulated agents. Runtime is reported. |
| F1 | Faithfulness | ≥ 95% of explanations name the decisive person. Simulated explainer only; see Metrics. |
| T1 | Translation | Reported, with no threshold. |

Ablations and Ours-d are reported descriptively, with no thresholds.
