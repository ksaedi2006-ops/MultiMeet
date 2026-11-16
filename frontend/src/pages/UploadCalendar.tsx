import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  currentUserId, errorMessage, getCalendar, getOrCreateUserId, setEventKind, uploadCalendar,
  fillSampleCalendar, type CalendarInfo,
} from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import Button from '../components/Button'
import StepHeader from '../components/StepHeader'
import WeekView, { mondayOf } from '../components/WeekView'
import { rise, stagger } from '../lib/motion'

export default function UploadCalendar() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { event, organiser } = useEventInfo(eventId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const [week, setWeek] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState<'file' | 'sample' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tz = event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    const id = currentUserId()
    if (id) getCalendar(id).then(setCalendar, () => undefined)
  }, [])

  // Open on the first week that actually has something in it, else the event's first week.
  useEffect(() => {
    if (week || !event) return
    const first = event.start_date
    setWeek(mondayOf(first))
  }, [event, week])

  const events = calendar?.events ?? []
  const titles = useMemo(() => {
    const map = new Map<string, { title: string; kind: 'hard' | 'soft'; count: number }>()
    for (const e of events) {
      const cur = map.get(e.title)
      if (cur) cur.count++
      else map.set(e.title, { title: e.title, kind: e.kind, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [events])
  const hard = titles.filter((t) => t.kind === 'hard').length
  const soft = titles.length - hard

  async function load(file: File) {
    setError(null)
    setBusy('file')
    try {
      const userId = await getOrCreateUserId()
      setCalendar(await uploadCalendar(userId, await file.text(), file.name, eventId))
    } catch (err) {
      setError(errorMessage(err, "Couldn't read that file. Export an .ics calendar and try again."))
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
    const id = currentUserId()
    if (!id) return
    try {
      setCalendar(await setEventKind(id, title, kind))
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

  const next = () => navigate(`/event/${eventId}/agent`)

  return (
    <div>
      <StepHeader current="manifest" organiser={organiser} />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-24 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="min-w-0">
          <motion.h1 variants={rise} className="font-display font-bold text-5xl sm:text-6xl leading-[0.95] tracking-tight text-strip">
            Show your agent your week
          </motion.h1>
          <motion.p variants={rise} className="mt-4 text-[17px] leading-relaxed text-strip/85 max-w-[30rem]">
            Classes, shifts and plans already made become hard blocks the scheduler enforces before anyone
            argues. Export an .ics file from Google, Outlook or Apple Calendar.
          </motion.p>

          <motion.div variants={rise}>
            <div
              role="button" tabIndex={0} aria-label="Choose an .ics calendar file"
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void load(file)
              }}
              className={`mt-7 rounded-[2px] border-2 border-dashed px-6 py-9 text-center cursor-pointer transition-colors ${
                dragging ? 'border-amber bg-amber/10' : 'border-board-line hover:border-mist'}`}>
              <input ref={fileInput} type="file" accept=".ics,text/calendar" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = '' }} />
              <p className="font-display font-bold text-2xl text-strip">
                {busy === 'file' ? 'Reading…' : dragging ? 'Drop it here' : 'Drop an .ics file here'}
              </p>
              <p className="mt-1 text-sm text-mist">or click to choose one</p>
            </div>
          </motion.div>

          <motion.div variants={rise} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={sample} disabled={busy !== null}
              className="font-mono text-xs tracking-wider text-amber hover:underline underline-offset-4 disabled:opacity-50">
              {busy === 'sample' ? 'BUILDING A WEEK…' : 'USE A SAMPLE WEEK INSTEAD'}
            </button>
          </motion.div>
          {error && <p role="alert" className="mt-3 text-sm text-signal">{error}</p>}

          <AnimatePresence>
            {calendar && calendar.uploaded_at && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-8" aria-live="polite" aria-label="What was read from the calendar">
                {events.length === 0 ? (
                  <p className="text-[16px] text-signal leading-relaxed">
                    That file had nothing in the coming weeks, so your agent has no hard blocks to enforce.
                    Check you exported the right calendar.
                  </p>
                ) : (
                  <>
                    <p className="font-display font-bold text-3xl tracking-tight text-strip leading-tight">
                      {events.length} busy blocks
                      <span className="text-mist font-normal text-xl"> · {hard} fixed, {soft} movable commitments</span>
                    </p>
                    <ul className="mt-4 divide-y divide-board-line border-y border-board-line max-h-64 overflow-y-auto">
                      {titles.map((t) => (
                        <li key={t.title} className="flex items-center gap-3 py-2">
                          <span className="flex-1 min-w-0 truncate text-strip">{t.title}</span>
                          <span className="font-mono text-[11px] text-mist tabular-nums">×{t.count}</span>
                          <button type="button" aria-pressed={t.kind === 'soft'} onClick={() => flip(t.title, t.kind === 'soft' ? 'hard' : 'soft')}
                            className={`w-[5.25rem] h-7 rounded-[2px] font-mono text-[11px] tracking-wider border transition-colors ${
                              t.kind === 'soft' ? 'border-amber text-amber' : 'border-board-line text-strip hover:border-mist'}`}>
                            {t.kind === 'soft' ? 'MOVABLE' : 'FIXED'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-5">
            <Button arrow onClick={next}>CONTINUE</Button>
            {!calendar?.uploaded_at && (
              <button type="button" onClick={next} className="font-mono text-xs tracking-wider text-mist hover:text-strip transition-colors">
                SKIP FOR NOW
              </button>
            )}
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} className="min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-2xl tracking-tight text-strip">{weekLabel || 'Your week'}</h2>
            <div className="flex gap-1.5">
              {([-1, 1] as const).map((d) => (
                <button key={d} type="button" onClick={() => shiftWeek(d)} aria-label={d < 0 ? 'Previous week' : 'Next week'}
                  className="w-9 h-9 flex items-center justify-center rounded-[2px] border border-board-line text-strip hover:border-amber hover:text-amber transition-colors">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={d < 0 ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          {week && <WeekView events={events} tz={tz} weekStart={week} onToggle={flip} />}
          <p className="mt-3 text-sm text-mist">
            <span className="inline-block w-3 h-3 align-[-2px] mr-1.5 bg-strip rounded-[1px]" />Fixed
            <span className="inline-block w-3 h-3 align-[-2px] ml-5 mr-1.5 rounded-[1px]"
              style={{ background: 'repeating-linear-gradient(135deg, rgba(236,223,194,0.62) 0 3px, rgba(236,223,194,0.28) 3px 6px)' }} />
            Movable. Click any block to switch.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
