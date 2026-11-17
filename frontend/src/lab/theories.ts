import type { TermId } from './glossary'

/**
 * The decision rules the Lab runs (backend/app/lab.py MECHANISMS), grouped the way the
 * literature groups them. Badges are properties of the implementation here, each backed by
 * a test in backend/tests/test_rules.py or a standard result in the glossary entry.
 */
export type RuleId =
  | 'nash' | 'egalitarian' | 'ks' | 'utilitarian' | 'budget' | 'vcg' | 'old'
  | 'borda' | 'when2meet' | 'plurality' | 'condorcet' | 'median' | 'random_dictator' | 'random'

export interface Theory { id: RuleId; family: Family; badges: TermId[] }
export type Family = 'Bargaining' | 'Welfare' | 'Voting' | 'Mechanism design' | 'Baselines'

export const FAMILIES: Family[] = ['Bargaining', 'Welfare', 'Voting', 'Mechanism design', 'Baselines']

export const THEORIES: Theory[] = [
  { id: 'nash', family: 'Bargaining', badges: ['pareto', 'cardinal', 'mediated', 'manipulable'] },
  { id: 'ks', family: 'Bargaining', badges: ['pareto', 'cardinal', 'manipulable'] },
  { id: 'egalitarian', family: 'Welfare', badges: ['pareto', 'cardinal', 'manipulable'] },
  { id: 'utilitarian', family: 'Welfare', badges: ['pareto', 'cardinal', 'manipulable'] },
  { id: 'borda', family: 'Voting', badges: ['pareto', 'ordinal', 'manipulable'] },
  { id: 'condorcet', family: 'Voting', badges: ['condorcet_consistent', 'ordinal', 'manipulable'] },
  { id: 'plurality', family: 'Voting', badges: ['ordinal', 'manipulable'] },
  { id: 'when2meet', family: 'Voting', badges: ['sp_dichotomous'] },
  { id: 'median', family: 'Mechanism design', badges: ['ordinal', 'sp_singlepeaked'] },
  { id: 'random_dictator', family: 'Mechanism design', badges: ['ordinal', 'strategyproof'] },
  { id: 'vcg', family: 'Mechanism design', badges: ['pareto', 'cardinal', 'sp_payments'] },
  { id: 'budget', family: 'Mechanism design', badges: ['cardinal', 'manipulable'] },
  { id: 'old', family: 'Baselines', badges: ['cardinal', 'manipulable'] },
  { id: 'random', family: 'Baselines', badges: [] },
]

/** The colour each rule keeps everywhere (Nash is the product's amber). Up to five race at once. */
export const SERIES = ['#c98500', '#3987e5', '#d95926', '#9085e9', '#199e70'] // dataviz validator: all checks pass (adjacent) on #1a2531
