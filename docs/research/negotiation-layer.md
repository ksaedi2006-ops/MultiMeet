MeetMind: Theory, Design and Evaluation for the Negotiation Layer
Nov 16, 2026 · @Kian
Bottom line: keep the hard-constraint filter. Replace raw 0–100 scores plus max-min with this: utilities derived from rules the user confirms, normalized per agent. Then pick the slot that maximizes the Nash product, with leximin as the tie-break. The mediator LLM runs a monotonic-concession, single-text protocol around a solver it cannot override. Evaluate against ground-truth simulated utilities, with scripted and LLM-driven liars. Never claim strategy-proofness; measure manipulation gain instead.
How to read the bibliography. Every entry gives its citation and link, then a summary, the mechanism, how it applies to MeetMind, and weaknesses. Tags: [Seminal] or [Recent] (2020–2026).
• ✓ = I checked the title, authors and venue against the publisher, arXiv, DBLP or the author's page in this session.
• ○ = a standard reference cited from memory. I'm confident it exists, but check the DOI and page numbers before you put it in a README.
• Anything I'm unsure of is flagged inline. I invented nothing. Where I couldn't confirm a detail, I say so.
1. Bargaining solutions for more than two parties
For n ≥ 3 with discrete slots, the Nash product (maximum Nash welfare) is the strongest default. It is scale-invariant and Pareto-optimal, and it has strong fairness results in discrete settings. Kalai–Smorodinsky does not extend cleanly beyond two players. Max-min (egalitarian) is the most fragile to misreporting, because it rewards whoever claims to be worst off.
The four objectives over the feasible slot set S, with disagreement point d ("no meeting"):
\text{Nash: } \arg\max_{s\in S}\prod_i (u_i(s)-d_i) \quad \text{Utilitarian: } \arg\max_s \sum_i u_i(s) \quad \text{Egalitarian: } \arg\max_s \min_i (u_i(s)-d_i) \quad \text{KS: } u(s)-d \propto a-d,\; a_i=\max_{s} u_i(s)
Solution
Key axioms it satisfies
Invariant to rescaling one agent's scores?
Main risk in MeetMind
Nash product
Pareto, symmetry, scale invariance, IIA
Yes (positive affine, relative to d)
Needs a sensible d; zero utility vetoes a slot
Kalai–Smorodinsky
Pareto (2-player), individual monotonicity
Yes
Not Pareto-optimal on all n-person games (Roth 1979)
Egalitarian / leximin
Monotonicity, Pareto (leximin)
No: needs comparable units
Rewards underreporting; one pessimist dominates
Utilitarian
Pareto, anonymity
No
Ignores minorities; rewards inflation
Choosing d ("no meeting"). Three defensible options:
1.  d_i = the agent's elicited utility of skipping or postponing the meeting. This is the most principled. A slot worse than d_i for anyone is individually irrational.
2.  d_i = the utility of the agent's worst feasible slot (min-normalization). It is simple and always defined, but makes the outcome depend on which slots survive the filter.
3.  d_i = 0 on a common normalized scale. This is fine for a hackathon, but say that it is an assumption.
With option 1 you can also report "no slot is individually rational" as a valid outcome. That is better than forcing a meeting.
[Seminal] ○ Nash, J. F. (1950). The Bargaining Problem. Econometrica 18(2):155–162. doi:10.2307/1907266
• Summary: Defines the bargaining problem as a feasible utility set plus a disagreement point. Shows that four axioms single out one solution: Pareto optimality, symmetry, invariance to affine rescaling, and independence of irrelevant alternatives.
• Mechanism: maximize ∏(u_i − d_i) over the feasible set. The n-player extension follows directly.
• MeetMind: the core selection rule. Scale invariance means an agent that rescales its scores linearly (for example 0–100 vs 0–10) cannot shift the outcome. Max-min does not have this property.
• Weaknesses: assumes a convex feasible set. A finite slot set is not convex, so the axiomatic uniqueness does not carry over, though the rule is still well-defined. IIA is contested. It is sensitive to the choice of d, and non-affine misreports still manipulate it.
[Seminal] ○ Kalai, E. & Smorodinsky, M. (1975). Other Solutions to Nash's Bargaining Problem. Econometrica 43(3):513–518. doi:10.2307/1914280
• Summary: Replaces IIA with individual monotonicity. The result is the solution that gives each player the same fraction of their ideal gain.
• Mechanism: the maximal point on the segment from d to the ideal point a, where a_i is the best feasible utility for i.
• MeetMind: an intuitive explanation ("everyone got 70% of the way to their favourite slot"). Use it in mediator explanations, not as the selector.
• Weaknesses: see Roth (1979). On discrete sets the line may hit no slot, so you need an approximation.
[Seminal] ✓ Roth, A. E. (1979). An Impossibility Result Concerning n-Person Bargaining Games. International Journal of Game Theory 8(3):129–132. doi:10.1007/BF01770063
• Summary: Shows that the Raiffa/Kalai–Smorodinsky solution is not Pareto-optimal on the class of all n-person bargaining games. No Pareto-optimal solution can keep its other characterizing properties when n ≥ 3.
• Mechanism: an impossibility result rather than an algorithm.
• MeetMind: the formal reason not to use KS as the selector for groups of three or more.
• Weaknesses: it rules things out rather than prescribing a fix. Later work (lexicographic KS) restores weak forms of efficiency.
[Seminal] ○ Kalai, E. (1977). Proportional Solutions to Bargaining Situations: Interpersonal Utility Comparisons. Econometrica 45(7):1623–1630. doi:10.2307/1913954
• Summary: Axiomatizes the egalitarian (proportional) solution: equal gains over d, the maximal such point. It satisfies monotonicity but needs interpersonal comparability.
• Mechanism: max t such that d + t·w is feasible, with weights w. For equal weights, this is max-min over gains; leximin breaks ties.
• MeetMind: this is the theory behind your current max-min rule. Keep it as a fairness floor or tie-break, not as the main objective.
• Weaknesses: not scale-invariant, so it depends on whose units count. It is the most exposed to strategic underreporting.
[Seminal] ○ Thomson, W. (1994). Cooperative Models of Bargaining. In Handbook of Game Theory with Economic Applications, Vol. 2, Ch. 35, pp. 1237–1284. Elsevier. doi:10.1016/S1574-0005(05)80067-0
• Summary: The standard survey of axiomatic bargaining: Nash, KS, egalitarian and their n-person and variable-population variants, with a map of axioms against solutions.
• Mechanism: a reference for which axiom set pins down which solution.
• MeetMind: cite it once in the README to justify the axioms behind the choice.
• Weaknesses: a survey from 1994, so it predates the computational fair-division work below.
[Recent] ✓ Caragiannis, Kurokawa, Moulin, Procaccia, Shah & Wang (2019). The Unreasonable Fairness of Maximum Nash Welfare. ACM Transactions on Economics and Computation 7(3), Article 12. doi:10.1145/3355902
• Summary: Shows that maximizing the product of utilities over indivisible allocations is envy-free up to one good (EF1) and Pareto-optimal. It also approximates the maximin share well, in theory and in practice. Won the 2024 Kalai Prize.
• Mechanism: maximum Nash welfare (MNW) over a discrete outcome space. When some outcome gives everyone positive utility, maximize that product; otherwise first maximize the number of agents with positive utility.
• MeetMind: the modern, discrete-setting justification for the Nash product. It is also the model to follow if MeetMind later schedules a series of meetings.
• Weaknesses: the results are for private goods; one meeting slot is a single public decision (see the next entry). MNW is not strategy-proof.
[Recent] ✓ Conitzer, V., Freeman, R. & Shah, N. (2017). Fair Public Decision Making. Proc. ACM EC 2017, pp. 629–646. doi:10.1145/3033274.3085125 · arXiv:1611.04034
• Summary: Generalizes fair division to several public decisions made together, where one alternative can please many agents. Introduces proportionality up to one issue (PROP1), round-robin share and pessimistic proportional share. Shows that MNW satisfies or approximates all three.
• Mechanism: MNW over the joint choice across issues.
• MeetMind: the right frame for recurring meetings, where each week is one issue. With MNW over the whole series, the person who loses this week is compensated later. That is a strong portfolio differentiator over one-shot schedulers.
• Weaknesses: offline model, with all issues known in advance. Recurring scheduling is closer to the online variant, which needs follow-up work.
Year check: the EC paper is 2017, slightly before your 2020–2026 window. I've tagged it Recent because the 2019 MNW journal version and the follow-up literature fall inside it.
2. Negotiation protocols for automated agents
A mediated single-text protocol with monotonic concessions fits MeetMind best. Its termination is easy to prove on a finite slot set, and the final selection is Pareto-optimal with respect to reported utilities. Free-form alternating offers among three or more agents has no unique equilibrium without extra structure.
Zeuthen's rule, under which the agent less willing to risk conflict concedes next:
\text{risk}_i = \frac{u_i(x_i) - u_i(x_j)}{u_i(x_i)} \qquad \text{agent with smaller risk concedes}
Here x_i is i's current offer, and utilities are measured relative to conflict at 0.
[Seminal] ○ Rosenschein, J. S. & Zlotkin, G. (1994). Rules of Encounter: Designing Conventions for Automated Negotiation among Computers. MIT Press. ISBN 978-0-262-18159-1
• Summary: The founding text on designing protocols for self-interested software agents. Defines the monotonic concession protocol (MCP) and the Zeuthen strategy, and analyses stability, efficiency and incentive properties across task-, state- and worth-oriented domains.
• Mechanism: in MCP, agents propose simultaneously. Each round, every agent either keeps its offer or concedes, meaning it offers something at least as good for the others. Negotiation ends in agreement when one offer is acceptable to all, and in conflict when no one concedes. Zeuthen picks who concedes; the book's extended Zeuthen strategy uses mixed strategies to handle ties.
• MeetMind: gives the mediator's "flex" request a formal meaning: a concession is a move that weakly helps every other agent. Termination is guaranteed on a finite slot set.
• Weaknesses: bilateral at heart. Agents may stall, and plain Zeuthen is not fully stable without the tie-breaking extension. It assumes truthful utility functions.
[Seminal] ○ Harsanyi, J. C. (1956). Approaches to the Bargaining Problem Before and After the Theory of Games: A Critical Discussion of Zeuthen's, Hicks' and Nash's Theories. Econometrica 24(2):144–157. doi:10.2307/1905748
• Summary: Shows that Zeuthen's 1930 concession rule leads to the Nash bargaining solution.
• Mechanism: the risk comparison above. The agent who concedes is the one whose concession raises the Nash product most.
• MeetMind: links the concession protocol to the selector: the negotiation dynamics and the final Nash pick agree.
• Weaknesses: a two-player argument. In multilateral settings the correspondence needs Endriss-style definitions.
[Seminal] ✓ Endriss, U. (2006). Monotonic Concession Protocols for Multilateral Negotiation. Proc. AAMAS 2006, pp. 392–399. ACM. doi:10.1145/1160633.1160702 · preprint
• Summary: Bilateral MCP is a textbook object, but with three or more agents it is unclear what a concession is. Endriss proposes several definitions of multilateral concession, from conceding to every other agent to conceding to at least one, plus welfare-based criteria. He then analyses their formal properties.
• Mechanism: a family of concession criteria that plug into MCP. Check the paper for the exact list and which criteria guarantee which properties; I have not re-read the theorem statements in this session.
• MeetMind: the direct theoretical basis for a three-round mediator. Choose one concession criterion, enforce it in code, and cite Endriss for its properties.
• Weaknesses: abstract deals with no communication content, and truthful agents are assumed.
[Seminal] ○ Rubinstein, A. (1982). Perfect Equilibrium in a Bargaining Model. Econometrica 50(1):97–109. doi:10.2307/1912531
• Summary: In two-player alternating offers with discounting, there is a unique subgame-perfect equilibrium with immediate agreement.
• Mechanism: the first proposer gets (1−δ₂)/(1−δ₁δ₂) of the pie, where δ_i is player i's discount factor.
• MeetMind: formal backing for a hard round cap. Patience is power, so the cap matters for fairness, not just latency.
• Weaknesses: with three or more players and unanimity, uniqueness fails. The Shaked example, reported in Osborne & Rubinstein (1990), Bargaining and Markets, shows that any split can be an equilibrium when players are patient.
[Seminal] ○ Binmore, K., Rubinstein, A. & Wolinsky, A. (1986). The Nash Bargaining Solution in Economic Modelling. RAND Journal of Economics 17(2):176–188. doi:10.2307/2555382
• Summary: As the time between offers shrinks, Rubinstein outcomes converge to the Nash solution. The disagreement point should be the outside option or the breakdown payoff, chosen to fit the setting.
• Mechanism: a non-cooperative foundation for the Nash solution.
• MeetMind: the citation for "we use the Nash product because it is what patient negotiators would reach." It also helps justify what "no meeting" utility means.
• Weaknesses: two players.
[Seminal] ○ Krishna, V. & Serrano, R. (1996). Multilateral Bargaining. Review of Economic Studies 63(1):61–80. doi:10.2307/2298115
• Summary: Restores a unique equilibrium in n-player alternating offers by letting players accept their share and exit. The limit is again the Nash solution.
• Mechanism: partial agreements and exit.
• MeetMind: an analogue for "lock in agents who already accept, and negotiate with the rest."
• Weaknesses: divisible surplus. Meeting slots are not divisible.
[Recent] ✓ Aydoğan, R., Festen, D., Hindriks, K. V. & Jonker, C. M. (2017). Alternating Offers Protocols for Multilateral Negotiation. In Modern Approaches to Agent-based Complex Automated Negotiation, Springer SCI 674, pp. 153–167. doi:10.1007/978-3-319-51563-2_10
• Summary: A general framework for multilateral turn-taking. Specifies the Stacked Alternating Offers Protocol (SAOP), in which each agent bids, accepts the latest bid or walks away. Also specifies the Alternating Multiple Offers Protocol (AMOP), with separate bidding and voting phases. SAOP was the ANAC 2015 protocol.
• Mechanism: SAOP's turn order and accept, bid or walk-away moves.
• MeetMind: the standard unmediated multilateral baseline. Implement it as "LLM agents negotiate directly" and compare it with your mediated design.
• Weaknesses: heuristic, with no equilibrium guarantees. Outcomes depend on turn order and deadlines. Pages 153–167 are from memory; the DOI is verified.
[Seminal] ✓ Klein, M., Faratin, P., Sayama, H. & Bar-Yam, Y. (2003). Negotiating Complex Contracts. Group Decision and Negotiation 12(2):111–125. doi:10.1023/A:1023068821218
• Summary: A mediator proposes one contract at a time. Agents vote on whether it beats the previous one, and the mediator searches by simulated annealing. Reaches near-optimal social welfare without agents revealing their utility functions.
• Mechanism: single-text mediation with accept or reject votes. Agents must anneal too, accepting some worse proposals early, or the search stalls at local optima.
• MeetMind: a computational version of single-text mediation, close to what your mediator already does. Agents only say accept or reject, which leaks little private information.
• Weaknesses: truthful voting is assumed, and strategic voters can stall it. Many rounds are needed, more than three.
[Seminal] ○ Raiffa, H. (1982). The Art and Science of Negotiation. Harvard University Press.
• Summary: The classic treatment of many-party negotiation and analytic mediation. Describes the single negotiating text, in which one mediator-held draft is criticized and revised, and its use at Camp David (1978).
• Mechanism: single-text procedure. Parties never make offers, only critiques of the draft, which removes positional commitment.
• MeetMind: exactly the role your mediator LLM should play. It holds the draft, collects critiques and revises.
• Weaknesses: descriptive and prescriptive rather than formal, with no guarantees.
Guarantees in your setting. With S finite, a mediator that only moves to a new draft when its concession criterion holds must terminate within |S| rounds. A hard 3-round cap makes that trivial. Pareto-optimality comes from the final step, not the dialogue: if the last pick maximizes the Nash product over reported utilities, the pick is Pareto-optimal for those reports. Any guarantee about true utilities depends on elicitation (Topic 3).
3. Truthful preference elicitation and mechanism design without money
Full strategy-proofness is impossible for a deterministic, non-dictatorial rule over three or more slots. What you can achieve:
• strategy-proofness on restricted domains, such as single-peaked time-of-day preferences;
• normalization, which removes scale manipulation, though not shape manipulation;
• budgets, which bound how much intensity an agent can claim;
• grounding scores in calendar evidence, which shrinks the space of possible lies;
• empirical measurement of how much a liar actually gains.
[Seminal] ○ Gibbard, A. (1973). Manipulation of Voting Schemes: A General Result. Econometrica 41(4):587–601. doi:10.2307/1914083 — and Satterthwaite, M. A. (1975). Strategy-Proofness and Arrow's Conditions. Journal of Economic Theory 10(2):187–217. doi:10.1016/0022-0531(75)90050-2
• Summary: Any deterministic social choice function that is onto at least three outcomes and strategy-proof over all preference orderings must be dictatorial.
• Mechanism: an impossibility theorem.
• MeetMind: you cannot make the slot pick truthful by design alone, so you need the escape routes below. Say this up front in the README; reviewers will respect it.
• Weaknesses: it applies to ordinal, deterministic rules on an unrestricted domain. Randomization (Gibbard 1977, random dictatorship) and domain restrictions escape it.
[Seminal] ○ Moulin, H. (1980). On Strategy-Proofness and Single Peakedness. Public Choice 35(4):437–455. doi:10.1007/BF00128122
• Summary: When preferences are single-peaked on a line, the strategy-proof, anonymous and efficient rules are the generalized median-voter rules.
• Mechanism: pick the median of the reported peaks plus n−1 fixed "phantom" peaks.
• MeetMind: time of day is a line, and many soft preferences ("ideally around 2pm") are single-peaked. For that dimension you can be provably truthful: ask each agent for its ideal time and pick the median among feasible slots.
• Weaknesses: only one dimension. Hard constraints break the line into intervals, so truthfulness needs care on a constrained domain. Day-of-week preferences are rarely single-peaked.
[Recent] ✓ Lalley, S. P. & Weyl, E. G. (2018). Quadratic Voting: How Mechanism Design Can Radicalize Democracy. AEA Papers and Proceedings 108:33–37. doi:10.1257/pandp.20181002
• Summary: Voters buy votes with voice credits, and v votes cost v² credits. Only quadratic cost makes marginal cost linear in votes, which aligns votes with intensity and gives welfare optimality under the paper's assumptions.
• Mechanism: cost(v) = v² from a credit budget. The full equilibrium analysis is in Lalley & Weyl, Nash Equilibria for Quadratic Voting (arXiv:1409.0264, ○).
• MeetMind: give each agent a weekly budget of credits. Spending v on a slot costs v², so an agent can't put 100 on everything. Credits carry over across meetings, which ties in with recurring-meeting fairness.
• Weaknesses: the optimality result assumes quasi-linear utility, many issues and a large population. A one-shot, 5-person meeting has none of these. A single-meeting budget is really just normalization by an L2 norm. Collusion and sybils break QV. This entry is 2018, just before your window; it is the canonical peer-reviewed source.
[Seminal] ✓ Ephrati, E., Zlotkin, G. & Rosenschein, J. S. (1994). Meet Your Destiny: A Non-Manipulable Meeting Scheduler. Proc. ACM CSCW 1994, pp. 359–371. DBLP · workshop version
• Summary: Presents meeting-scheduling mechanisms that are manipulation-proof for closed systems such as an organization. Builds on the Clarke tax, in which agents pay according to the externality they impose, with internal currency standing in for money.
• Mechanism: Clarke (VCG pivot) payments in organization-internal points. Truth-telling is a dominant strategy.
• MeetMind: the closest prior work to MeetMind's elicitation problem, and it comes from the same authors as MCP. A points-based Clarke tax is the principled way to stop score inflation. Each agent pays points equal to the harm its report causes others, and next week's budget shrinks accordingly.
• Weaknesses: the tax is "burned", so the mechanism is not budget-balanced. It needs quasi-linear utility over points, and points must be scarce and valued. Collusion is possible. The CSCW DOI was not confirmed; use the DBLP link.
[Seminal] ✓ Ephrati, E. & Rosenschein, J. S. (1991). The Clarke Tax as a Consensus Mechanism Among Automated Agents. Proc. AAAI 1991, pp. 173–178. mlanthology
• Summary: Applies the Clarke tax to automated agents as a preference revealer, replacing explicit negotiation. Discusses the practical difficulties.
• Mechanism: pivot payments: t_i = Σ_{j≠i} u_j(s₋ᵢ*) − Σ_{j≠i} u_j(s*), where s₋ᵢ* is the slot chosen without agent i.
• MeetMind: the formula to implement if you adopt a points-based tax.
• Weaknesses: as above. It maximizes utilitarian welfare, not the Nash product. Applying a Clarke-style tax to an MNW selector does not make MNW truthful, so do not claim that it does.
[Recent] ○ Procaccia, A. D. & Tennenholtz, M. (2013). Approximate Mechanism Design without Money. ACM Transactions on Economics and Computation 1(4), Article 18. doi:10.1145/2542174.2542175
• Summary: Proposes giving up some optimality in exchange for strategy-proofness without payments, and proves approximation ratios. The running example is facility location on a line.
• Mechanism: strategy-proof rules, such as the median, with a provable worst-case ratio to optimal welfare.
• MeetMind: a meeting time on a single day is a facility on a line. You can report "strategy-proof, within factor X of optimal on the time-of-day dimension" as a theory-backed claim.
• Weaknesses: worst-case bounds, and one-dimensional. 2013 is before your window; it's here because it is the canonical framing.
[Recent] ○ Boutilier, C., Caragiannis, I., Haber, S., Lu, T., Procaccia, A. D. & Sheffet, O. (2015). Optimal Social Choice Functions: A Utilitarian View. Artificial Intelligence 227:190–213. doi:10.1016/j.artint.2015.06.003
• Summary: Studies distortion: how much welfare is lost when only rankings are elicited, under unit-sum normalized utilities. Gives optimal randomized rules.
• Mechanism: unit-sum normalization (Σ_s u_i(s) = 1) plus a distortion bound.
• MeetMind: the theory for "ask for rankings, not scores". Rankings are harder to inflate, and distortion quantifies what you lose.
• Weaknesses: worst-case. Rankings are still manipulable (Gibbard–Satterthwaite).
Normalization: what it buys you.
Scheme
Formula
Stops
Does not stop
Range (min-max)
(u − min)/(max − min) over feasible slots
Uniform inflation (everything 90–100)
Extreme shapes (100 / 0 / 0 / 0)
Unit-sum
u / Σu
Claiming more total intensity
Concentrating all mass on one slot
Borda (ranks)
m − rank
Intensity claims entirely
Burying a rival's favourite (Borda is notoriously manipulable)
L2 budget (QV-style)
Σv² ≤ B
Extreme concentration (cost is convex)
Coordinated lying, misreported shape
Under the Nash product, range normalization changes nothing for affine rescalings, because the Nash product is already invariant to them. It matters for max-min and the utilitarian sum. What is achievable when agents may misreport: bounded manipulation gain, measured empirically; strategy-proofness on restricted dimensions; and dominant-strategy truthfulness only if you add a points currency with Clarke-style payments.
4. Computational social choice applied to scheduling
A single meeting slot is a single-winner public decision, so envy-freeness is trivially satisfied: everyone gets the same slot. The meaningful properties are Pareto efficiency, proportionality-style guarantees (each agent gets a fair share of their best possible utility), and fairness across a series of meetings. Meeting scheduling also has its own DCOP literature, with benchmarks you can reuse.
[Recent] ○ Brandt, F., Conitzer, V., Endriss, U., Lang, J. & Procaccia, A. D. (eds.) (2016). Handbook of Computational Social Choice. Cambridge University Press. doi:10.1017/CBO9781107446984
• Summary: The standard reference, open access. Covers voting rules (Borda, Kemeny, approval), axioms, manipulation complexity, fair division and distortion.
• Mechanism: a reference for rule definitions and their axiomatic properties.
• MeetMind: cite it for the definitions of your baselines (Borda, approval, Kemeny).
• Weaknesses: 2016, so it predates the LLM-era work.
[Seminal] ○ Brams, S. J. & Fishburn, P. C. (1978). Approval Voting. American Political Science Review 72(3):831–847. doi:10.2307/1955105
• Summary: Each voter approves any subset of alternatives, and the most-approved alternative wins. With dichotomous preferences, sincere approval is a dominant strategy.
• Mechanism: argmax_s |{i : s ∈ A_i}|.
• MeetMind: When2Meet is approval voting over slots, where availability equals approval. That makes it your Baseline 1, with a formal name. Within the dichotomous domain ("can make it or not"), it is strategy-proof.
• Weaknesses: discards intensity, and the approval threshold is itself strategic once preferences aren't dichotomous.
[Seminal] ○ Kemeny, J. G. (1959). Mathematics without Numbers. Daedalus 88(4):577–591. — with Young, H. P. & Levenglick, A. (1978). A Consistent Extension of Condorcet's Election Principle. SIAM Journal on Applied Mathematics 35(2):285–300. doi:10.1137/0135023
• Summary: The Kemeny ranking minimizes total pairwise disagreement with voters' rankings. Young & Levenglick characterize it axiomatically as the unique neutral, consistent Condorcet extension.
• Mechanism: argmin over rankings π of Σ_i KendallTau(π, π_i). NP-hard in general (Bartholdi, Tovey & Trick 1989), but trivial for fewer than about 10 slots.
• MeetMind: useful if you output a ranked shortlist ("top 3 slots") instead of a single winner. Also a strong ordinal baseline.
• Weaknesses: ordinal only, manipulable, and overkill for a single winner.
[Seminal] ✓ Maheswaran, R. T., Tambe, M., Bowring, E., Pearce, J. P. & Varakantham, P. (2004). Taking DCOP to the Real World: Efficient Complete Solutions for Distributed Multi-Event Scheduling. Proc. AAMAS 2004, pp. 310–317. doi:10.1109/AAMAS.2004.257
• Summary: Introduces the DiMES framework, which casts multi-meeting scheduling as a DCOP with binary constraints that provably yield the optimal schedule. Gets large speedups through communication structure and precomputed bounds.
• Mechanism: each agent holds variables for its meetings, and constraints encode conflicts plus valuations. Solved with complete DCOP algorithms such as ADOPT and SyncBB.
• MeetMind: the canonical formal model and benchmark source for distributed meeting scheduling. Use DiMES-style generators for your synthetic instances, so reviewers recognise the setup.
• Weaknesses: cooperative agents that maximize a sum, with no strategic behaviour. Valuations are given rather than elicited.
[Seminal] ✓ Maheswaran, R. T., Pearce, J. P., Bowring, E., Varakantham, P. & Tambe, M. (2006). Privacy Loss in Distributed Constraint Reasoning: A Quantitative Framework for Analysis and Its Applications. Autonomous Agents and Multi-Agent Systems 13(1):27–60.
• Summary: Quantifies how much private information (such as calendar contents) agents leak during distributed meeting scheduling, and compares algorithms on privacy against efficiency.
• Mechanism: privacy-loss metrics over what other agents can infer.
• MeetMind: your personal agents see calendars. Add "information revealed to other agents and the mediator" as an evaluation metric. The single-text accept/reject design leaks far less than sharing scores.
• Weaknesses: the metrics are model-dependent. The DOI was not confirmed in this session.
[Seminal] ○ Sen, S. & Durfee, E. H. (1998). A Formal Study of Distributed Meeting Scheduling. Group Decision and Negotiation 7(3):265–289.
• Summary: An analytical and empirical study of announce/bid style protocols for distributed meeting scheduling. Examines how strategies and calendar density affect search cost and success.
• Mechanism: a contract-net style protocol in which a host proposes slots and invitees bid on them.
• MeetMind: a classic baseline for "host proposes, attendees respond", the way people actually schedule.
• Weaknesses: pre-LLM, with simple cooperative agents.
[Recent] ✓ Lawless, C., Schoeffer, J., Le, L., Rowan, K., Sen, S., St. Hill, C., Suh, J. & Sarrafzadeh, B. (2024). "I Want It That Way": Enabling Interactive Decision Support Using Large Language Models and Constraint Programming. ACM Transactions on Interactive Intelligent Systems 14(3), Article 22. doi:10.1145/3685053 · arXiv:2312.06908
• Summary: A Microsoft Research system for meeting scheduling. An LLM turns users' natural-language preferences into constraints and the CP solver computes the schedule. Includes three user studies on iterative preference elicitation.
• Mechanism: an LLM-to-constraint translation layer plus a constraint-programming solver.
• MeetMind: the closest peer-reviewed prior system to MeetMind's agent layer, single-user rather than multi-party. Cite it as the precedent for "the LLM translates, the solver decides". Your contribution is the multi-party, strategic, fairness layer on top.
• Weaknesses: single user, so there is no fairness or strategic aspect. LLM translation errors propagate into the constraints.
[Recent] ○ Zheng, H. S., Mishra, S., Zhang, H., et al. (2024). NATURAL PLAN: Benchmarking LLMs on Natural Language Planning. arXiv:2406.04520
• Summary: A Google DeepMind benchmark that includes Meeting Planning and Calendar Scheduling tasks given as natural-language constraints. Frontier LLMs did poorly when solving them end-to-end.
• Mechanism: a benchmark with exact-match scoring against solver-computed answers.
• MeetMind: evidence that an LLM-only scheduler (your Baseline 2) is unreliable. You can also reuse its Calendar Scheduling instances for the hard-constraint layer.
• Weaknesses: single-decision-maker tasks, with no preferences across agents. Author list and details are from memory; check the arXiv page.
5. LLMs as negotiating agents (2023–2026)
The evidence agrees on four points:
• LLM negotiators are exploitable by emotional appeals, first-offer anchoring and prompt injection.
• They model the other side better than they act on that model.
• They degrade as the number of parties and options grows.
• Pairing them with an explicit game-theoretic solver or workflow measurably helps.
That is the strongest argument for MeetMind's "solver decides, LLM communicates" split.
[Recent] ✓ Abdelnabi, S., Gomaa, A., Sivaprasad, S., Schönherr, L. & Fritz, M. (2024). Cooperation, Competition, and Maliciousness: LLM-Stakeholders Interactive Negotiation. NeurIPS 2024, Datasets & Benchmarks Track. proceedings · arXiv:2309.17234
• Summary: Builds scorable multi-agent, multi-issue negotiation games. Each party has secret point values per option and a minimum acceptable score. Studies cooperative, greedy and adversarial agents and cross-agent attacks.
• Mechanism: scorable games, in which each agent's hidden utility table makes every outcome scorable for everyone. Metrics cover agreement and per-role alignment; agents are given greedy or saboteur incentives.
• MeetMind: the template for your evaluation. Give each simulated participant a hidden utility table, let LLM agents negotiate, then score outcomes against the hidden truth. Their saboteur and greedy roles map directly onto your liar agents.
• Weaknesses: a handful of hand-built games. Two independent reproducibility studies exist (arXiv:2502.16242, arXiv:2602.18230); read them for caveats on how far the results generalize.
[Recent] ✓ Bianchi, F., Chia, P. J., Yuksekgonul, M., Tagliabue, J., Jurafsky, D. & Zou, J. (2024). How Well Can LLMs Negotiate? NegotiationArena Platform and Analysis. ICML 2024, PMLR 235:3935–3951. PMLR · arXiv:2402.05863
• Summary: An open framework with ultimatum, trading and price-negotiation scenarios. Behavioural tactics change payoffs substantially: by pretending to be desolate and desperate, LLMs improved their payoffs by about 20% against standard GPT-4. LLMs also show anchoring and other irrational behaviour.
• Mechanism: a platform plus a behavioural-tactic ablation.
• MeetMind: the evidence for your emotional-manipulator attacker ("I'm overwhelmed, I really need Tuesday"). If your mediator LLM can be swayed this way, the solver must not take free-text pleas as input.
• Weaknesses: two-player, with simple resources.
[Recent] ✓ Fu, Y., Peng, H., Khot, T. & Lapata, M. (2023). Improving Language Model Negotiation with Self-Play and In-Context Learning from AI Feedback. arXiv:2305.10142
• Summary: A buyer and a seller LLM bargain over price, and a third LLM acts as critic and gives one player feedback between rounds. Only some models improve from AI feedback. Stronger agents improve over rounds but are also more likely to break the deal.
• Mechanism: self-play plus in-context critic feedback.
• MeetMind: a caution. Do not let personal agents "learn to negotiate harder" across meetings: higher individual payoff came with more failed deals. It also motivates the critic-in-the-loop pattern for your mediator's explanations.
• Weaknesses: a preprint. I could not confirm a peer-reviewed venue. Two-player price bargaining only.
[Recent] ✓ Davidson, T. R., Veselovsky, V., Kosinski, M. & West, R. (2024). Evaluating Language Model Agency Through Negotiations. ICLR 2024. proceedings · arXiv:2401.04536 · code (LAMEN)
• Summary: Uses structured negotiation games to evaluate LM agency in self-play and cross-play. Cooperative bargaining games were the hardest for models, and the most powerful models do not always win. Measures both performance and faithfulness or alignment.
• Mechanism: a self-play and cross-play protocol, with internal-faithfulness checks that compare a model's notes against its messages.
• MeetMind: borrow the cross-play design: run MeetMind's agents on model A against liars on model B. Borrow the faithfulness check too: does the mediator's explanation match the solver's actual reason?
• Weaknesses: mostly bilateral. The author list differs between arXiv versions; the ICLR version lists four authors.
[Recent] ✓ Vaccaro, M., Caosun, M., Ju, H., Aral, S. & Curhan, J. R. (2025/2026). Advancing AI Negotiations: A Large-Scale Autonomous Negotiation Competition. arXiv:2503.06416; reported as published in PNAS (2026) by MIT Sloan
• Summary: An international competition in which participants wrote prompts for LLM negotiators, producing over 180,000 negotiations. Human negotiation principles still mattered, and warmth predicted better outcomes. AI-specific tactics, including chain-of-thought and prompt injection, were also highly effective.
• Mechanism: a round-robin tournament scoring value claiming, value creation, subjective value and efficiency.
• MeetMind: prompt injection is a real, winning tactic among LLM negotiators. Your mediator must treat agent messages as untrusted data, and the solver's inputs must be structured.
• Weaknesses: I haven't confirmed the PNAS citation details; cite the arXiv version until you do. The scenarios are bilateral.
[Recent] ✓ Bansal, G., et al. (2025). Magentic Marketplace: An Open-Source Environment for Studying Agentic Markets. Microsoft Research & Arizona State University. arXiv:2510.25779
• Summary: Simulates two-sided markets of assistant and service agents. Frontier models approach optimal welfare only under ideal search conditions. All models showed strong first-proposal bias, which gave response speed a 10–30x advantage over quality, and they were vulnerable to manipulation.
• Mechanism: an environment with welfare measured against ground-truth preferences.
• MeetMind: first-proposal bias is why your mediator should show agents a solver-ranked shortlist, not whatever slot was mentioned first. Run an "order shuffle" robustness test.
• Weaknesses: a preprint, in a market setting rather than scheduling. The lead author is listed as I found it; check the full author list.
[Recent] ✓ Hua, W., Liu, O., Li, L., et al. (2024). Game-theoretic LLM: Agent Workflow for Negotiation Games. arXiv:2411.05990
• Summary: LLMs deviate from rational strategies as games grow, as noise is added and as negotiation rounds increase. Game-theoretic workflows that walk the model through equilibrium reasoning improve rationality and reduce exploitability.
• Mechanism: structured reasoning workflows, for example "compute your best response, then check for dominated strategies".
• MeetMind: direct evidence for solver-in-the-loop. It also shows that partial workflow adoption can be exploited, which argues for a single trusted solver over per-agent reasoning.
• Weaknesses: a preprint, run on small classic games.
[Recent] ✓ Gemp, I., Bachrach, Y., Lanctot, M., Patel, R., Dasagi, V., Marris, L., Piliouras, G., Liu, S. & Tuyls, K. (2024). States as Strings as Strategies: Steering Language Models with Game-Theoretic Solvers. arXiv:2402.01704
• Summary: Google DeepMind casts dialogue as a game, where states are conversation histories and strategies are prompts. Equilibrium solvers (CFR, PSRO) then choose LLM strategies. The test domains reportedly include meeting scheduling and fruit trading.
• Mechanism: a "binding" from dialogue to an extensive-form game, solved with game-theoretic algorithms and then imitation learning.
• MeetMind: the canonical citation for "the solver decides, the LLM communicates", and it even uses meeting scheduling as a domain. Confirm that detail in the paper before quoting it.
• Weaknesses: a preprint, with an expensive solver loop and a small action abstraction.
Also worth knowing
• [Seminal] ○ He, H., Chen, D., Balakrishnan, A. & Liang, P. (2018). Decoupling Strategy and Generation in Negotiation Dialogues. EMNLP 2018. arXiv:1808.09637. This is the pre-LLM origin of the strategy/generation split: a coarse dialogue act is chosen by a planner, then rendered in language.
• [Recent] ○ Meta FAIR Diplomacy Team (Bakhtin, A., et al.) (2022). Human-Level Play in the Game of Diplomacy by Combining Language Models with Strategic Reasoning. Science 378(6624):1067–1074. doi:10.1126/science.ade9097. CICERO: a planner picks intents and a language model is conditioned on them. It is the best-known demonstration of this architecture.
• [Recent] ✓ Tessler, M. H., Bakker, M. A., et al. (2024). AI Can Help Humans Find Common Ground in Democratic Deliberation. Science 386, eadq2852. doi:10.1126/science.adq2852. The "Habermas Machine": an LLM mediator iterates group statements from individual critiques, a modern LLM single-text procedure. Over 5,000 UK participants preferred its statements to those of human mediators.
• [Recent] ✓ Fish, S., Gölz, P., Parkes, D. C., Procaccia, A. D., Rusak, G., Shapira, I. & Wüthrich, M. (2024). Generative Social Choice. Proc. ACM EC 2024, p. 985. arXiv:2309.01291. Methodologically the most transferable: prove guarantees assuming oracle queries, then empirically validate that an LLM approximates the oracle. Apply this to "the LLM elicits u_i".
• [Recent] ○ Sharma, M., et al. (2024). Towards Understanding Sycophancy in Language Models. ICLR 2024. arXiv:2310.13548. Sycophancy is a general RLHF behaviour. In MeetMind, a sycophantic personal agent may cave on a "flex" request its user would refuse, so measure flex acceptance against ground truth.
• Newest (2026; found on venue pages, not yet read in full): Are LLM Agents Exploitable Negotiators? (ICLR 2026) measures exploitability against analytically computed equilibria. MandateBench (NeurIPS 2026) finds LLM representatives fabricating claims to their principals. Cosentino et al., Counterparty Modeling is Not Strategy (Salesforce, arXiv:2605.16575) shows agents model counterparties but fail to exploit that knowledge. I have not verified the authors or claims of the first two beyond their abstracts.
6. Evaluation methodology for multi-agent negotiation
The published standard is this: score every outcome against hidden ground-truth utilities, not against what agents reported. Compare with an oracle optimum and with simple baselines. Measure strategic robustness as the utility gain a deviating agent achieves under its true utility.
[Seminal] ○ Baarslag, T., Fujita, K., Gerding, E. H., Hindriks, K., Ito, T., Jennings, N. R., Jonker, C., Kraus, S., Lin, R., Robu, V. & Williams, C. R. (2013). Evaluating Practical Negotiating Agents: Results and Analysis of the 2011 International Competition. Artificial Intelligence 198:73–103. doi:10.1016/j.artint.2012.09.004
• Summary: The methodology paper for ANAC, the Automated Negotiating Agents Competition. Covers tournament design across domains of varying size and opposition, plus discount factors and reservation values.
• Mechanism: metrics include individual utility, social welfare, distance to the Pareto frontier, distance to the Nash point and agreement rate. All are computed on known utility profiles.
• MeetMind: adopt this metric set wholesale. Report "distance to Nash point" and "distance to Pareto frontier" for every baseline.
• Weaknesses: non-LLM, bilateral agents. The author list is from memory; check it.
[Seminal] ○ Lin, R., Kraus, S., Baarslag, T., Tykhonov, D., Hindriks, K. & Jonker, C. M. (2014). Genius: An Integrated Environment for Supporting the Design of Generic Automated Negotiators. Computational Intelligence 30(1):48–70. doi:10.1111/j.1467-8640.2012.00463.x
• Summary: The GENIUS testbed. It provides standard domains and preference profiles, an analysis toolkit with Pareto frontier, Nash and KS points, and baseline agents such as time-dependent conceders (Boulware, Conceder).
• Mechanism: benchmark agents (concession curves) plus outcome-space analytics.
• MeetMind: the Boulware and Conceder strategies are ready-made scripted "stubborn" and "pushover" agents. Use them to stress-test your mediator without spending LLM tokens.
• Weaknesses: a Java ecosystem, bilateral-first. The page numbers and DOI are from memory.
[Seminal] ○ Koutsoupias, E. & Papadimitriou, C. (1999). Worst-Case Equilibria. STACS 1999, LNCS 1563:404–413. doi:10.1007/3-540-49116-3_38
• Summary: Introduces the ratio between optimal welfare and the welfare at the worst equilibrium, later called the price of anarchy.
• Mechanism: PoA = OPT / min over equilibria of SW(eq).
• MeetMind: use an empirical version: Nash welfare under truthful reports divided by Nash welfare when strategic agents best-respond. Call it the "empirical price of strategic behaviour", and avoid calling it PoA unless you compute equilibria.
• Weaknesses: a worst-case concept. True equilibria of LLM agents can't be computed.
[Seminal] ○ Procaccia, A. D. & Rosenschein, J. S. (2006). The Distortion of Cardinal Preferences in Voting. Cooperative Information Agents (CIA) 2006, LNAI 4149:317–331.
• Summary: Defines distortion: the worst-case ratio between the optimal utilitarian welfare and the welfare of the alternative an ordinal rule picks.
• Mechanism: distortion(f) = sup over profiles of OPT / SW(f(π)).
• MeetMind: report empirical distortion for When2Meet, Borda and your ranking-elicitation variant against cardinal ground truth.
• Weaknesses: worst-case and utilitarian-only. Use the Nash-welfare analogue too.
[Recent] ✓ Abdelnabi et al. (2024) and ✓ Davidson et al. (2024): see Topic 5.
• How they simulate adversaries: Abdelnabi et al. assign greedy and saboteur roles via prompts and score them against hidden tables. Davidson et al. use cross-play between different models. Bianchi et al. inject behavioural tactics (desperation, cunning). Vaccaro et al. use human-designed adversarial prompts, including prompt injection. The Magentic Marketplace authors use six manipulation strategies, from fake credentials and social proof to prompt injection.
Metric definitions for MeetMind. All are computed on ground-truth utilities u, never on reports r.
Metric
Definition
What it catches
Utilitarian welfare
Σ_i u_i(s) / Σ_i max_t u_i(t)
Overall quality
Nash welfare (log)
Σ_i log(u_i(s) − d_i)
Balanced quality, the primary metric
Min utility
min_i (u_i(s) − d_i)
Worst-off participant
Proportionality rate
share of agents with u_i(s) ≥ (1/n)·max_t u_i(t)
Fair share in a public decision; envy is trivial for one slot
Pareto-optimality rate
share of instances where no feasible t Pareto-dominates s
Wasted value
Distance to oracle
NW(oracle) − NW(s)
Gap to the best achievable
Manipulation gain
u_i(f(r′i, r−i)) − u_i(f(r_i, r_−i)) for liar i
Incentive to lie
Harm to honest agents
Δ mean u_j for honest j when i lies
Externality of lying
Empirical price of strategic behaviour
NW(all truthful) / NW(with liars)
System-level robustness
Hard-constraint violations
count of picks violating any hard constraint
Must be 0
Rounds, LLM calls, tokens, latency
per instance
Cost
Explanation faithfulness
does the mediator's stated reason match the solver's argmax?
Hallucinated rationales
Envy across a series
for recurring meetings, the gap in cumulative utility between agents
Long-run fairness
Recommended design for MeetMind
The solver owns every number and the final pick. LLMs only translate preferences into structured rules, carry out bounded, monotonic concessions, and explain. This is the architecture of Lawless et al. (2024), Gemp et al. (2024), CICERO (2022) and He et al. (2018), and Hua et al. (2024) and Bianchi et al. (2024) show why it is needed.
Why change max-min over raw scores
Max-min over self-reported 0–100 scores has three problems:
• Scale. It isn't invariant to how an agent uses the scale (Kalai 1977), so an agent that scores everything 40–60 outweighs one that uses 0–100.
• Victim strategy. It rewards underreporting. Claiming that every slot except your favourite is terrible makes you the bottleneck, and the rule then serves you.
• Wasted value. Without a leximin tie-break, it can pick Pareto-dominated slots.
Raw LLM-generated scores are also noisy and sycophancy-prone (Sharma et al. 2024), and an emotional plea can sway them (Bianchi et al. 2024).
1. Bargaining solution: Nash product, with an ε floor and a leximin tie-break
s^* = \arg\max_{s \in S_{\text{feasible}}} \sum_i \log\big(\epsilon + u_i(s) - d_i\big), \quad \text{ties broken by leximin}
• Why Nash: it is the unique solution under Nash's axioms (Nash 1950), and it is what patient alternating-offer bargainers converge to (Binmore, Rubinstein & Wolinsky 1986). It is Pareto-optimal with strong discrete fairness (Caragiannis et al. 2019) and has public-decision guarantees (Conitzer, Freeman & Shah 2017). It is invariant to each agent's affine rescaling, which removes the 0–100 vs 40–60 problem.
• Why not KS: it is not Pareto-optimal for n ≥ 3 (Roth 1979).
• Why keep a fairness floor: add the constraint u_i(s) − d_i ≥ τ for all i, or use leximin as the tie-break. You can then still say "no one is sacrificed", which is what you valued in max-min (Kalai 1977).
• d_i: elicit "how bad is it if this doesn't happen this week?" on the same normalized scale. If every slot falls below d_i for anyone, return "no individually rational slot" plus the best near-miss.
• ε floor: about 0.05 stops a single zero from vetoing a slot outright. Without it, the Nash product becomes a unanimity rule.
• Recurring meetings (stretch goal): maximize Nash welfare over cumulative utility across the series (Conitzer, Freeman & Shah 2017), so this week's loser is favoured next week.
2. Concession protocol: mediated single text plus multilateral monotonic concession, capped at 3 rounds
1.  Solver drafts. It computes the Nash-optimal slot s⁰ and a ranked top-k shortlist, and identifies the bottleneck agent b: the one with the lowest normalized gain at s⁰. This is Raiffa's single negotiating text (1982) and Klein et al.'s mediator (2003).
2.  Mediator LLM asks. It picks the targeted request using a Zeuthen-style rule: ask the agent whose concession raises the Nash product most (Zeuthen 1930; Harsanyi 1956), or the agent who will lose least by moving. It sends a structured request, for example {agent: b, ask: "flex", target: s¹, reason_code: "only slot where Ana's hard constraint holds"}, plus a natural-language rendering.
3.  Personal agents respond with one structured move:
    ◦ accept(s);
    ◦ flex(rule_id, new_weight), which may only raise the agent's utility for slots others prefer, or widen its acceptable set;
    ◦ hold.
    Endriss (2006) gives the definition of a valid multilateral concession, and code enforces monotonicity: no retracting earlier concessions. A flex must also stay inside the flexibility range the user declared at setup, which stops sycophantic over-conceding.
4.  Solver re-optimizes on the updated reports. The loop stops when everyone accepts, when a round passes with no concession, or after 3 rounds.
5.  Final pick. The solver picks argmax Nash welfare on the final reports. It is Pareto-optimal for the reports by construction. The mediator explains the choice, and a faithfulness check confirms that the explanation cites the solver's real binding constraint.
• Guarantees you can state: termination within 3 rounds, and in general within |S| because concessions are monotone on a finite set. Zero hard-constraint violations, because the filter is code. The output is Pareto-optimal and Nash-optimal for reported utilities.
• What you cannot claim: optimality for true utilities, or that truth-telling is an equilibrium.
• Security: agent messages to the mediator are untrusted data. Only structured moves reach the solver, which neutralizes the prompt-injection and "I'm desperate" tactics documented by Vaccaro et al. (2025) and Bianchi et al. (2024). Present the shortlist in solver order and randomize the display order across agents, to counter first-proposal bias (Magentic Marketplace, 2025).
3. Elicitation: rules, not scores
1.  The LLM translates once and the user confirms. The personal agent turns natural language ("I hate early mornings, Fridays are fine if short") into a typed rule set from a fixed vocabulary: time-of-day peak and width, day-of-week weights, buffer around existing events, maximum meetings per day, and so on. The user approves the rules (Lawless et al. 2024). Code computes u_i(s) from the rules, and the LLM never emits a score.
2.  Normalize to a fixed budget. Convert each agent's utilities over the feasible set to a rank with ties, then map them to a common [0,1] scale. Borda-style scoring with an L2 or unit-sum budget means no agent can claim that every other slot is maximally bad (Boutilier et al. 2015; Lalley & Weyl 2018). Report results with and without this step as an ablation.
3.  Hard constraints need evidence or budget. A calendar-verified busy block is free. Any extra "hard" constraint a user declares, such as "never Wednesdays", costs one of a small number of hard tokens (for example 2 per week). This bounds the "fake hard constraint" attack, which is otherwise the most powerful lie available to an agent.
4.  A provably truthful dimension. For the time-of-day choice within a fixed day, use the generalized median of reported peaks among feasible slots (Moulin 1980; Procaccia & Tennenholtz 2013). It is strategy-proof, and you can claim that formally.
5.  Optional dominant-strategy variant. Add an organization-internal points currency with Clarke-tax payments (Ephrati & Rosenschein 1991; Ephrati, Zlotkin & Rosenschein 1994). Run it as a separate "MeetMind-VCG" mode, since it optimizes the utilitarian sum, not the Nash product.
Honest framing for the README: "By Gibbard–Satterthwaite, no deterministic non-dictatorial rule over three or more slots is strategy-proof. MeetMind instead (a) is strategy-proof on the time-of-day dimension, (b) bounds the intensity agents can claim through normalization and hard-constraint budgets, and (c) empirically reduces manipulation gain by X% against max-min over raw scores."
Evaluation plan
Generate synthetic instances with hidden ground-truth utilities. Run every scheduler on the same instances with honest agents, then with each liar type. Report the Topic 6 metrics against ground truth, with paired confidence intervals.
Instance generator
• Sizes: n ∈ {3, 5, 8} participants; 1–5 working days; 30-minute slots, giving roughly 15–80 feasible slots after the filter. Include 2–3 time zones for some instances.
• Calendars: DiMES-style random busy blocks at 30%, 50% and 70% density (Maheswaran et al. 2004). Optionally seed the hard layer from Natural Plan's Calendar Scheduling instances (Zheng et al. 2024).
• Ground-truth preferences: each simulated person gets a hidden rule set (time-of-day peak and width, day weights, buffers, a reservation d_i) and the exact u_i it implies. This follows the scorable-game pattern of Abdelnabi et al. (2024).
• Natural-language layer: an LLM "persona" writes how this person would describe the preferences, without numbers. MeetMind's agents see only that text, which tests translation as well as the mechanism.
• Scale: at least 500 instances per n. Fix the seeds and release the generator.
Baselines
ID
Scheduler
What it isolates
B0
Random feasible slot
Floor
B1
When2Meet: most-available slot, i.e. approval voting (Brams & Fishburn 1978)
Is preference modelling worth it at all?
B2
Single-LLM prompt: all calendars and preference text in one prompt, "pick the best slot"
Is a multi-agent structure worth it? (Natural Plan suggests it isn't reliable)
B3
Current MeetMind: max-min over raw LLM 0–100 scores, 3 mediator rounds
Your own before/after
B4
Utilitarian sum over normalized utilities
Fairness vs efficiency
B5
Borda over ranks
Ordinal-only elicitation
B6
Free LLM negotiation via SAOP, no solver (Aydoğan et al. 2017)
Is the solver worth it?
Ours
Nash + leximin + rule elicitation + monotonic single-text mediator

Oracle
Nash optimum computed on ground-truth u
Ceiling
Ablations of "Ours": remove normalization, remove hard-token budgets, remove the mediator (one-shot solver), and swap Nash for max-min while keeping everything else.
Strategic and lying agents
Run each attacker as one deviating agent against honest others, then as a colluding pair:
1.  Inflater: maximum score or weight on its favourite slot, minimum on the rest. Targets score-based rules.
2.  Victim: claims every slot but its favourite is near d_i. Targets max-min and Nash.
3.  Fake hard constraint: declares soft dislikes as hard. Targets every rule, and is the most dangerous.
4.  Emotional persuader: an LLM agent instructed to plead, as in Bianchi et al.'s "desolate and desperate" tactic, and to claim urgency.
5.  Prompt injector: embeds instructions to the mediator in its messages, as in Vaccaro et al. (2025) and the Magentic Marketplace attacks.
6.  Stubborn or Boulware agent: never flexes. This is the GENIUS time-dependent strategy (Lin et al. 2014).
7.  Exact best response: for small instances (n ≤ 4, at most 12 slots), brute-force every report in the agent's report space and take the one that maximizes its true utility. This gives the true worst-case manipulation gain of each mechanism, which LLM attackers only approximate.
Also run cross-play: attackers on a different model family from MeetMind's agents (Davidson et al. 2024). Report the sycophancy rate: the share of flex requests accepted when the user's ground-truth rules say the agent should hold.
What counts as convincing
Pre-register these thresholds in the repo before running:
• Quality: Ours reaches at least 95% of the oracle's Nash welfare (ratio of exp-mean log NW). It beats B1, B2 and B3 on Nash welfare and min utility, with non-overlapping 95% paired-bootstrap CIs at every n.
• Efficiency: a Pareto-optimality rate of at least 98% on ground truth. B2 and B3 will likely be well below that, which makes a good headline chart.
• Robustness: median manipulation gain for attackers 1–3 is at least 50% lower than under B3. Exact best-response gain is reported and shown to be bounded. Prompt-injection and persuasion attackers gain about 0, because only structured moves reach the solver.
• Safety: 0 hard-constraint violations across all runs, compared with a nonzero count for B2.
• Cost: median rounds ≤ 2 and a token cost per meeting within a stated budget. Report latency.
• Faithfulness: at least 95% of mediator explanations name the solver's actual binding reason.
• Translation check: report how often LLM-extracted rules match ground-truth rules. If they don't match, the mechanism's guarantees are moot (the Generative Social Choice methodology of Fish et al. 2024).
A result that still holds against the exact best-response attacker is the most persuasive single number for reviewers. Most LLM-negotiation papers only test prompted liars.
Top 5 papers to cite in the README or on your résumé
These five give one citation per layer: selection, protocol, fairness, LLM evaluation and the LLM-plus-solver precedent.
1.  Nash (1950), The Bargaining Problem, Econometrica: the selection rule. doi:10.2307/1907266
2.  Endriss (2006), Monotonic Concession Protocols for Multilateral Negotiation, AAMAS: the multi-party concession protocol. Pair it with Rosenschein & Zlotkin (1994) if you have room. doi:10.1145/1160633.1160702
3.  Caragiannis et al. (2019), The Unreasonable Fairness of Maximum Nash Welfare, ACM TEAC: why the Nash product is fair on discrete outcomes. doi:10.1145/3355902
4.  Abdelnabi et al. (2024), Cooperation, Competition, and Maliciousness, NeurIPS D&B: the multi-party LLM negotiation benchmark your evaluation follows. arXiv:2309.17234
5.  Lawless et al. (2024), "I Want It That Way", ACM TiiS: LLM plus constraint solver for meeting scheduling, the direct precedent. doi:10.1145/3685053
Alternates: use Gemp et al. (2024) in place of #5 if your audience is ML research rather than HCI. Use Ephrati, Zlotkin & Rosenschein (1994) if you highlight anti-manipulation; it is the earliest non-manipulable meeting scheduler.
