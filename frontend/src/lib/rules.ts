import type { RuleId } from '../api/events'

/** The decision rules from docs/research/negotiation-layer.md that the backend runs on every meeting. */
export interface RuleInfo {
  id: RuleId
  name: string
  short: string // a few letters, for labels on the ring
  idea: string // how it decides, in one plain line
  catch: string // where it goes wrong, in one plain line
  source: string
}

export const RULES: RuleInfo[] = [
  {
    id: 'nash', name: 'Max Nash welfare', short: 'NASH',
    idea: 'Maximise the product of everyone’s happiness, so one unhappy person drags a time down hard.',
    catch: 'Not strategy-proof: a well-informed liar can still nudge it.',
    source: 'Nash 1950; Caragiannis et al. 2019',
  },
  {
    id: 'leximin', name: 'Egalitarian', short: 'EGAL',
    idea: 'Make the least happy person as happy as possible, then the next least happy.',
    catch: 'Rewards whoever claims to be worst off, and can ignore everyone else.',
    source: 'Kalai 1977',
  },
  {
    id: 'utilitarian', name: 'Utilitarian', short: 'UTIL',
    idea: 'Pick the time with the most total happiness.',
    catch: 'Happily sacrifices one person if it pleases the rest a little more.',
    source: 'Utilitarian sum, baseline B4 in the eval',
  },
  {
    id: 'borda', name: 'Borda count', short: 'BORDA',
    idea: 'Everyone ranks the times; points by rank, most points wins.',
    catch: 'Ignores how strongly people feel, and is easy to game by burying a rival’s favourite.',
    source: 'Handbook of Computational Social Choice, Brandt et al. 2016',
  },
  {
    id: 'approval', name: 'When2Meet', short: 'W2M',
    idea: 'The time the most people are free for, earliest on a tie. Preferences ignored.',
    catch: 'Knows who can come, not who wants to. “Free” isn’t “happy”.',
    source: 'Approval voting, Brams & Fishburn 1978',
  },
]

export const RULE: Record<RuleId, RuleInfo> = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, RuleInfo>
export const USED_RULE: RuleId = 'nash'
