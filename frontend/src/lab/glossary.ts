/**
 * Every term the Lab shows, in the field's own words. The screen shows the term; hovering,
 * tapping or focusing it opens this entry. Sources are from docs/research/negotiation-layer.md
 * unless noted; ○ marks a reference the report cites from memory (verify before quoting).
 */
export interface Entry {
  term: string
  what: string // one or two sentences
  formula?: string
  source: string
}

export const GLOSSARY = {
  // ---- decision rules ----
  nash: {
    term: 'Maximum Nash welfare',
    what: 'The discrete analogue of the Nash bargaining solution: pick the time with the highest product of everyone’s gains over their disagreement point, so one person near zero drags a time down hard. Nash defined the solution on a convex set; here it is maximised over a finite list of times. MultiMeet’s rule adds top-k normalization and up to three mediator rounds. The ε floor stops one zero from vetoing a time, at the cost of exact scale invariance.',
    formula: 'argmaxₛ Σᵢ log(ε + uᵢ(s) − dᵢ), ε = 0.05, d = 0 on the common scale, leximin ties',
    source: 'Nash 1950 ○; Caragiannis et al. 2019 (maximum Nash welfare on discrete outcomes)',
  },
  old: {
    term: 'Max-min, raw scores',
    what: 'The old MultiMeet rule: agents score 0–100 themselves and the time with the best worst score wins. Kept as the before-and-after baseline (B3).',
    formula: 'argmaxₛ minᵢ scoreᵢ(s), then mean',
    source: 'Kalai 1977 ○ (egalitarian solution)',
  },
  egalitarian: {
    term: 'Egalitarian (leximin)',
    what: 'Make the worst-off person as well off as possible; break ties by the next worst-off, and so on.',
    formula: 'argmaxₛ leximin(u(s) − d)',
    source: 'Kalai 1977 ○',
  },
  utilitarian: {
    term: 'Utilitarian',
    what: 'Picks the time with the largest total utility. Can sacrifice one person if it helps everyone else a little.',
    formula: 'argmaxₛ Σᵢ uᵢ(s), range-normalized',
    source: 'Baseline B4 in the evaluation',
  },
  ks: {
    term: 'Kalai–Smorodinsky (discrete)',
    what: 'A discrete analogue of the Kalai–Smorodinsky solution: give everyone the same share of the gain they’d get at their own favourite time, maximised over the finite list of times, with leximin ties. The original is defined on a convex set.',
    formula: 'argmaxₛ minᵢ (uᵢ(s) − dᵢ) / (aᵢ − dᵢ), aᵢ = maxₜ uᵢ(t)',
    source: 'Kalai & Smorodinsky 1975 ○; Roth 1979 (the continuous solution is not Pareto optimal for n ≥ 3 in general; this tie-broken version is, by test)',
  },
  borda: {
    term: 'Borda count',
    what: 'Everyone ranks the times; a time earns more points the higher it’s ranked. Most points wins.',
    formula: 'argmaxₛ Σᵢ (m − rankᵢ(s))',
    source: 'Brandt et al. 2016, Handbook of Computational Social Choice ○',
  },
  when2meet: {
    term: 'Approval voting',
    what: 'Each person approves every time they’re free for; most approvals wins, earliest on ties. How When2Meet works.',
    formula: 'argmaxₛ |{i : s ∈ Aᵢ}|',
    source: 'Brams & Fishburn 1978 ○',
  },
  plurality: {
    term: 'Plurality',
    what: 'Each person votes for their single favourite; most votes wins.',
    formula: 'argmaxₛ |{i : s = topᵢ}|',
    source: 'Brandt et al. 2016 ○',
  },
  condorcet: {
    term: 'Copeland (Condorcet)',
    what: 'Compare every pair of times by majority vote. A time that beats all others is the Condorcet winner; if majorities cycle, the time with the most pairwise wins minus losses (Copeland’s rule) is picked.',
    formula: 'argmaxₛ Σₜ sign(#{i: s ≻ᵢ t} − #{i: t ≻ᵢ s})',
    source: 'Copeland 1951 ○; Brandt et al. 2016 ○',
  },
  median: {
    term: 'Generalized median (time of day)',
    what: 'Each person’s peak is the start time of their favourite; the pick is the available time nearest the lower median of the peaks. That is Moulin’s generalized median with n − 1 phantom peaks, ⌈n/2⌉ − 1 placed at the end of the day and the rest at the start. Days don’t vote.',
    formula: 'median(peak₁ … peakₙ, phantoms) on time of day',
    source: 'Moulin 1980 ○; Procaccia & Tennenholtz 2013 ○',
  },
  random_dictator: {
    term: 'Random serial dictatorship',
    what: 'Draw a random order of people. The first is the dictator and gets their favourite time; the next person breaks the dictator’s ties, and so on. Fair only on average, but no one gains by misreporting, and ties never produce a Pareto-dominated time.',
    formula: 'π ~ Uniform(orders); filter by π₁’s best, then π₂’s best, …',
    source: 'Gibbard 1977, cited in the report as the escape from Gibbard–Satterthwaite ○',
  },
  budget: {
    term: 'Budgeted votes (L2)',
    what: 'Everyone’s scores are scaled to the same quadratic budget, so no one can put everything at 100; then the total wins. For a single meeting, this is what a quadratic-voting credit budget amounts to.',
    formula: 'argmaxₛ Σᵢ ûᵢ(s), Σₛ ûᵢ(s)² = B',
    source: 'Lalley & Weyl 2018',
  },
  vcg: {
    term: 'Clarke tax (VCG)',
    what: 'Picks the utilitarian time, then charges each person points equal to the harm their presence does to everyone else (the Clarke pivot rule). With points valued like utility, truth is a dominant strategy. The points are burned: the mechanism isn’t budget-balanced, and here the points have no value outside the meeting.',
    formula: 'tᵢ = Σⱼ≠ᵢ uⱼ(s₋ᵢ*) − Σⱼ≠ᵢ uⱼ(s*)',
    source: 'Vickrey 1961 ○; Clarke 1971 ○; Groves 1973 ○; applied to agents by Ephrati & Rosenschein 1991 and Ephrati, Zlotkin & Rosenschein 1994',
  },
  random: {
    term: 'Random feasible time',
    what: 'Any time everyone can make, chosen at random. The floor every other rule should beat.',
    source: 'Baseline B0 in the evaluation',
  },

  // ---- properties ----
  pareto: {
    term: 'Pareto optimal',
    what: 'As a property of a rule: on what people report, it never picks a time that another time beats for someone while being no worse for anyone. As a measured result (charts, tables): the same check on true preferences, which can fail when reports differ from the truth.',
    source: 'Topic 6 metrics in the report',
  },
  strategyproof: {
    term: 'Strategy-proof',
    what: 'Reporting your true preferences is always a best response, whatever others report. By Gibbard–Satterthwaite, every deterministic rule that is onto at least three outcomes and strategy-proof on the unrestricted domain is dictatorial; randomization or a restricted domain is the way out.',
    source: 'Gibbard 1973 ○; Satterthwaite 1975 ○',
  },
  sp_singlepeaked: {
    term: 'Strategy-proof (single-peaked)',
    what: 'Truthful reporting is a best response when preferences over time of day have one peak and fall away on both sides. Day-of-week preferences are outside that guarantee.',
    source: 'Moulin 1980 ○',
  },
  sp_dichotomous: {
    term: 'Strategy-proof (dichotomous)',
    what: 'Approving exactly the times you can make is a best response when you only care whether you can come, not how much you like the time.',
    source: 'Brams & Fishburn 1978 ○',
  },
  sp_payments: {
    term: 'Strategy-proof (with payments)',
    what: 'Truth is a dominant strategy when the points you pay count against you like utility. Claims about hard constraints aren’t priced.',
    source: 'Ephrati & Rosenschein 1991',
  },
  manipulable: {
    term: 'Manipulable',
    what: 'Some misreport can get a person a time they truly prefer. Not a flaw unique to this rule: Gibbard–Satterthwaite says almost every rule is.',
    source: 'Gibbard 1973 ○; Satterthwaite 1975 ○',
  },
  ordinal: {
    term: 'Ordinal',
    what: 'Uses only each person’s ranking of the times, not how strongly they feel.',
    source: 'Boutilier et al. 2015 ○',
  },
  cardinal: {
    term: 'Cardinal',
    what: 'Uses how strongly each person feels, not just their ranking.',
    source: 'Boutilier et al. 2015 ○',
  },
  condorcet_consistent: {
    term: 'Condorcet-consistent',
    what: 'Whenever one time beats every other in head-to-head majority votes, this rule picks it.',
    source: 'Young & Levenglick 1978 ○',
  },
  mediated: {
    term: 'Mediated concessions',
    what: 'Up to three rounds where the mediator asks the one person whose concession would raise the Nash product most to flex a preference. Their agent can accept, flex or hold, only within the flexibility they declared, and never back up; the same rule can be asked twice, each time to go lower. Inspired by Zeuthen’s concession rule rather than a literal implementation: Zeuthen has the party with the lower risk limit concede.',
    source: 'Raiffa 1982 ○; Endriss 2006; Harsanyi 1956 ○ (links Zeuthen’s rule to the Nash product)',
  },

  // ---- metrics ----
  utility: {
    term: 'Utility',
    what: 'How much a person likes a time on their true preferences, scaled 0–100 between their worst and best available times. Rescaling everyone to the same range is an interpersonal-comparability assumption (relative utilitarianism): 0 means “my worst available time”, not “terrible”, and someone nearly indifferent is stretched to the same range as someone with strong views.',
    source: 'Topic 3 normalization in the report; Dhillon & Mertens 1999 ○ (relative utilitarianism)',
  },
  min_utility: {
    term: 'Min utility',
    what: 'The utility of the worst-off person at the chosen time.',
    source: 'Kalai 1977 ○',
  },
  mean_utility: {
    term: 'Mean utility',
    what: 'Average utility across the group at the chosen time.',
    source: 'Topic 6 metrics in the report',
  },
  oracle_ratio: {
    term: 'Nash-welfare ratio',
    what: 'How close the pick comes to the Nash-optimal time on true preferences (the oracle), per person: 100% is the oracle’s pick. It grades every rule by Nash welfare, so it favours rules that aim at it; read it with the utilitarian and egalitarian ratios. The preregistered quality target (Q1) is this ratio ≥ 95%.',
    formula: 'exp((NW(s) − NW(oracle)) / n), NW(s) = Σᵢ log(ε + max(0, uᵢ(s) − dᵢ))',
    source: 'Topic 6 metrics; preregistration Q1',
  },
  util_ratio: {
    term: 'Utilitarian ratio',
    what: 'Mean utility of the pick divided by the best mean utility any available time achieves, on true preferences.',
    formula: 'Σᵢ uᵢ(s) / maxₜ Σᵢ uᵢ(t)',
    source: 'Topic 6 metrics in the report',
  },
  min_ratio: {
    term: 'Egalitarian ratio',
    what: 'The worst-off person’s gain at the pick divided by the best worst-off gain any available time achieves, on true preferences.',
    formula: 'minᵢ (uᵢ(s) − dᵢ) / maxₜ minᵢ (uᵢ(t) − dᵢ)',
    source: 'Kalai 1977 ○',
  },
  disagreement: {
    term: 'Disagreement point d',
    what: 'What a person gets if there’s no meeting this week. Bargaining rules measure gains above it. The Lab’s rules use d = 0 on the common scale (the worst available time); scoring against the truth uses each person’s true d, so a time below someone’s d counts as worse than no meeting.',
    source: 'Topic 1 in the report (“Choosing d”)',
  },
  oracle: {
    term: 'Oracle',
    what: 'The Nash-optimal time computed on everyone’s true preferences, which no real rule can see.',
    source: 'Evaluation plan in the report',
  },
  manip_gain: {
    term: 'Manipulation gain',
    what: 'The change in the liar’s true utility from lying instead of reporting honestly, in points out of 100. Zero or below means the lie didn’t pay. The attackers are fixed scripts, so a non-positive mean shows these lies fail, not that no lie works; the evaluation’s exact best-response search (R2) covers that for some rules. “Honest” is the agent’s translation of its person’s words, close to but not exactly the truth, which is why even strategy-proof rules can show small gains here.',
    formula: 'uᵢ(f(r′ᵢ, r₋ᵢ)) − uᵢ(f(rᵢ, r₋ᵢ))',
    source: 'Topic 6 metrics in the report',
  },
  payment: {
    term: 'Clarke payment',
    what: 'Points a person pays under the Clarke tax: how much better off everyone else would have been if this person weren’t there.',
    source: 'Ephrati & Rosenschein 1991',
  },
  dictator: {
    term: 'Dictator',
    what: 'The first person in the random order under random serial dictatorship. The draw doesn’t depend on anyone’s report.',
    source: 'Gibbard 1977 ○',
  },
  condorcet_winner: {
    term: 'Condorcet winner',
    what: 'A time that beats every other time in head-to-head majority votes. It doesn’t always exist: majorities can cycle (the Condorcet paradox).',
    source: 'Brandt et al. 2016 ○',
  },

  // ---- attacks ----
  none: { term: 'Truthful', what: 'Everyone’s agent reports honestly.', source: 'Evaluation plan in the report' },
  inflater: {
    term: 'Inflater',
    what: 'One agent reports maximum utility for its favourite time and minimum for every other. Targets rules that use scores.',
    source: 'Attacker 1 in the report',
  },
  victim: {
    term: 'Victim',
    what: 'One agent claims every time except its favourite is close to unbearable, to become the person the rule protects.',
    source: 'Attacker 2 in the report',
  },
  fakehard: {
    term: 'Fake hard constraint',
    what: 'One agent declares its soft dislikes as times it can’t make, removing them from consideration. The most powerful lie available to an agent.',
    source: 'Attacker 3 in the report',
  },
  pair: {
    term: 'Colluding pair',
    what: 'Two agents agree on a shared favourite and both inflate it.',
    source: 'Evaluation plan in the report',
  },
  n: { term: 'n', what: 'People in the meeting. The evaluation uses 3, 5 and 8.', source: 'Preregistration' },
} satisfies Record<string, Entry>

export type TermId = keyof typeof GLOSSARY
