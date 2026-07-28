import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { startNegotiation, type MeetingDecision } from '../api/client'
import { useNegotiationSocket } from '../api/useNegotiationSocket'
import StepHeader from '../components/StepHeader'

export default function NegotiationLiveView() {
  const { eventId = null } = useParams<{ eventId: string }>()
  const { events, connected } = useNegotiationSocket(eventId)
  const [decision, setDecision] = useState<MeetingDecision | null>(null)
  const [started, setStarted] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!eventId || started) return
    // Give the WebSocket a moment to connect before triggering the negotiation.
    const timer = setTimeout(async () => {
      setStarted(true)
      const result = await startNegotiation(eventId)
      setDecision(result)
    }, 400)
    return () => clearTimeout(timer)
  }, [eventId, started])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [events])

  const agentEvents = events.filter((e) => e.type === 'agent_response')

  return (
    <div>
      <StepHeader step={4} />
      <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">Negotiation</h1>
      <p className="text-sm text-gray-500 mb-6">
        {connected ? 'Connected — agents are negotiating live.' : 'Connecting…'}
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <AnimatePresence>
          {agentEvents.map((e, i) => (
            <motion.div
              key={`${e.type === 'agent_response' ? e.user_id : i}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full border border-violet-400 px-4 py-2 text-sm bg-violet-50 dark:bg-violet-950"
            >
              {e.type === 'agent_response' ? e.user_name : ''}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div
        ref={logRef}
        className="h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 p-4 font-mono text-xs flex flex-col gap-2 bg-gray-50 dark:bg-gray-900"
      >
        {events.length === 0 && <p className="text-gray-400">Waiting for agents to respond…</p>}
        {events.map((e, i) => (
          <div key={i}>
            {e.type === 'negotiation_started' && (
              <span>Negotiation started · {e.participants} agents · {e.slots} candidate slots</span>
            )}
            {e.type === 'agent_response' && (
              <span>
                {e.user_name}'s agent: top slot {e.top_slot?.datetime} (satisfaction {e.top_slot?.satisfaction}) — {e.notes}
              </span>
            )}
            {e.type === 'mediator_decision' && <span>Mediator reached a decision.</span>}
          </div>
        ))}
      </div>

      {decision && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl border border-violet-400 p-5"
        >
          <h2 className="font-medium mb-2">
            {decision.chosen_datetime ? new Date(decision.chosen_datetime).toLocaleString() : 'Escalated to humans'}
          </h2>
          <p className="text-sm text-gray-500 mb-3">{decision.explanation}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(decision.satisfaction_breakdown).map(([uid, score]) => (
              <span key={uid} className="text-xs rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1">
                {uid}: {score}
              </span>
            ))}
          </div>
        </motion.div>
      )}
      </div>
    </div>
  )
}
