import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, type Event } from '../api/client'
import StepHeader from '../components/StepHeader'
import Paper from '../components/Paper'
import Button from '../components/Button'

export default function ShareEvent() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getEvent(eventId).then(setEvent)
  }, [eventId])

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

          <Button onClick={() => navigate(`/event/${eventId}/upload`)} className="w-full">
            CONTINUE — SET UP MY AGENT →
          </Button>
        </Paper>
      </div>
    </div>
  )
}
