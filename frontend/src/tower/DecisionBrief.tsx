import { useState } from 'react'
import { motion } from 'framer-motion'
import { errorMessage, icsUrl, sendRsvp } from '../api/client'
import type { TowerModel } from './model'

interface Props {
  eventId: string
  title: string
  model: TowerModel
  viewerId: string | null
}

function googleLink(title: string, start: string, end: string, details: string) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${fmt(start)}/${fmt(end)}`, details })
  return `https://calendar.google.com/calendar/render?${p}`
}

/** The outcome: when, why, who gave something up, the fallback, and what to do next. */
export default function DecisionBrief({ eventId, title, model, viewerId }: Props) {
  const d = model.decision!
  const [error, setError] = useState<string | null>(null)
  const mine = viewerId ? model.rsvps[viewerId] : undefined
  const joined = model.agents.some((a) => a.id === viewerId)

  async function respond(response: 'accepted' | 'declined') {
    setError(null)
    try {
      await sendRsvp(eventId, viewerId!, response)
    } catch (err) {
      setError(errorMessage(err, "Couldn't send your answer. Try again."))
    }
  }

  const when = d.slot
    ? new Date(d.slot.start).toLocaleString(undefined, {
        timeZone: model.timezone ?? undefined, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <motion.section
      aria-label="Decision"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-strip text-strip-ink border-t-4 border-clearance px-5 py-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
    >
      <h2 className="font-display font-bold text-3xl leading-[1.05] tracking-tight">
        {when ?? 'No time worked for everyone'}
      </h2>
      {d.status === 'converged' && d.minScore !== null && (
        <dl className="mt-3 flex gap-6 font-mono">
          <div>
            <dt className="text-[11px] tracking-[0.14em] text-strip-ink/65">LEAST HAPPY</dt>
            <dd className="text-2xl font-semibold tabular-nums leading-tight">{d.minScore}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-[0.14em] text-strip-ink/65">AVERAGE</dt>
            <dd className="text-2xl font-semibold tabular-nums leading-tight">{Math.round(d.avgScore ?? 0)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-[15px] leading-relaxed text-strip-ink/85">{d.explanation}</p>
      {d.question && <p className="mt-3 text-[15px] font-medium">{d.question}</p>}

      {d.compromises.length > 0 && (
        <div className="mt-4">
          <h3 className="font-mono text-[11px] tracking-[0.16em] text-clearance-dim">WHO GAVE SOMETHING UP</h3>
          <ul className="mt-1.5 space-y-1">
            {d.compromises.map((c) => (
              <li key={c.user_id} className="flex justify-between gap-3 text-sm">
                <span><span className="font-medium">{c.name}</span>: {c.gave_up}</span>
                <span className="font-mono tabular-nums text-strip-ink/65">{c.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.alternatives.length > 0 && (
        <div className="mt-4">
          <h3 className="font-mono text-[11px] tracking-[0.16em] text-strip-ink/65">IF IT FALLS THROUGH</h3>
          <ol className="mt-1.5 space-y-1 text-sm">
            {d.alternatives.map((a) => (
              <li key={a.slot_id} className="flex justify-between gap-3">
                <span>{a.label}</span>
                <span className="font-mono tabular-nums text-strip-ink/65">least happy {a.min_score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {d.status === 'converged' && d.slot && (
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={icsUrl(eventId)}
            className="inline-flex items-center h-10 px-4 rounded-[2px] bg-clearance text-strip font-mono text-xs tracking-wider hover:bg-clearance-dim transition-colors">
            ADD TO CALENDAR (.ICS)
          </a>
          <a href={googleLink(title, d.slot.start, d.slot.end, d.explanation)} target="_blank" rel="noreferrer"
            className="inline-flex items-center h-10 px-4 rounded-[2px] border border-strip-ink/30 font-mono text-xs tracking-wider hover:border-strip-ink transition-colors">
            GOOGLE CALENDAR
          </a>
          {joined && (
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <button type="button" onClick={() => respond('accepted')} aria-pressed={mine === 'accepted'}
                className={`h-10 px-4 rounded-[2px] font-mono text-xs tracking-wider border transition-colors ${
                  mine === 'accepted' ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 hover:border-strip-ink'}`}>
                {mine === 'accepted' ? "YOU'RE IN" : "I'LL BE THERE"}
              </button>
              <button type="button" onClick={() => respond('declined')} aria-pressed={mine === 'declined'}
                className={`h-10 px-4 rounded-[2px] font-mono text-xs tracking-wider border transition-colors ${
                  mine === 'declined' ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 hover:border-strip-ink'}`}>
                CAN'T MAKE IT
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-clearance-dim">{error}</p>}
    </motion.section>
  )
}
