import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getMeetingState,
  listEventMembers,
  type AgentResponseSummary,
  type Member,
  type MeetingDecision,
} from '../api/client'
import { useNegotiationSocket } from '../api/useNegotiationSocket'
import StepHeader from '../components/StepHeader'
import Seal from '../components/Seal'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return chars.toUpperCase()
}

function timeNow() {
  return new Date().toTimeString().slice(0, 8)
}

export default function NegotiationLiveView() {
  const { eventId = null } = useParams<{ eventId: string }>()
  const { events, connected } = useNegotiationSocket(eventId)
  const [members, setMembers] = useState<Member[]>([])
  const [pastResponses, setPastResponses] = useState<AgentResponseSummary[]>([])
  const [decision, setDecision] = useState<MeetingDecision | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [stamps, setStamps] = useState<string[]>([])

  useEffect(() => {
    if (!eventId) return
    Promise.all([listEventMembers(eventId), getMeetingState(eventId)]).then(([memberList, state]) => {
      setMembers(memberList)
      setPastResponses(state.responses)
      if (state.decision) setDecision(state.decision)
      setLoaded(true)
    })
  }, [eventId])

  useEffect(() => {
    setMembers((prev) => {
      let next = prev
      for (const e of events) {
        if (e.type !== 'member_ready') continue
        const idx = next.findIndex((m) => m.user_id === e.user_id)
        if (idx >= 0 && !next[idx].ready) {
          next = next.map((m, i) => (i === idx ? { ...m, ready: true } : m))
        }
      }
      return next
    })
    const decisionEvent = [...events].reverse().find((e) => e.type === 'mediator_decision')
    if (decisionEvent && decisionEvent.type === 'mediator_decision') {
      setDecision(decisionEvent.decision as unknown as MeetingDecision)
    }
  }, [events])

  useEffect(() => {
    setStamps((prev) =>
      prev.length < events.length ? [...prev, ...Array(events.length - prev.length).fill(timeNow())] : prev,
    )
  }, [events.length])

  function nameFor(userId: string) {
    return members.find((m) => m.user_id === userId)?.name || userId.slice(0, 8)
  }

  const liveAgentEvents = events.filter((e) => e.type === 'agent_response')
  const negotiationStarted =
    events.some((e) => e.type === 'negotiation_started') || pastResponses.length > 0 || decision !== null
  const readyCount = members.filter((m) => m.ready).length

  return (
    <div>
      <StepHeader step={4} />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-2">LIVE WIRE</p>
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold">Negotiation</h1>
          <span className="flex items-center gap-2 font-mono text-xs text-mist">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-brass animate-pulse' : 'bg-mist'}`}
            />
            {connected ? 'CONNECTED' : 'CONNECTING…'}
          </span>
        </div>

        {!loaded && <p className="font-mono text-sm text-mist">Loading roster…</p>}

        {loaded && !negotiationStarted && (
          <div className="border border-ink-line rounded-sm p-6 mb-8">
            <p className="font-mono text-xs tracking-widest text-mist mb-4">
              WAITING FOR EVERYONE TO CHECK IN · {readyCount}/{members.length}
            </p>
            <div className="flex flex-col gap-3">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${m.ready ? 'bg-brass' : 'bg-mist/30'}`}
                  />
                  <span className="font-mono text-sm">{m.name || m.user_id.slice(0, 8)}</span>
                  <span className="font-mono text-[10px] text-mist ml-auto">
                    {m.ready ? 'CHECKED IN' : 'BRIEFING AGENT…'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-paper/50 mt-5 leading-relaxed">
              Negotiation begins the moment the last agent checks in — nobody's decision gets made
              before everyone's had a say.
            </p>
          </div>
        )}

        {negotiationStarted && (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <AnimatePresence>
                {(liveAgentEvents.length > 0
                  ? liveAgentEvents.map((e) => (e.type === 'agent_response' ? e.user_name : ''))
                  : pastResponses.map((r) => r.user_name)
                ).map((name, i) => (
                  <motion.div
                    key={`${name}-${i}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="flex items-center gap-2 pr-3 rounded-full border border-brass/40 bg-ink-raised"
                  >
                    <span className="w-7 h-7 rounded-full bg-brass/20 border border-brass text-brass flex items-center justify-center font-mono text-[10px] font-semibold">
                      {name ? initials(name) : ''}
                    </span>
                    <span className="font-mono text-xs">{name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="border border-ink-line rounded-sm overflow-hidden mb-8">
              <div className="bg-ink-raised px-4 py-2 border-b border-ink-line font-mono text-[10px] tracking-[0.2em] text-mist">
                WIRE TRANSCRIPT
              </div>
              <div className="max-h-64 overflow-y-auto bg-paper text-paper-ink px-4 py-3 font-mono text-xs">
                {events.length > 0
                  ? events
                      .filter((e) => e.type !== 'member_ready')
                      .map((e, i) => (
                        <div key={i} className={`py-1.5 flex gap-3 ${i > 0 ? 'border-t border-paper-ink/10' : ''}`}>
                          <span className="text-paper-ink/40 shrink-0">{stamps[i] ?? ''}</span>
                          <span>
                            {e.type === 'negotiation_started' && (
                              <>
                                Negotiation opened · {e.participants} agent{e.participants === 1 ? '' : 's'} ·{' '}
                                {e.slots} candidate slots
                              </>
                            )}
                            {e.type === 'agent_response' && (
                              <>
                                <span className="font-semibold">{e.user_name}'s agent</span> — top slot{' '}
                                {e.top_slot?.datetime ? new Date(e.top_slot.datetime).toLocaleString() : '—'}{' '}
                                ({e.top_slot?.satisfaction ?? 0}% satisfaction) — {e.notes}
                              </>
                            )}
                            {e.type === 'mediator_decision' && (
                              <span className="text-seal font-semibold">Mediator reached a decision.</span>
                            )}
                          </span>
                        </div>
                      ))
                  : pastResponses.map((r, i) => (
                      <div key={i} className={`py-1.5 flex gap-3 ${i > 0 ? 'border-t border-paper-ink/10' : ''}`}>
                        <span className="text-paper-ink/40 shrink-0">—</span>
                        <span>
                          <span className="font-semibold">{r.user_name}'s agent</span> — top slot{' '}
                          {r.top_slot?.datetime ? new Date(r.top_slot.datetime).toLocaleString() : '—'} (
                          {r.top_slot?.satisfaction ?? 0}% satisfaction) — {r.notes}
                        </span>
                      </div>
                    ))}
              </div>
            </div>
          </>
        )}

        {decision && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="border-2 border-seal rounded-sm p-6 sm:p-7 relative"
          >
            <div className="flex items-start gap-4">
              <Seal size={40} />
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-1">
                  {decision.chosen_datetime ? 'DECIDED' : 'ESCALATED'}
                </p>
                <h2 className="font-mono text-lg sm:text-xl font-semibold mb-2 truncate">
                  {decision.chosen_datetime
                    ? new Date(decision.chosen_datetime).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'No slot satisfied everyone — flagged for humans'}
                </h2>
                <p className="text-sm text-paper/70 mb-4 leading-relaxed">{decision.explanation}</p>
                {Object.keys(decision.satisfaction_breakdown).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(decision.satisfaction_breakdown).map(([uid, score]) => (
                      <span
                        key={uid}
                        className="font-mono text-[10px] tracking-wide rounded-full border border-brass/40 bg-brass/10 text-brass px-3 py-1"
                      >
                        {nameFor(uid)} · {score}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
