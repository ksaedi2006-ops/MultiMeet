## Reading the results honestly

Written after the run. Everything above is generated; this section interprets it. Where
something here was not preregistered, it says so.

**Scorecard.** Of the preregistered checks, these passed: Q1, E1, R1 for inflater and
victim, R2, S1, C1 and F1. These missed: Q2 against B3 (5 of 6 comparisons) and R1 for
the fake hard constraint. These were not run: R3, B2 and B6 (no API key). T1 is
reported.

1. **Quality.** Ours reaches 0.978, 0.953 and 0.954 of the oracle's welfare at n = 3,
   5 and 8 (Q1 passes).
   - At n = 5 and n = 8 the margin is thin: the 95% CIs reach down to 0.945.
   - Ours clearly beats When2Meet-style approval (B1) on every measure at every n.
2. **Ours does not beat the old max-min rule (B3) with honest agents (Q2: 5 of 6
   comparisons missed).**

   | n | Nash welfare | Min utility |
   |---|---|---|
   | 3 | slightly worse | worse |
   | 5 | tied | worse |
   | 8 | clearly better | worse |

   The min-utility deficits are 0.02–0.04 at every n. The new rule's case therefore
   rests on robustness, not on quality with honest agents.
3. **The plain utilitarian sum over range-normalized reports (B4) had the best welfare
   with honest agents.** It scored 0.993, 0.981 and 0.986 of the oracle, above Ours at
   every n.
   - Our reading: the ground truth is cardinal, and B4 sees nearly cardinal honest
     reports. Ours deliberately throws away intensity (Borda) so that liars can't shout.
   - That costs roughly 1.5 to 3 points of welfare when nobody lies: the distortion
     cost of rank-based elicitation (Boutilier et al. 2015)<!-- verify: Boutilier et al. 2015 is marked ○ (cited from memory) in docs/research/negotiation-layer.md; check the DOI and pages -->.
   - Not preregistered, and not run: whether Nash over range normalization keeps B4's
     honest quality while staying robust. The no-normalization ablation suggests
     robustness would suffer.
4. **Lying about intensity backfires under Ours (R1 passes for inflater and victim).**

   | Attacker | Liar's mean gain under Ours (share gaining) | Under B3 (share gaining) |
   |---|---|---|
   | Inflater | −0.138 (5%) | +0.161 (46%) |
   | Victim | −0.138 (5%) | +0.122 (41%) |
   | Colluding pair | −0.095 | B3 +0.234, B1 +0.288 |

   Honest people are not harmed under Ours; they are under B3 (−0.22 for the inflater).
   Normalization is what does this: without it (Ours-nonorm) the inflater breaks even,
   and the colluding pair gains +0.149.
5. **Faking a hard constraint still pays, about equally under every mechanism (R1
   misses).**
   - Ours +0.099 against B3 +0.109; every mechanism falls between +0.05 and +0.14.
   - The research report predicted this as the most dangerous lie. It recommends
     budgeted "hard tokens" for declared hard rules, which are not implemented. This is
     the most important open item.
6. **The mechanism is not strategy-proof, as Gibbard–Satterthwaite says it can't be.**
   - The exact best response under the one-shot Nash rule gains 0.085 on average,
     against 0.149 under max-min (R2 passes; Δ −0.064 [−0.093, −0.034]).
   - The worst case is not small: 27% of deviators have some profitable lie, the 95th
     percentile gain is 0.68, and the maximum is 1.0.
   - Utilitarian (0.075) and approval (0.089) are similar on average.
   - The supportable claim is "less manipulable than the old rule", not "hard to
     manipulate".
7. **The mediator adds no measurable welfare under this honest-agent model.**
   - Ours with the mediator scores 0.978, 0.953 and 0.954; the one-shot solver alone
     scores 0.981, 0.956 and 0.957. The CIs overlap.
   - Under rank normalization, conceding toward one's true weights rarely changes the
     Nash-optimal slot.
   - Here, the mediator's value is the visible, explained process, not a better pick.
     We say so rather than claim otherwise.
8. **Eliciting a disagreement point and requiring individual rationality (Ours-d) hurts
   at n = 8 (0.688).**
   - It declares "no slot is individually rational" too often.
   - The product keeps d = 0 on the common scale, as the report's option 3 allows, and
     says so in code.
9. **Other checks.**
   - Every pick was Pareto-optimal on ground truth in 99 to 100% of instances (E1).
   - The negotiation needed a median of 0, 1 and 2 rounds and 7 to 20 ms (C1).
   - Hard-constraint violations were 0 for every mechanism (S1). That holds by
     construction: every mechanism picks from the code-filtered set, and B2, the LLM
     baseline that might violate it, was not run.
10. **Faithfulness (F1) is 100% by construction.** The simulated explainer renders from
    the solver's reason. It says nothing about an LLM explainer.
11. **Translation (T1).**
    - The offline parser recovered the kind and value of 94.9% of rules, but only 67%
      of day-of-week dislikes.
    - Only 82.7% also got hard versus soft right. The sample phrases are often the same
      words for a hard rule and a soft one ("I'd rather be done by 5pm"), so
      firmness is not recoverable from the text.
    - An agent that hears a soft rule as hard has, in effect, made the fake hard
      constraint in item 5 by accident. The confirmation step in the report (the user
      approves the rules) matters.
12. **Not run, because there is no valid API key:** B2 (single LLM), B6 (free LLM
    negotiation), the persuader and injector attackers, and LLM translation. The code is
    in `backend/eval/llm.py` behind `--llm`.
    - The only evidence on injection is structural: a unit test shows that free text
      cannot reach the solver.
13. **The old product would have escalated** (no meeting) on 22.7% of honest instances.
    B3 above was credited with its top-ranked slot anyway, which favours the baseline.
14. **Instances.** Median feasible-set sizes were 24, 16 and 10 at n = 3, 5 and 8, after
    the preregistered Amendment 1 (calendars held at 40% hard). No instances were
    dropped.

## Reading Amendment 2

Written after the run. The decision rule was fixed beforehand and is applied as written.

1. **The default stays Ours (Nash over Borda).** No variant met all three conditions of the preregistered rule.
2. **Capping intensity instead of discarding it buys honest quality and costs robustness.**
   - **Quality.** Nash over an L2 budget or over range normalization reached 0.988 of the oracle, pooled, against 0.961 for Ours. That is above the old max-min rule at every n. It also roughly matched max-min on the worst-off person (+0.612, +0.358 and +0.090, against B3's +0.616, +0.367 and +0.087).
   - **Robustness.** Lying starts to pay again: +0.015 for a single inflater and +0.126 for a colluding pair, where Ours gives −0.138 and −0.095. This is the trade the research report describes. Ranks remove intensity claims entirely (Boutilier et al. 2015)<!-- verify: ○ in the research report -->. A budget only bounds them, and coordinated lying is exactly what an L2 budget "does not stop" in the report's normalization table.
3. **A τ = 0.2 preference floor on Borda helps the worst-off a little at n = 8** (+0.071 vs +0.064). It costs welfare there (0.939 < 0.95), so it fails condition (c).
4. **A 2-token budget does not bound the fake-hard-constraint attack, so it is not adopted.**
   - Under Ours the budgeted attacker gained +0.116, against +0.099 for the original scripted attacker. The paired difference was +0.017 [+0.009, +0.024].
   - The comparison is not like for like. The original attacker blindly strikes every slot it dislikes, while the budgeted one searches for its two most useful rules. Two well-chosen rules, such as "nothing before 2 PM" or "avoid Friday", already remove much of the week.
   - The lesson is that counting declared rules is too coarse. A mitigation would have to price a rule by how much of the feasible set it removes, or require calendar evidence for hard blocks. Neither is tested here.
5. **Q2 against B3 is unchanged for the default** (it is still Ours): 5 of 6 comparisons are missed.
6. **What this suggests trying next.** This is not tested, and would need a new amendment. The L2 variants lose robustness mainly to collusion, which the single-liar results barely show. A rank-based floor (Borda) combined with L2 intensity *within* each person's top ranks might keep most of the honest gain, but that is a hypothesis, not a result.
