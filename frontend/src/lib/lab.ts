import { API_BASE } from '../api/client'
import type { LogEvent } from '../api/events'

import type { RuleId } from '../lab/theories'

export type LabRule = RuleId
export type Attack = 'none' | 'inflater' | 'victim' | 'fakehard' | 'pair'
export const ATTACK_IDS: Attack[] = ['none', 'inflater', 'victim', 'fakehard', 'pair']

export interface LabExtra {
  condorcet?: boolean
  dictator?: string
  votes?: Record<string, string>
  top?: { slot: string; value: number }[]
}

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
  extra?: LabExtra
  attack_extra?: LabExtra
  payments?: Record<string, number>
  rounds?: { user_id: string; rule: string; target: string; draft: string | null; move: 'accept' | 'flex' | 'hold'; pick_after: string | null }[]
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

export interface LabMeeting extends LabInstance {
  people: (LabInstance['people'][number] & { said: string[]; edited?: boolean })[]
  liars: string[]
}

export async function getLabMeeting(idx: number, n: number, attack: Attack): Promise<LabMeeting> {
  const q = new URLSearchParams({ idx: String(idx), n: String(n), attack })
  const res = await fetch(`${API_BASE}/lab/meeting?${q}`)
  if (!res.ok) throw new Error(res.status === 404 ? 'That meeting was dropped by the generator.' : 'Couldn’t load that meeting.')
  return res.json()
}

export interface Edit { peak: string; avoid: number[] }

/** The sandbox: redraw some people's preferences and run every rule again. */
export async function decideLab(idx: number, n: number, attack: Attack, edits: Record<string, Edit>): Promise<LabMeeting> {
  const res = await fetch(`${API_BASE}/lab/decide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idx, n, attack, edits }),
  })
  if (!res.ok) throw new Error('Couldn’t re-run the rules.')
  return res.json()
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
