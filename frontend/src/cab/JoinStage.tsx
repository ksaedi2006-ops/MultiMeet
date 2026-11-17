import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  currentUserId, errorMessage, getEventByInvite, getOrCreateUserId, getSavedName, joinEvent, setUserName,
  type EventInfo, type Member,
} from '../api/client'
import { useEventLog } from '../api/useEventLog'
import Avatar from '../components/Avatar'
import { avatarsFor } from '../lib/avatars'
import { EASE } from '../lib/motion'
import { rememberEvent } from '../lib/recents'
import { buildModel } from '../tower/model'
import BayStrip, { Box } from './BayStrip'
import { useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'

const NEXT = [
  'Tell your agent when you’re busy, or skip it.',
  'Tell it what you will and won’t do.',
  'Say you’re ready. The organiser starts the negotiation.',
]

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

/** Opening an invite link: who is already in, the meeting's times on the ring, and a name to join with. */
export default function JoinStage() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [missing, setMissing] = useState(false)
  const [name, setName] = useState(getSavedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { events } = useEventLog(event?.event_id ?? null, currentUserId())

  useEffect(() => {
    getEventByInvite(inviteCode).then(setEvent, () => setMissing(true))
  }, [inviteCode])

  const members = useMemo(() => {
    const byId = new Map<string, Member>()
    for (const e of events) {
      if (e.type === 'member_joined' || e.type === 'member_updated') {
        const { user_id, name: n, role, ready, calendar_events, rules } = e
        byId.set(user_id, { user_id, name: n, role, ready, calendar_events, rules })
      }
    }
    return [...byId.values()]
  }, [events])

  const faces = useMemo(() => avatarsFor(members.map((m) => m.user_id)), [members])

  const model = useMemo(() => {
    const live = buildModel(events)
    if (!event || live.slots.length) return live
    return { ...live, slots: previewSlots({
      start: event.start_date, end: event.end_date, duration: event.duration_minutes,
      earliest: event.earliest_hour, latest: event.latest_hour, weekdays: event.weekdays, tz: event.timezone,
    }) }
  }, [events, event])

  const started = model.phase !== 'holding'
  const booked = model.decision?.status === 'converged' && model.decision.slot ? model.decision.slot : null
  useScopeFeed({
    model,
    label: `${members.length} people are already in this meeting.`,
    legend: booked
      ? 'This meeting is already booked. The orange line points to the time that won.'
      : started
        ? 'The negotiation is under way: dots drift toward the times people prefer; crossed-out times are ones someone can’t make.'
        : 'Each mark on the ring is a time the agents will consider. Each dot is someone already in.',
  })

  async function join(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, name)
      const joined = await joinEvent(inviteCode, userId)
      rememberEvent(joined.event_id, joined.title)
      navigate(`/event/${joined.event_id}/upload`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, "Couldn't join. Check that the backend is running, then try again."))
      setLoading(false)
    }
  }

  if (missing) {
    return panel ? createPortal(
      <div className="px-5 lg:px-6 py-8">
        <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] text-strip">This invite doesn’t work</h1>
        <p className="mt-3 text-strip/80">The link may be mistyped, or the organiser started over. Ask them to send it again.</p>
      </div>, panel) : null
  }

  const people = (
    <div className="px-4 lg:px-5 py-5">
      <h2 className="font-display font-bold text-[1.6rem] leading-none text-strip">Already in</h2>
      <ul className="mt-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {members.map((m) => (
            <motion.li key={m.user_id} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: EASE }}>
              <BayStrip holder="person">
                <Box className="flex items-center gap-3">
                  <Avatar id={faces.get(m.user_id) ?? 0} size={40} />
                  <div className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold text-strip-ink leading-tight">{m.name}</span>
                    <span className="mt-1 block text-[13px] text-strip-ink/70">
                      {m.role === 'admin' ? 'Organiser' : m.ready ? 'Ready' : 'Setting up'}
                    </span>
                  </div>
                </Box>
              </BayStrip>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )

  const whenBooked = booked
    ? new Date(booked.start).toLocaleString('en-US', {
        timeZone: model.timezone ?? undefined, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  // A link opened after the negotiation has started can't join any more: say what happened instead.
  const closed = event && started ? (
    <div className="px-5 lg:px-6 py-6 flex flex-col gap-5">
      <h1 className="font-display font-bold text-[2.6rem] leading-[0.95] tracking-tight text-strip">{event.title}</h1>
      <p className="text-[17px] leading-relaxed text-strip/90">
        {whenBooked ? <>Booked for <span className="text-amber font-semibold">{whenBooked}</span>.</>
          : model.decision ? 'The group couldn’t find a time that works for everyone.'
            : 'The negotiation has already started, so new people can’t join it.'}
      </p>
      <button type="button" onClick={() => navigate(`/event/${event.event_id}/negotiate`)}
        className="self-start inline-flex items-center gap-2.5 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
        {model.decision ? 'SEE HOW IT WAS DECIDED' : 'WATCH IT'} <Arrow />
      </button>
    </div>
  ) : null

  const form = closed ?? (
    <div className="px-5 lg:px-6 py-6 flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-[2.6rem] leading-[0.95] tracking-tight text-strip">
          {event ? event.title : '…'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-strip/80">You’re invited. Here’s what happens next.</p>
      </div>
      <ol className="flex flex-col gap-2.5">
        {NEXT.map((line, i) => (
          <li key={line} className="flex gap-3 text-[15px] leading-snug text-strip/85">
            <span className="font-mono text-[13px] text-amber tabular-nums pt-0.5">{i + 1}</span>
            {line}
          </li>
        ))}
      </ol>
      <form onSubmit={join} className="flex flex-col gap-4">
        <BayStrip holder="person">
          <Box code="Your name">
            <input autoFocus required aria-label="Your name" maxLength={60} value={name}
              onChange={(e) => setName(e.target.value)} disabled={!event} placeholder="Kofi Mensah"
              className="w-full bg-transparent text-[18px] text-strip-ink outline-none py-1" />
          </Box>
        </BayStrip>
        <button disabled={loading || !event}
          className="self-start inline-flex items-center gap-2.5 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim disabled:opacity-60 transition-colors">
          {loading ? 'JOINING…' : <>JOIN THE MEETING <Arrow /></>}
        </button>
        {error && <p role="alert" className="text-sm text-signal">{error}</p>}
      </form>
    </div>
  )

  return (
    <>
      {bay && createPortal(people, bay)}
      {panel && createPortal(form, panel)}
    </>
  )
}
