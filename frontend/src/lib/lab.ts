import { API_BASE } from '../api/client'
import type { LogEvent } from '../api/events'

/** Rules the Lab can race (backend/app/lab.py MECHANISMS) and what they're called on screen. */
export type LabRule = 'utilitarian' | 'old' | 'egalitarian' | 'nash' | 'borda' | 'random' | 'when2meet'
export type Attack = 'none' | 'inflater' | 'victim' | 'fakehard' | 'pair'

export interface LabRuleInfo { id: LabRule; name: string; short: string; color: string; note: string }

/**
 * Colour follows the rule, never its rank, and the order is the validated adjacency order
 * (dataviz validator, dark surface #1a2531: all checks pass).
 */
export const LAB_RULES: LabRuleInfo[] = [
  { id: 'utilitarian', name: 'Utilitarian', short: 'UTIL', color: '#3987e5', note: 'Most total happiness' },
  { id: 'old', name: 'Old MultiMeet', short: 'OLD', color: '#d95926', note: 'Max-min over raw 0–100 scores (baseline B3)' },
  { id: 'egalitarian', name: 'Egalitarian', short: 'EGAL', color: '#199e70', note: 'Our pipeline, leximin instead of Nash' },
  { id: 'nash', name: 'Nash (ours)', short: 'NASH', color: '#c98500', note: 'Nash product, top-k normalization, mediator' },
  { id: 'borda', name: 'Borda', short: 'BORDA', color: '#d55181', note: 'Rankings only' },
  { id: 'random', name: 'Random', short: 'RAND', color: '#0ca30c', note: 'Any time everyone can make (floor)' },
  { id: 'when2meet', name: 'When2Meet', short: 'W2M', color: '#9085e9', note: 'Most people free (approval voting)' },
]
export const LAB_RULE = Object.fromEntries(LAB_RULES.map((r) => [r.id, r])) as Record<LabRule, LabRuleInfo>

export const ATTACKS: { id: Attack; name: string; note: string }[] = [
  { id: 'none', name: 'Everyone honest', note: '' },
  { id: 'inflater', name: 'Exaggerator', note: 'One person rates their favourite 100 and everything else 0.' },
  { id: 'victim', name: 'Victim', note: 'One person claims every time but their favourite is nearly unbearable.' },
  { id: 'fakehard', name: 'Fake “I can’t”', note: 'One person declares their soft dislikes as hard conflicts.' },
  { id: 'pair', name: 'Colluding pair', note: 'Two people agree on a favourite and both exaggerate for it.' },
]

export interface LabResult {
  pick: string | null
  ratio: number // Nash welfare relative to the best possible time, on true preferences (1 = best)
  min: number // the least happy person's true gain
  util: number
  pareto: boolean
  violation: boolean
  attack_pick?: string | null
  gain?: number // what lying won the liar(s), on their true utility
  harm?: number // what it cost everyone else
}

export interface LabRow {
  idx: number
  n: number
  density: number
  multi_tz: boolean
  feasible: number
  oracle: string
  results: Partial<Record<LabRule, LabResult>>
}

export interface LabInstance extends LabRow {
  timezone: string
  slots: { id: string; start: string; end: string; label: string }[]
  people: { user_id: string; name: string; liar: boolean; scores: Record<string, number> }[]
}

export interface LabParams { rules: LabRule[]; n: 3 | 5 | 8; attack: Attack; count: number }

/** Stream scored meetings; resolves when the run ends or is aborted. */
export async function streamLab(p: LabParams, onRow: (r: LabRow) => void, signal: AbortSignal): Promise<void> {
  const q = new URLSearchParams({ mechs: p.rules.join(','), n: String(p.n), attack: p.attack, count: String(p.count) })
  const res = await fetch(`${API_BASE}/lab/run?${q}`, { signal })
  if (!res.ok || !res.body) throw new Error(`The Lab couldn’t start (${res.status}).`)
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) onRow(JSON.parse(line) as LabRow)
    }
  }
}

export async function getLabInstance(idx: number, p: LabParams): Promise<LabInstance> {
  const q = new URLSearchParams({ idx: String(idx), n: String(p.n), mechs: p.rules.join(','), attack: p.attack })
  const res = await fetch(`${API_BASE}/lab/instance?${q}`)
  if (!res.ok) throw new Error('Couldn’t load that meeting.')
  return res.json()
}

/** A meeting from the Lab as the event log a real negotiation would have written, for the radar. */
export function instanceEvents(inst: LabInstance): LogEvent[] {
  const at = null
  let seq = 0
  const ev: LogEvent[] = [{
    seq: ++seq, at, type: 'negotiation_started', timezone: inst.timezone, agent_backend: 'simulated',
    participants: inst.people.map((p) => ({ user_id: p.user_id, name: p.name, carrier: 'SIM' })),
    slots: inst.slots,
  }]
  for (const p of inst.people) {
    ev.push({ seq: ++seq, at, type: 'agent_scored', user_id: p.user_id, round: 1, scores: p.scores, summary: '', fallback: false })
  }
  return ev
}

export interface Stat { mean: number; lo: number; hi: number; n: number }

/** Mean with a normal-approximation 95% interval (the eval uses a bootstrap; this is the live view). */
export function stat(xs: number[]): Stat {
  const n = xs.length
  if (!n) return { mean: 0, lo: 0, hi: 0, n }
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  const h = 1.96 * sd / Math.sqrt(n)
  return { mean, lo: mean - h, hi: mean + h, n }
}
