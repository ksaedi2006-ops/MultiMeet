import { pickAvatar } from '../lib/avatars'
import type { LogEvent, MemberPayload, RankedInfo, SlotInfo } from '../api/events'
import { blockerPhrase, fullTime, plainTimes } from '../lib/timeLabels'

export type Phase = 'holding' | 'filtering' | 'scoring' | 'asking' | 'decided' | 'escalated' | 'failed'

export type AgentStatus = 'holding' | 'ready' | 'thinking' | 'scored' | 'asked' | 'replied' | 'failed'

export interface Agent {
  id: string
  name: string
  callsign: string
  avatar: number
  carrier: string
  role: 'admin' | 'member'
  ready: boolean
  status: AgentStatus
  fallback: boolean
  summary: string | null
  reasons: Record<string, string> | null // only present for the viewer's own agent
  reply: { response: 'accept' | 'flex' | 'hold'; delta: number; seq: number } | null
}

export interface SlotModel extends SlotInfo {
  index: number
  dayKey: string
  dayLabel: string
  closed: boolean
  blockers: { user_id: string; name: string; reason: string }[]
  rank: number | null // position on the latest shortlist (1-based)
}

export interface Ask {
  id: string
  round: number
  slotId: string
  toId: string
  toName: string
  text: string
  seq: number
  reply: { response: 'accept' | 'flex' | 'hold'; old: number; new: number; text: string; seq: number } | null
}

export interface LogLine {
  seq: number
  at: string | null
  round: number
  speaker: string // a person's short name, 'Mediator' or 'Update'
  tone: 'sys' | 'agent' | 'tower' | 'close' | 'clear' | 'warn'
  text: string
  privateNote?: string
}

export interface DecisionModel {
  status: 'converged' | 'escalated'
  slot: SlotInfo | null
  scores: Record<string, number>
  minScore: number | null
  avgScore: number | null
  compromises: { user_id: string; name: string; gave_up: string; score: number }[]
  alternatives: { slot_id: string; label: string; min_score: number; avg_score: number }[]
  explanation: string
  question: string | null
  seq: number
}

export interface TowerModel {
  phase: Phase
  round: number
  backend: string | null
  timezone: string | null
  agents: Agent[]
  slots: SlotModel[]
  scores: Record<string, Record<string, number>>
  asks: Ask[]
  shortlist: RankedInfo[]
  decision: DecisionModel | null
  error: string | null
  log: LogLine[]
  lastSeq: number
  rsvps: Record<string, 'accepted' | 'declined'>
}

export const emptyModel: TowerModel = {
  phase: 'holding',
  round: 0,
  backend: null,
  timezone: null,
  agents: [],
  slots: [],
  scores: {},
  asks: [],
  shortlist: [],
  decision: null,
  error: null,
  log: [],
  lastSeq: 0,
  rsvps: {},
}

/**
 * The short name shown on someone's dot and in the activity list: their first name, with a
 * last initial (then a number) only when two people share it.
 */
export function callsignFor(name: string, taken: Set<string>): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] || 'Guest'
  if (!taken.has(first)) return first
  const withInitial = words[1] ? `${first} ${words[1][0].toUpperCase()}.` : first
  if (!taken.has(withInitial)) return withInitial
  let n = 2
  while (taken.has(`${first} ${n}`)) n++
  return `${first} ${n}`
}

function dayInfo(iso: string, tz: string | null) {
  const d = new Date(iso)
  const opts = { timeZone: tz ?? undefined }
  const key = d.toLocaleDateString('en-CA', opts)
  const label = `${d.toLocaleDateString('en-US', { ...opts, weekday: 'short' })} ${d.toLocaleDateString('en-US', { ...opts, day: 'numeric' })}`
  return { key, label }
}

function upsertMember(agents: Agent[], m: MemberPayload): Agent[] {
  const i = agents.findIndex((a) => a.id === m.user_id)
  if (i >= 0) {
    const next = agents.slice()
    next[i] = { ...next[i], name: m.name, role: m.role, ready: m.ready }
    return next
  }
  const taken = new Set(agents.map((a) => a.callsign))
  const avatar = pickAvatar(m.user_id, new Set(agents.map((a) => a.avatar)))
  return [
    ...agents,
    {
      id: m.user_id, name: m.name, callsign: callsignFor(m.name, taken), avatar, carrier: '', role: m.role,
      ready: m.ready, status: m.ready ? 'ready' : 'holding', fallback: false, summary: null, reasons: null, reply: null,
    },
  ]
}

function setAgent(agents: Agent[], id: string, patch: Partial<Agent>): Agent[] {
  return agents.map((a) => (a.id === id ? { ...a, ...patch } : a))
}

export function reduce(model: TowerModel, e: LogEvent): TowerModel {
  const m: TowerModel = { ...model, lastSeq: e.seq }
  const sign = (id: string) => m.agents.find((a) => a.id === id)?.callsign ?? 'Someone'
  const line = (l: Omit<LogLine, 'seq' | 'at' | 'round'>) => {
    m.log = [...m.log, { seq: e.seq, at: e.at, round: m.round, ...l, text: plainTimes(l.text) }]
  }
  const slotLabel = (id: string) => m.slots.find((s) => s.id === id)?.label ?? id

  switch (e.type) {
    case 'member_joined':
    case 'member_updated': {
      const known = m.agents.some((a) => a.id === e.user_id)
      m.agents = upsertMember(m.agents, e)
      if (m.phase === 'holding') {
        m.agents = setAgent(m.agents, e.user_id, { status: e.ready ? 'ready' : 'holding' })
      }
      if (!known) line({ speaker: 'Update', tone: 'sys', text: `${e.name} joined.` })
      else if (e.type === 'member_updated' && e.ready) {
        const before = model.agents.find((a) => a.id === e.user_id)
        if (before && !before.ready) line({ speaker: sign(e.user_id), tone: 'agent', text: 'Ready to negotiate.' })
      }
      return m
    }
    case 'negotiation_started': {
      const tz = e.timezone
      m.phase = 'filtering'
      m.backend = e.agent_backend
      m.timezone = tz
      const taken = new Set<string>()
      const takenAvatars = new Set(model.agents.map((a) => a.avatar))
      m.agents = e.participants.map((p) => {
        const prev = model.agents.find((a) => a.id === p.user_id)
        const callsign = prev?.callsign ?? callsignFor(p.name, taken)
        taken.add(callsign)
        const avatar = prev?.avatar ?? pickAvatar(p.user_id, takenAvatars)
        takenAvatars.add(avatar)
        return {
          id: p.user_id, name: p.name, callsign, avatar, carrier: p.carrier, role: prev?.role ?? 'member', ready: true,
          status: 'ready', fallback: false, summary: null, reasons: null, reply: null,
        }
      })
      m.slots = e.slots.map((s, index) => {
        const { key, label } = dayInfo(s.start, tz)
        return { ...s, index, dayKey: key, dayLabel: label, closed: false, blockers: [], rank: null }
      })
      line({
        speaker: 'Mediator', tone: 'tower',
        text: `Starting. ${e.participants.length} people, ${e.slots.length} possible times.`,
      })
      return m
    }
    case 'slots_closed': {
      const closed = new Map(e.closed.map((c) => [c.slot_id, c.blockers]))
      m.slots = m.slots.map((s) => (closed.has(s.id) ? { ...s, closed: true, blockers: closed.get(s.id)! } : s))
      const causes = new Map<string, number>()
      e.closed.forEach((c) => c.blockers.forEach((b) => {
        const k = blockerPhrase(b.name, b.reason)
        causes.set(k, (causes.get(k) ?? 0) + 1)
      }))
      const top = [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
      line({
        speaker: 'Update', tone: 'close',
        text: `Crossed out ${e.closed.length} of ${m.slots.length} times someone can't make${top.length ? `, e.g. ${top.join('; ')}` : ''}. ${e.open.length} left.`,
      })
      return m
    }
    case 'round_started': {
      m.round = e.round
      m.phase = e.kind === 'score' ? 'scoring' : 'asking'
      line({
        speaker: 'Mediator', tone: 'tower',
        text: e.kind === 'score' ? 'Round 1: everyone rates the times that are left.' : `Round ${e.round}: asking a few people if they can move something.`,
      })
      return m
    }
    case 'agent_thinking':
      m.agents = setAgent(m.agents, e.user_id, { status: 'thinking', reply: null })
      return m
    case 'agent_failed':
      m.agents = setAgent(m.agents, e.user_id, { fallback: true })
      line({ speaker: sign(e.user_id), tone: 'warn', text: `Agent error (${e.error}). Using a stand-in.` })
      return m
    case 'agent_scored': {
      m.scores = { ...m.scores, [e.user_id]: e.scores }
      const prev = m.agents.find((a) => a.id === e.user_id)
      m.agents = setAgent(m.agents, e.user_id, {
        status: 'scored', summary: e.summary, fallback: e.fallback || Boolean(prev?.fallback),
        reasons: e.private?.reasons ?? null,
      })
      const best = Object.entries(e.scores).sort((a, b) => b[1] - a[1])[0]
      line({
        speaker: sign(e.user_id), tone: 'agent', text: e.summary,
        privateNote: best ? `Your agent's favourite: ${fullTime(slotLabel(best[0]))} (${best[1]}/100).` : undefined,
      })
      return m
    }
    case 'shortlist': {
      m.shortlist = e.ranked
      const ranks = new Map(e.ranked.map((r, i) => [r.slot_id, i + 1]))
      m.slots = m.slots.map((s) => ({ ...s, rank: ranks.get(s.id) ?? null }))
      const lead = e.ranked[0]
      if (lead) {
        line({
          speaker: 'Mediator', tone: 'tower',
          text: `In the lead: ${fullTime(slotLabel(lead.slot_id))}. Least-happy person ${lead.min_score}/100, average ${Math.round(lead.avg_score)}.`,
        })
      }
      return m
    }
    case 'mediator_ask': {
      m.asks = [...m.asks, {
        id: e.ask_id, round: e.round, slotId: e.slot_id, toId: e.to_user_id, toName: e.to_name,
        text: e.text, seq: e.seq, reply: null,
      }]
      m.agents = setAgent(m.agents, e.to_user_id, { status: 'asked' })
      line({ speaker: 'Mediator', tone: 'tower', text: e.text })
      return m
    }
    case 'agent_reply': {
      m.asks = m.asks.map((a) => (a.id === e.ask_id
        ? { ...a, reply: { response: e.response, old: e.old_score, new: e.new_score, text: e.text, seq: e.seq } }
        : a))
      m.scores = { ...m.scores, [e.user_id]: { ...m.scores[e.user_id], [e.slot_id]: e.new_score } }
      m.agents = setAgent(m.agents, e.user_id, {
        status: 'replied', reply: { response: e.response, delta: e.new_score - e.old_score, seq: e.seq },
      })
      const tag = e.response === 'flex' ? 'Can move' : e.response === 'hold' ? "Won't move" : 'Agrees'
      line({ speaker: sign(e.user_id), tone: 'agent', text: `${tag}. ${e.text}` })
      return m
    }
    case 'decision': {
      m.phase = e.status === 'converged' ? 'decided' : 'escalated'
      m.decision = {
        status: e.status, slot: e.slot, scores: e.scores, minScore: e.min_score, avgScore: e.avg_score,
        compromises: e.compromises, alternatives: e.alternatives, explanation: e.explanation,
        question: e.question, seq: e.seq,
      }
      line(e.status === 'converged'
        ? { speaker: 'Mediator', tone: 'clear', text: `Booked: ${e.slot ? fullTime(e.slot.label) : ''}.` }
        : { speaker: 'Mediator', tone: 'warn', text: `No time works for everyone. ${e.question ?? e.explanation}` })
      return m
    }
    case 'negotiation_failed':
      m.phase = 'failed'
      m.error = e.error
      line({ speaker: 'Update', tone: 'warn', text: e.error })
      return m
    case 'rsvp':
      m.rsvps = { ...m.rsvps, [e.user_id]: e.response }
      line({ speaker: sign(e.user_id), tone: 'agent', text: e.response === 'accepted' ? 'Confirmed attendance.' : "Can't make it." })
      return m
  }
  return m
}

export function buildModel(events: LogEvent[], upTo = events.length): TowerModel {
  let m = emptyModel
  for (let i = 0; i < upTo; i++) m = reduce(m, events[i])
  return m
}
