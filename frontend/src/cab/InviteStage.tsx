import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { addSamplePeople, currentUserId, errorMessage, type Member } from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import { useEventLog } from '../api/useEventLog'
import Stamp from '../components/Stamp'
import { EASE } from '../lib/motion'
import { buildModel } from '../tower/model'
import BayStrip, { Box } from './BayStrip'
import { useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'

const SIZES = [6, 12, 24] as const

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

/**
 * Invite people. The ring keeps the times from the New meeting step; every person who
 * joins gets a card that slides into the left panel while their dot arrives on the scope.
 */
export default function InviteStage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const filed = Boolean((useLocation().state as { filed?: boolean } | null)?.filed)
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { event, failed, organiser } = useEventInfo(eventId)
  const viewerId = currentUserId()
  const { events } = useEventLog(eventId || null, viewerId)
  const [copied, setCopied] = useState(false)
  const [size, setSize] = useState<(typeof SIZES)[number]>(12)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const members = useMemo(() => {
    const byId = new Map<string, Member>()
    for (const e of events) {
      if (e.type === 'member_joined' || e.type === 'member_updated') {
        const { user_id, name, role, ready, calendar_events, rules } = e
        byId.set(user_id, { user_id, name, role, ready, calendar_events, rules })
      }
    }
    return [...byId.values()]
  }, [events])

  // The people come from the live log; the ring keeps the times the meeting will search.
  const model = useMemo(() => {
    const live = buildModel(events)
    if (!event || live.slots.length) return live
    const slots = previewSlots({
      start: event.start_date, end: event.end_date, duration: event.duration_minutes,
      earliest: event.earliest_hour, latest: event.latest_hour, weekdays: event.weekdays,
    })
    return { ...live, slots }
  }, [events, event])

  const ready = members.filter((m) => m.ready).length
  useScopeFeed({
    model,
    label: `${members.length} people have joined; ${ready} are ready. Their agents wait in the middle of the scope.`,
    legend: 'Each dot is someone who has joined. Their agents wait in the middle until the negotiation starts.',
  })

  const shareLink = event ? `${window.location.origin}/join/${event.invite_code}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      // Plain-HTTP origins can't use the clipboard API; fall back to selecting the field.
      const input = document.getElementById('share-link') as HTMLInputElement | null
      input?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function addPeople() {
    setError(null)
    setAdding(true)
    try {
      await addSamplePeople(eventId, viewerId!, size)
    } catch (err) {
      setError(errorMessage(err, "Couldn't add sample people."))
    } finally {
      window.setTimeout(() => setAdding(false), 1200)
    }
  }

  if (failed) {
    return panel ? createPortal(
      <div className="px-5 lg:px-6 py-8">
        <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] text-strip">This meeting doesn’t exist</h1>
        <p className="mt-3 text-strip/80">The link may be mistyped, or the meeting was removed.</p>
      </div>, panel) : null
  }

  const people = (
    <div className="px-4 lg:px-5 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display font-bold text-[1.6rem] leading-none text-strip">People</h2>
        <span className="text-[13px] text-mist tabular-nums" aria-live="polite">
          {members.length} joined · {ready} ready
        </span>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {members.map((m) => (
            <motion.li key={m.user_id} layout="position"
              initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: EASE }}>
              <BayStrip holder={m.role === 'admin' ? 'plan' : 'event'}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
                  <Box>
                    <span className="block truncate text-[16px] font-semibold text-strip-ink leading-tight">
                      {m.name}
                      {m.user_id === viewerId && <span className="font-normal text-strip-ink/60"> (you)</span>}
                    </span>
                    <span className="mt-1 block text-[13px] text-strip-ink/70">
                      {[m.role === 'admin' ? 'Organiser' : null,
                        m.calendar_events > 0 ? 'Calendar added' : 'No calendar yet',
                        m.rules > 0 ? `${m.rules} ${m.rules === 1 ? 'preference' : 'preferences'}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </Box>
                  <Box className="flex items-center">
                    <span className={`text-[13px] font-semibold ${m.ready ? 'text-clearance-dim' : 'text-strip-ink/55'}`}>
                      {m.ready ? 'Ready' : 'Setting up'}
                    </span>
                  </Box>
                </div>
              </BayStrip>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {members.length <= 1 && (
        <p className="mt-4 text-[14px] leading-relaxed text-mist">
          When someone opens your link, their card appears here and their dot arrives on the scope.
        </p>
      )}
    </div>
  )

  const invite = (
    <div className="px-5 lg:px-6 py-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] tracking-tight text-strip">Invite people</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-strip/80">
            Send this link to everyone you want in “{event?.title ?? '…'}”.
          </p>
        </div>
        {filed && <div className="pt-1 shrink-0"><Stamp label="CREATED" size="md" /></div>}
      </div>

      <div className="flex items-stretch border border-board-line rounded-[2px] overflow-hidden bg-black/20">
        <input id="share-link" readOnly value={shareLink} aria-label="Invite link"
          className="flex-1 min-w-0 bg-transparent px-3 py-3 font-mono text-[13px] text-strip outline-none"
          onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy}
          className="px-4 font-mono text-xs tracking-wider border-l border-board-line text-strip hover:text-amber transition-colors">
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <p className="sr-only" role="status">{copied ? 'Invite link copied' : ''}</p>

      {organiser && (
        <BayStrip holder="sim">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
            <Box>
              <span className="block font-display font-bold text-[22px] leading-none text-strip-ink">No one to invite?</span>
              <span className="mt-1.5 block text-[14px] leading-snug text-strip-ink/80">
                Add {size} invented students with realistic weeks.
              </span>
              <div role="radiogroup" aria-label="How many sample people" className="mt-2.5 flex gap-1.5">
                {SIZES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}
                    className={`min-w-9 h-7 px-2 rounded-[2px] font-mono text-xs border transition-colors ${
                      size === n ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 text-strip-ink hover:border-strip-ink'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </Box>
            <button type="button" onClick={addPeople} disabled={adding}
              className="bg-strip-ink text-strip px-3.5 font-mono text-[11px] tracking-[0.14em] hover:bg-board transition-colors disabled:opacity-60">
              {adding ? 'ADDING' : 'ADD'}
            </button>
          </div>
        </BayStrip>
      )}
      {error && <p role="alert" className="-mt-3 text-sm text-signal">{error}</p>}

      <button type="button" onClick={() => navigate(`/event/${eventId}/upload`)}
        className="self-start inline-flex items-center gap-2.5 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
        NEXT: YOUR CALENDAR <Arrow />
      </button>
    </div>
  )

  return (
    <>
      {bay && createPortal(people, bay)}
      {panel && createPortal(invite, panel)}
    </>
  )
}
