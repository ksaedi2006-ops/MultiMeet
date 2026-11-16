import { useState } from 'react'
import { errorMessage, startNegotiation, type EventInfo } from '../api/client'
import type { TowerModel } from './model'

interface Props {
  event: EventInfo
  model: TowerModel
  viewerId: string | null
}

/** Before the negotiation: who has checked in, and the organiser's Start control. */
export default function HoldingPanel({ event, model, viewerId }: Props) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = model.agents.filter((a) => a.ready)
  const waiting = model.agents.filter((a) => !a.ready)
  const organiser = viewerId === event.organizer_id

  async function start() {
    setError(null)
    setStarting(true)
    try {
      await startNegotiation(event.event_id, viewerId!)
    } catch (err) {
      setError(errorMessage(err, "Couldn't start the negotiation. Check the backend is running and try again."))
      setStarting(false)
    }
  }

  return (
    <section aria-label="Check-in status" className="border border-board-line rounded-[2px] px-4 py-4 bg-board-raised/60">
      <p className="font-display font-bold text-2xl leading-tight text-strip">
        {ready.length} of {model.agents.length} checked in
      </p>
      <p className="mt-1 text-sm text-strip/75 leading-relaxed">
        {waiting.length === 0
          ? 'Everyone has briefed their agent.'
          : `Still briefing: ${waiting.map((a) => a.name.split(' ')[0]).join(', ')}.`}{' '}
        Only checked-in agents take part.
      </p>
      {organiser ? (
        <>
          <button
            type="button"
            onClick={start}
            disabled={starting || ready.length === 0}
            className="mt-4 w-full h-11 rounded-[2px] bg-clearance text-strip font-mono text-sm tracking-wider hover:bg-clearance-dim disabled:bg-clearance/40 disabled:cursor-not-allowed transition-colors"
          >
            {starting ? 'STARTING…' : waiting.length ? `START WITH ${ready.length}` : 'START NEGOTIATION'}
          </button>
          {ready.length === 0 && <p className="mt-2 text-xs text-mist">Check in yourself first from the briefing step.</p>}
        </>
      ) : (
        <p className="mt-3 font-mono text-xs tracking-wider text-mist">THE ORGANISER STARTS THE NEGOTIATION</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-signal">{error}</p>}
    </section>
  )
}
