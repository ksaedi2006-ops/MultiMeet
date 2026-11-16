import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  createEvent, errorMessage, getOrCreateUserId, getSavedName, setUserName,
} from '../api/client'
import Button from '../components/Button'
import Field, { inputClass } from '../components/Field'
import StepHeader from '../components/StepHeader'
import Strip from '../components/Strip'
import WindowPreview from '../components/WindowPreview'
import { rise, stagger } from '../lib/motion'
import { rememberEvent } from '../lib/recents'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LENGTHS = [30, 45, 60, 90, 120]

const dayOffset = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

function hourLabel(h: number) {
  const hh = h % 24
  return `${hh % 12 === 0 ? 12 : hh % 12}:00 ${hh < 12 ? 'AM' : 'PM'}`
}

const zones = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return [Intl.DateTimeFormat().resolvedOptions().timeZone]
  }
})()

export default function CreateEvent() {
  const navigate = useNavigate()
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
  const [error, setError] = useState<string | null>(null)

  const problem = useMemo(() => {
    if (end < start) return 'The last day is before the first day.'
    if (weekdays.length === 0) return 'Pick at least one day of the week.'
    if ((latest - earliest) * 60 < duration) return 'The daily window is shorter than the meeting.'
    return null
  }, [start, end, weekdays, earliest, latest, duration])

  const toggleDay = (d: number) =>
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))

  async function handleSubmit(e: React.FormEvent) {
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
      navigate(`/event/${event.event_id}/share`, { state: { filed: true } })
    } catch (err) {
      setError(errorMessage(err, "Couldn't reach the backend. Check that it's running, then try again."))
      setLoading(false)
    }
  }

  const select = `${inputClass} text-base [color-scheme:light] cursor-pointer`
  const chip = (on: boolean) =>
    `h-9 px-3 rounded-[2px] font-mono text-xs tracking-wider border transition-colors ${
      on ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 text-strip-ink hover:border-strip-ink'}`

  return (
    <div>
      <StepHeader current="plan" />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-24 grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <motion.form onSubmit={handleSubmit} variants={stagger(0.06)} initial="hidden" animate="show" className="min-w-0">
          <motion.h1 variants={rise} className="font-display font-bold text-5xl sm:text-6xl leading-[0.95] tracking-tight text-strip">
            What are we scheduling?
          </motion.h1>
          <motion.p variants={rise} className="mt-4 mb-8 text-[17px] leading-relaxed text-strip/85 max-w-[32rem]">
            File the plan once. Your agent and everyone else’s do the searching.
          </motion.p>

          <motion.div variants={rise}>
            <Strip className="p-6 sm:p-8 flex flex-col gap-7">
              <div className="grid gap-7 sm:grid-cols-2">
                <Field label="Title">
                  <input autoFocus required className={inputClass} placeholder="CS Club weekly meeting"
                    value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </Field>
                <Field label="Your name">
                  <input required className={inputClass} placeholder="Ava Chen"
                    value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                </Field>
              </div>

              <div className="grid gap-7 sm:grid-cols-2">
                <Field label="Search from">
                  <input type="date" required className={`${select}`} value={start} min={dayOffset(0)}
                    onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="Search until">
                  <input type="date" required className={`${select}`} value={end} min={start}
                    onChange={(e) => setEnd(e.target.value)} />
                </Field>
              </div>

              <fieldset>
                <legend className="font-mono text-[11px] tracking-[0.14em] text-strip-ink/70 uppercase">Meeting length</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LENGTHS.map((m) => (
                    <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDuration(m)} className={chip(duration === m)}>
                      {m < 60 ? `${m} MIN` : `${m / 60} HR`}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-7 sm:grid-cols-2">
                <Field label="Earliest start">
                  <select className={select} value={earliest} onChange={(e) => setEarliest(Number(e.target.value))}>
                    {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                      <option key={h} value={h}>{hourLabel(h)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Must end by">
                  <select className={select} value={latest} onChange={(e) => setLatest(Number(e.target.value))}>
                    {Array.from({ length: 16 }, (_, i) => i + 9).map((h) => (
                      <option key={h} value={h}>{hourLabel(h)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <fieldset>
                <legend className="font-mono text-[11px] tracking-[0.14em] text-strip-ink/70 uppercase">Days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((d, i) => (
                    <button key={d} type="button" aria-pressed={weekdays.includes(i)} onClick={() => toggleDay(i)}
                      className={chip(weekdays.includes(i))}>
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field label="Time zone">
                <select className={select} value={tz} onChange={(e) => setTz(e.target.value)}>
                  {(zones.includes(tz) ? zones : [tz, ...zones]).map((z) => (
                    <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </Field>

              {problem && <p role="alert" className="text-sm text-clearance-dim -mt-2">{problem}</p>}
              <Button arrow={!loading} disabled={loading || Boolean(problem)} className="self-start">
                {loading ? 'FILING…' : 'FILE THE PLAN'}
              </Button>
            </Strip>
          </motion.div>
          {error && <p role="alert" className="mt-4 text-sm text-signal">{error}</p>}
        </motion.form>

        <motion.aside initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} className="min-w-0 lg:pt-28">
          <h2 className="font-display font-bold text-2xl tracking-tight text-strip mb-4">The times it will search</h2>
          <WindowPreview start={start} end={end} earliest={earliest} latest={latest} weekdays={weekdays} duration={duration} />
        </motion.aside>
      </div>
    </div>
  )
}
