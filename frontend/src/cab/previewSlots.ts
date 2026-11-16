import type { SlotModel } from '../tower/model'

const STEPS = [30, 60, 90, 120, 180, 240]
const MAX = 72

export interface PlanWindow {
  start: string // YYYY-MM-DD
  end: string
  duration: number
  earliest: number
  latest: number
  weekdays: number[] // 0 = Monday
  tz?: string // the meeting's time zone; times are real instants in it when given
}

/** Minutes east of UTC for a zone at a given instant. */
function offsetMinutes(utcMs: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((asUtc - utcMs) / 60000)
}

/** The UTC instant of a wall-clock time in a zone (two passes settle DST edges). */
function zoned(dayMs: number, minutes: number, tz?: string): number {
  const wall = dayMs + minutes * 60000
  if (!tz) return wall
  let utc = wall - offsetMinutes(wall, tz) * 60000
  utc = wall - offsetMinutes(utc, tz) * 60000
  return utc
}

function dayLabel(d: Date) {
  return `${d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })} ${d.getUTCDate()}`
}

/**
 * The candidate times the backend will search, worked out in the browser so the scope can
 * show them while the plan is being filled in. Same rule as app/scheduling/slots.py: clock-
 * aligned starts inside the daily window on allowed days, with the step widened until the
 * whole range fits in 72.
 */
export function previewSlots(w: PlanWindow): SlotModel[] {
  const first = Date.parse(`${w.start}T00:00:00Z`)
  const last = Date.parse(`${w.end}T00:00:00Z`)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return []
  const days = Math.min(62, Math.round((last - first) / 86400000) + 1)
  let out: SlotModel[] = []
  for (const step of STEPS) {
    if (step < Math.min(w.duration, 60) && step !== STEPS[STEPS.length - 1]) continue
    out = []
    for (let i = 0; i < days; i++) {
      const day = new Date(first + i * 86400000)
      if (!w.weekdays.includes((day.getUTCDay() + 6) % 7)) continue
      const key = day.toISOString().slice(0, 10)
      for (let m = w.earliest * 60; m + w.duration <= w.latest * 60; m += step) {
        const hh = Math.floor(m / 60)
        const mm = m % 60
        const at = new Date(zoned(day.getTime(), m, w.tz))
        out.push({
          id: `${key}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`,
          start: at.toISOString(),
          end: new Date(at.getTime() + w.duration * 60000).toISOString(),
          label: `${day.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}, ${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`,
          index: out.length,
          dayKey: key,
          dayLabel: dayLabel(day),
          closed: false,
          blockers: [],
          rank: null,
        })
      }
    }
    if (out.length <= MAX) return out
  }
  return out.slice(0, MAX)
}
