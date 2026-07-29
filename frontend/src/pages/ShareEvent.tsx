import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getEvent, listEventMembers, type Event, type Member } from '../api/client'
import { useNegotiationSocket } from '../api/useNegotiationSocket'
import StepHeader from '../components/StepHeader'
import Paper from '../components/Paper'
import Button from '../components/Button'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return chars.toUpperCase()
}

export default function ShareEvent() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [copied, setCopied] = useState(false)
  const { events } = useNegotiationSocket(eventId || null)

  useEffect(() => {
    getEvent(eventId).then(setEvent)
    listEventMembers(eventId).then(setMembers)
  }, [eventId])

  useEffect(() => {
    setMembers((prev) => {
      let next = prev
      for (const e of events) {
        if (e.type !== 'member_joined') continue
        if (next.some((m) => m.user_id === e.user_id)) continue
        next = [...next, { user_id: e.user_id, name: e.user_name, role: 'member', ready: false }]
      }
      return next
    })
  }, [events])

  const shareLink = event ? `${window.location.origin}/join/${event.invite_code}` : ''

  function handleCopy() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <StepHeader step={1} />
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10">
        <Paper className="p-8 sm:p-10">
          <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-4">ROUTING</p>
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold leading-snug mb-3">Share it</h1>
          <p className="text-paper-ink/70 mb-8 leading-relaxed">
            Send this to everyone you want at <span className="font-medium">"{event?.title ?? '…'}"</span>.
            Their agents join the negotiation the moment they open it.
          </p>

          <div className="border border-paper-ink/20 rounded-sm px-4 py-3 flex items-center gap-3 mb-8 bg-paper-dim/40">
            <span className="flex-1 font-mono text-xs sm:text-sm truncate">{shareLink || '…'}</span>
            <button
              onClick={handleCopy}
              className="font-mono text-xs tracking-wider shrink-0 text-seal hover:text-seal-dim transition-colors"
            >
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>
          </div>

          <div className="border border-paper-ink/20 rounded-sm overflow-hidden mb-8">
            <div className="bg-paper-dim/40 px-4 py-2 border-b border-paper-ink/20 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.2em] text-paper-ink/50">ROSTER</span>
              <span className="font-mono text-[10px] tracking-[0.2em] text-paper-ink/50">
                {members.length} JOINED
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <AnimatePresence initial={false}>
                {members.map((m) => (
                  <motion.div
                    key={m.user_id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-paper-ink/10 last:border-b-0"
                  >
                    <span className="w-7 h-7 rounded-full bg-seal/10 border border-seal/40 text-seal flex items-center justify-center font-mono text-[10px] font-semibold shrink-0">
                      {initials(m.name || m.user_id)}
                    </span>
                    <span className="font-mono text-sm flex-1">{m.name || m.user_id.slice(0, 8)}</span>
                    {m.role === 'admin' ? (
                      <span className="font-mono text-[10px] tracking-widest text-brass">ORGANIZER</span>
                    ) : (
                      <span className="font-mono text-[10px] tracking-widest text-paper-ink/40">JOINED</span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {members.length === 0 && (
                <p className="font-mono text-xs text-paper-ink/40 px-4 py-4">Waiting for the first arrival…</p>
              )}
            </div>
          </div>

          <Button onClick={() => navigate(`/event/${eventId}/upload`)} className="w-full">
            CONTINUE — SET UP MY AGENT →
          </Button>
        </Paper>
      </div>
    </div>
  )
}
