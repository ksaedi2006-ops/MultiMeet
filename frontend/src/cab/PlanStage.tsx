import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createEvent, errorMessage, getOrCreateUserId, getSavedName, setUserName } from '../api/client'
import Stamp from '../components/Stamp'
import { EASE } from '../lib/motion'
import { rememberEvent } from '../lib/recents'
import { emptyModel } from '../tower/model'
import BayStrip, { Box } from './BayStrip'
import { useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const LENGTHS = [30, 45, 60, 90, 120]

const dayOffset = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}
const hourLabel = (h: number) => (h % 24 === 0 ? 'Midnight' : h === 12 ? 'Noon' : `${h % 12} ${h % 24 < 12 ? 'AM' : 'PM'}`)

const zones = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return [Intl.DateTimeFormat().resolvedOptions().timeZone]
  }
})()

const field = 'w-full bg-transparent text-strip-ink outline-none placeholder:text-strip-ink/35'
const focusBox = 'focus-within:bg-strip-dim transition-colors'
const chip = (on: boolean) =>
  `h-8 min-w-11 px-2.5 rounded-[2px] text-[13px] border transition-colors ${
    on ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 text-strip-ink hover:border-strip-ink'}`

/**
 * Creating a meeting: the "Schedule a meeting" card slides out and opens into a paper form.
 * The scope previews the search live; every change to days, hours or length redraws the
 * times on the ring before anything is sent.
 */
export default function PlanStage() {
  const navigate = useNavigate()
  const bay = useFixture('bay')
  const [title, setTitle] = useState('')
  const [name, setName] = useState(getSavedName)
  const [start, setStart] = useState(dayOffset(1))
  const [end, setEnd] = useState(dayOffset(10))
  const [duration, setDuration] = useState(60)
  const [earliest, setEarliest] = useState(9)
  const [latest, setLatest] = useState(21)
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4])
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [loading, setLoading] = useState(false)
  const [filed, setFiled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem = useMemo(() => {
    if (end < start) return 'The last day is before the first day.'
    if (weekdays.length === 0) return 'Pick at least one day of the week.'
    if ((latest - earliest) * 60 < duration) return 'The daily window is shorter than the meeting.'
    return null
  }, [start, end, weekdays, earliest, latest, duration])

  const slots = useMemo(
    () => (problem ? [] : previewSlots({ start, end, duration, earliest, latest, weekdays, tz })),
    [problem, start, end, duration, earliest, latest, weekdays, tz],
  )
  const model = useMemo(() => ({ ...emptyModel, slots }), [slots])
  const days = new Set(slots.map((s) => s.dayKey)).size
  useScopeFeed({
    model,
    label: `Preview of the ${slots.length} possible meeting times over ${days} days.`,
    legend: 'Each mark on the ring is a time the agents will consider, grouped by day. Point at one to read it.',
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !loading && navigate('/')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, loading])

  const toggleDay = (d: number) =>
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))

  async function file(e: React.FormEvent) {
    e.preventDefault()
    if (problem) return
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, name)
      const event = await createEvent(
        { title, duration_minutes: duration, start_date: start, end_date: end, timezone: tz,
          earliest_hour: earliest, latest_hour: latest, weekdays },
        userId,
      )
      rememberEvent(event.event_id, event.title)
      setFiled(true)
      window.setTimeout(() => navigate(`/event/${event.event_id}/share`, { state: { filed: true } }), 1100)
    } catch (err) {
      setError(errorMessage(err, "Couldn't reach the backend. Check that it's running, then try again."))
      setLoading(false)
    }
  }

  const select = `${field} text-[15px] cursor-pointer [color-scheme:light] appearance-none`
  const content = (
    <div className="px-4 lg:px-6 py-5">
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.16em]">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-mist hover:text-strip transition-colors">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M13 8H3M7 4 3 8l4 4" />
          </svg>
          BACK
        </button>
        <span className="hidden lg:inline text-mist">ESC TO CANCEL</span>
      </div>
      <h1 className="mt-5 font-display font-bold text-[2.6rem] leading-[0.95] tracking-tight text-strip">New meeting</h1>
      <p className="mt-2 text-[15px] text-strip/80 max-w-[34rem]">
        Say what it’s for and when it could happen. The circle shows every time the agents will consider.
      </p>

      <form onSubmit={file} className="relative mt-5">
        <BayStrip holder="plan" layoutId="strip-fpl">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-px">
            <Box code="What’s it for" className={`col-span-2 sm:col-span-4 ${focusBox}`}>
              <input autoFocus required aria-label="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="CS Club weekly" className={`${field} font-display font-bold text-[26px] leading-tight`} />
            </Box>
            <Box code="Your name" className={`col-span-2 ${focusBox}`}>
              <input required aria-label="Your name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ava Chen" className={`${field} text-[16px] py-1.5`} />
            </Box>
            <Box code="From" className={`sm:col-span-2 ${focusBox}`}>
              <input type="date" required aria-label="Search from" value={start} min={dayOffset(0)}
                onChange={(e) => setStart(e.target.value)} className={select} />
            </Box>
            <Box code="Until" className={`sm:col-span-2 ${focusBox}`}>
              <input type="date" required aria-label="Search until" value={end} min={start}
                onChange={(e) => setEnd(e.target.value)} className={select} />
            </Box>
            <Box code="Time zone" className={`col-span-2 ${focusBox}`}>
              <select aria-label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} className={`${select} truncate`}>
                {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            </Box>
            <Box code="Length" className="col-span-2 sm:col-span-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meeting length">
                {LENGTHS.map((m) => (
                  <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDuration(m)} className={chip(duration === m)}>
                    {m < 60 ? `${m} min` : `${m / 60} hr`}
                  </button>
                ))}
              </div>
            </Box>
            <Box code="Between" className={`col-span-2 ${focusBox}`}>
              <div className="flex items-center gap-2 text-[15px] text-strip-ink">
                <select aria-label="Earliest start" value={earliest} onChange={(e) => setEarliest(Number(e.target.value))} className={`${select} !w-auto`}>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
                <span aria-hidden className="text-strip-ink/50">and</span>
                <select aria-label="Must end by" value={latest} onChange={(e) => setLatest(Number(e.target.value))} className={`${select} !w-auto`}>
                  {Array.from({ length: 16 }, (_, i) => i + 9).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </div>
            </Box>
            <Box code="Days" className="col-span-2 sm:col-span-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" aria-pressed={weekdays.includes(i)} aria-label={DAY_NAMES[i]}
                    onClick={() => toggleDay(i)} className={chip(weekdays.includes(i))}>
                    {d}
                  </button>
                ))}
              </div>
            </Box>
            <button disabled={loading || Boolean(problem)}
              className="col-span-2 min-h-14 bg-clearance text-strip font-mono text-[13px] tracking-[0.18em] flex items-center justify-center gap-2 hover:bg-clearance-dim disabled:bg-clearance/45 disabled:cursor-not-allowed transition-colors">
              {loading ? 'CREATING' : 'CREATE MEETING'}
              {!loading && (
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              )}
            </button>
          </div>
        </BayStrip>
        {filed && (
          <div className="absolute right-6 -top-4 pointer-events-none"><Stamp label="CREATED" size="md" /></div>
        )}
      </form>

      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
        className="mt-4 font-mono text-[12px] tracking-[0.12em] tabular-nums" aria-live="polite">
        {problem ? (
          <span role="alert" className="text-signal">{problem.toUpperCase()}</span>
        ) : (
          <span className="text-mist">
            <span className="text-amber">{slots.length}</span> POSSIBLE TIMES OVER {days} {days === 1 ? 'DAY' : 'DAYS'}
          </span>
        )}
      </motion.p>
      {error && <p role="alert" className="mt-2 text-sm text-signal">{error}</p>}
    </div>
  )

  return bay ? createPortal(content, bay) : null
}
