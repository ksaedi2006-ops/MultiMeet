import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  currentUserId, errorMessage, fillSampleCalendar, getCalendar, getOrCreateUserId, setEventKind, uploadCalendar,
  type CalendarInfo,
} from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import { useEventLog } from '../api/useEventLog'
import WeekView, { mondayOf } from '../components/WeekView'
import { EASE } from '../lib/motion'
import { buildModel } from '../tower/model'
import { play, useGrowth } from '../lib/sound'
import { useCab, useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'
import { pointVerb } from '../lib/timeLabels'
import { fetchGoogleCalendar, googleConfigured } from '../lib/googleCalendar'

const NO_EVENTS: never[] = []

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

/**
 * Your calendar. As soon as a calendar arrives, every time it rules out is crossed out on
 * the ring, one after another, with the commitment that blocked it. Flipping a commitment
 * to movable reopens its times; flipping it back crosses them out again.
 */
export default function CalendarStage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { setHighlight } = useCab()
  const { event } = useEventInfo(eventId)
  const viewerId = currentUserId()
  const { events: log } = useEventLog(eventId || null, viewerId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const [week, setWeek] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState<'file' | 'sample' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tz = event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const finePointer = pointVerb() === 'Point at'

  useEffect(() => {
    if (viewerId) getCalendar(viewerId).then(setCalendar, () => undefined)
  }, [viewerId])
  useEffect(() => {
    if (!week && event) setWeek(mondayOf(event.start_date))
  }, [event, week])
  // Point the scope at the viewer's own dot while they work on their calendar.
  useEffect(() => {
    setHighlight(viewerId)
    return () => setHighlight(null)
  }, [setHighlight, viewerId])

  const busyEvents = useMemo(() => calendar?.events ?? NO_EVENTS, [calendar])
  const titles = useMemo(() => {
    const map = new Map<string, { title: string; kind: 'hard' | 'soft'; count: number }>()
    for (const e of busyEvents) {
      const cur = map.get(e.title)
      if (cur) cur.count++
      else map.set(e.title, { title: e.title, kind: e.kind, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [busyEvents])

  const model = useMemo(() => {
    const live = buildModel(log)
    if (!event) return live
    const me = live.agents.find((a) => a.id === viewerId)
    const slots = previewSlots({
      start: event.start_date, end: event.end_date, duration: event.duration_minutes,
      earliest: event.earliest_hour, latest: event.latest_hour, weekdays: event.weekdays, tz: event.timezone,
    }).map((s) => {
      const a = Date.parse(s.start)
      const b = Date.parse(s.end)
      const clash = busyEvents.find((e) => e.kind === 'hard' && Date.parse(e.start) < b && Date.parse(e.end) > a)
      return clash
        ? { ...s, closed: true, blockers: [{ user_id: viewerId ?? '', name: me?.name ?? 'You', reason: clash.title }] }
        : s
    })
    return { ...live, slots }
  }, [log, event, busyEvents, viewerId])

  const closed = model.slots.filter((s) => s.closed).length
  useGrowth(closed, useCallback((n: number) => play('cross', n), []))
  useScopeFeed({
    model,
    label: `${closed} of ${model.slots.length} possible times are ruled out by your calendar.`,
    legend: `Crossed-out times are ones your fixed commitments rule out. ${pointVerb()} one to see which.`,
  })

  async function load(file: File) {
    setError(null)
    setBusy('file')
    try {
      setCalendar(await uploadCalendar(await getOrCreateUserId(), await file.text(), file.name, eventId))
    } catch (err) {
      setError(errorMessage(err, "Couldn't read that file. Export an .ics calendar and try again."))
    } finally {
      setBusy(null)
    }
  }

  async function google() {
    setError(null)
    if (!googleConfigured) {
      setError('Google sign-in isn’t set up on this copy of MultiMeet yet. Add a calendar file or use a sample week.')
      return
    }
    setBusy('google')
    try {
      const { ics } = await fetchGoogleCalendar()
      setCalendar(await uploadCalendar(await getOrCreateUserId(), ics, 'google-calendar.ics', eventId))
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t read your Google Calendar.'))
    } finally {
      setBusy(null)
    }
  }

  async function sample() {
    setError(null)
    setBusy('sample')
    try {
      setCalendar(await fillSampleCalendar(await getOrCreateUserId(), eventId))
    } catch (err) {
      setError(errorMessage(err, "Couldn't make a sample calendar."))
    } finally {
      setBusy(null)
    }
  }

  async function flip(title: string, kind: 'hard' | 'soft') {
    if (!viewerId) return
    try {
      setCalendar(await setEventKind(viewerId, title, kind))
    } catch (err) {
      setError(errorMessage(err, "Couldn't update that commitment."))
    }
  }

  const shiftWeek = (n: number) => {
    if (!week) return
    const d = new Date(`${week}T12:00:00`)
    d.setDate(d.getDate() + n * 7)
    setWeek(d.toLocaleDateString('en-CA'))
  }
  const weekLabel = week
    ? (() => {
        const a = new Date(`${week}T12:00:00`)
        const b = new Date(a)
        b.setDate(b.getDate() + 6)
        const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return `${f(a)} – ${f(b)}`
      })()
    : ''

  const grid = (
    <div className="px-4 lg:px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold text-[1.6rem] leading-none text-strip">{weekLabel || 'Your week'}</h2>
        <div className="flex gap-1.5">
          {[-1, 1].map((d) => (
            <button key={d} type="button" onClick={() => shiftWeek(d)} aria-label={d < 0 ? 'Previous week' : 'Next week'}
              className="w-9 h-9 flex items-center justify-center rounded-[2px] border border-board-line text-strip/80 hover:border-amber hover:text-amber transition-colors">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d < 0 ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {week && <WeekView events={busyEvents} tz={tz} weekStart={week} onToggle={flip} />}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-mist">
        <span className="flex items-center gap-1.5"><span aria-hidden className="w-3 h-3 rounded-[1px] bg-strip" />Fixed</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[1px] bg-[repeating-linear-gradient(45deg,var(--color-strip)_0_2px,transparent_2px_5px)]" />
          Movable
        </span>
        <span>{finePointer ? 'Click' : 'Tap'} a block to switch it.</span>
      </p>
    </div>
  )

  const side = (
    <div className="px-5 lg:px-6 py-6 flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] tracking-tight text-strip">Your calendar</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-strip/80">
          Your agent only needs to know when you’re busy. Fixed commitments cross times out; movable ones are
          things your agent might offer to shift.
        </p>
      </div>

      <button type="button" onClick={google} disabled={busy !== null}
        className="inline-flex items-center justify-center gap-3 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim disabled:opacity-60 transition-colors">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.300 3-7.300Z" />
          <path fill="#fff" opacity=".85" d="M12 22c2.700 0 5-.9 6.600-2.500l-3.200-2.500c-.9.600-2 1-3.400 1-2.600 0-4.800-1.800-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22Z" />
          <path fill="#fff" opacity=".7" d="M6.400 14c-.2-.6-.3-1.300-.3-2s.1-1.400.3-2V7.400H3.100a10 10 0 0 0 0 9.200L6.400 14Z" />
          <path fill="#fff" opacity=".55" d="M12 5.900c1.500 0 2.800.5 3.800 1.500l2.900-2.900A10 10 0 0 0 3.100 7.400L6.400 10C7.200 7.700 9.400 5.900 12 5.900Z" />
        </svg>
        {busy === 'google' ? 'WAITING FOR GOOGLE…' : 'CONNECT GOOGLE CALENDAR'}
      </button>
      <p className="-mt-3 text-[13px] text-mist">
        Read-only. We only look at when you’re busy, and nothing is saved to your Google account.
      </p>
      <div className="flex items-center gap-3 text-[13px] text-mist" aria-hidden>
        <span className="h-px flex-1 bg-board-line" />or<span className="h-px flex-1 bg-board-line" />
      </div>

      <div role="button" tabIndex={0} aria-label="Choose an .ics calendar file"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void load(f) }}
        className={`cursor-pointer rounded-[2px] border border-dashed px-4 py-5 transition-colors ${
          dragging ? 'border-amber bg-amber/10' : 'border-board-line hover:border-strip/60'}`}>
        <input ref={fileInput} type="file" accept=".ics,text/calendar" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = '' }} />
        <p className="font-display font-bold text-[1.4rem] leading-none text-strip">
          {busy === 'file' ? 'Reading…' : dragging ? 'Drop it here' : 'Add your calendar file'}
        </p>
        <p className="mt-1.5 text-[13px] text-mist">
          {finePointer ? 'Drop it here or click to choose. ' : 'Tap to choose. '}
          Export it from Outlook, Apple Calendar or any other app (.ics).
        </p>
      </div>
      <div className="-mt-1 flex items-center gap-3">
        <span className="text-[14px] text-mist">No file handy?</span>
        <button type="button" onClick={sample} disabled={busy !== null}
          className="h-10 px-4 rounded-[2px] border border-strip/50 text-strip font-mono text-[12px] tracking-[0.12em] hover:border-strip disabled:opacity-50 transition-colors">
          {busy === 'sample' ? 'BUILDING A WEEK…' : 'USE A SAMPLE WEEK'}
        </button>
      </div>
      {error && <p role="alert" className="-mt-2 text-sm text-signal">{error}</p>}

      {titles.length > 0 && (
        <section aria-label="Your commitments">
          <p className="text-[14px] text-strip/85" aria-live="polite">
            <span className="text-amber font-semibold tabular-nums">{closed}</span> of {model.slots.length} possible times
            ruled out by {titles.filter((t) => t.kind === 'hard').length} fixed commitments.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-board-line border-y border-board-line">
            <AnimatePresence initial={false}>
              {titles.map((t) => (
                <motion.li key={t.title} layout="position" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE }} className="flex items-center gap-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-[15px] text-strip">{t.title}</span>
                  <span className="text-[12px] text-mist tabular-nums">×{t.count}</span>
                  <button type="button" onClick={() => flip(t.title, t.kind === 'hard' ? 'soft' : 'hard')}
                    aria-label={`${t.title} is ${t.kind === 'hard' ? 'fixed' : 'movable'}; switch it`}
                    className={`w-[5.5rem] h-8 rounded-[2px] font-mono text-[11px] tracking-[0.12em] border transition-colors ${
                      t.kind === 'hard' ? 'bg-strip text-strip-ink border-strip' : 'border-board-line text-strip/80 hover:border-strip/60'}`}>
                    {t.kind === 'hard' ? 'FIXED' : 'MOVABLE'}
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
      {calendar?.uploaded_at && busyEvents.length === 0 && (
        <p className="text-[14px] text-signal">That calendar had no events in this meeting’s dates.</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => navigate(`/event/${eventId}/agent`)}
          className="inline-flex items-center gap-2.5 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
          NEXT: YOUR PREFERENCES <Arrow />
        </button>
        {busyEvents.length === 0 && (
          <button type="button" onClick={() => navigate(`/event/${eventId}/agent`)}
            className="text-[14px] text-mist hover:text-strip underline underline-offset-4 decoration-board-line transition-colors">
            Skip, I’m free all week
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {bay && createPortal(grid, bay)}
      {panel && createPortal(side, panel)}
    </>
  )
}
