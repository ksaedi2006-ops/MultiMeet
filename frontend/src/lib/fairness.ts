import type { SlotModel, TowerModel } from '../tower/model'

/**
 * The same rule the backend solver uses, on the scores the screen already has: a time's
 * strength is the sum of log(0.05 + score) over everyone, so one unhappy person costs a time
 * far more than one happy person earns it. Ties go to the better-off least-happy person.
 */
const EPS = 0.05

export interface TimeStanding {
  slot: SlotModel
  scores: Record<string, number> // user id -> 0..100
  min: number
  avg: number
  nash: number
  lowest: string | null // user id of the least happy person
}

export function standing(slot: SlotModel, scores: Record<string, number>): TimeStanding {
  const entries = Object.entries(scores)
  const vals = entries.map(([, v]) => v)
  const min = vals.length ? Math.min(...vals) : 0
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const nash = vals.reduce((a, v) => a + Math.log(EPS + v / 100), 0)
  const lowest = entries.length ? entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0] : null
  return { slot, scores, min, avg, nash, lowest }
}

const byRule = (a: TimeStanding, b: TimeStanding) =>
  b.nash - a.nash || b.min - a.min || b.avg - a.avg || a.slot.index - b.slot.index

/**
 * Every open time with everyone's current score, best first. The backend's shortlist is the
 * authority for the times it covers (it has the scores after concessions); the rest come from
 * each agent's ratings.
 */
export function rankTimes(model: TowerModel): TimeStanding[] {
  const people = Object.keys(model.scores)
  if (!people.length) return []
  const latest = new Map(model.shortlist.map((r) => [r.slot_id, r.scores]))
  const out: TimeStanding[] = []
  for (const slot of model.slots) {
    if (slot.closed) continue
    const fromShortlist = latest.get(slot.id)
    const scores: Record<string, number> = {}
    for (const uid of people) {
      const v = fromShortlist?.[uid] ?? model.scores[uid]?.[slot.id]
      if (v !== undefined) scores[uid] = v
    }
    if (Object.keys(scores).length === people.length) out.push(standing(slot, scores))
  }
  return out.sort(byRule)
}

/** The time with the highest average: what a simple vote would pick. */
export function mostPopular(times: TimeStanding[]): TimeStanding | null {
  return times.reduce<TimeStanding | null>((best, t) => (!best || t.avg > best.avg + 1e-9 ? t : best), null)
}

/** Each person's favourite open time. */
export function favourites(model: TowerModel): Map<string, SlotModel> {
  const out = new Map<string, SlotModel>()
  const open = model.slots.filter((s) => !s.closed)
  for (const [uid, row] of Object.entries(model.scores)) {
    let best: SlotModel | null = null
    for (const s of open) if (row[s.id] !== undefined && (!best || row[s.id] > row[best.id])) best = s
    if (best) out.set(uid, best)
  }
  return out
}

export type Mood = 'likes' | 'okay' | 'dislikes'
export const mood = (score: number): Mood => (score >= 70 ? 'likes' : score >= 40 ? 'okay' : 'dislikes')
export const MOOD_RING: Record<Mood, string> = {
  likes: 'var(--color-amber)',
  okay: 'var(--color-mist)',
  dislikes: 'var(--color-clearance)',
}
export const MOOD_WORD: Record<Mood, string> = { likes: 'Likes it', okay: 'It’s okay', dislikes: 'Dislikes it' }
