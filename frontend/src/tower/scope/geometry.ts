import type { SlotModel } from '../model'

export interface Sector {
  dayKey: string
  label: string
  start: number // radians, clockwise from 12 o'clock
  end: number
}

export interface Layout {
  angles: Map<string, number>
  sectors: Sector[]
}

const DAY_GAP = 0.07

/** Slots go round the rim in time order, one sector per day with a small gap between days. */
export function layoutRim(slots: SlotModel[]): Layout {
  const angles = new Map<string, number>()
  const sectors: Sector[] = []
  if (slots.length === 0) return { angles, sectors }
  const days: SlotModel[][] = []
  for (const s of slots) {
    const last = days[days.length - 1]
    if (last && last[0].dayKey === s.dayKey) last.push(s)
    else days.push([s])
  }
  const usable = Math.PI * 2 - DAY_GAP * days.length
  const step = usable / slots.length
  let a = -Math.PI / 2 + DAY_GAP / 2
  for (const day of days) {
    const start = a
    for (const s of day) {
      angles.set(s.id, a + step / 2)
      a += step
    }
    sectors.push({ dayKey: day[0].dayKey, label: day[0].dayLabel, start, end: a })
    a += DAY_GAP
  }
  return { angles, sectors }
}

export function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
}

/**
 * Where an agent sits, as a fraction of the fix radius. Bearing: toward the times it
 * wants most (a sharp softmax over scores, or its single favourite when its top picks
 * are spread around the clock). Range: how much it prefers that over everything else,
 * so a picky agent flies out near its fix and an easy-going one stays near the tower.
 * Agents that want the same time end up in the same sector.
 */
export function scoreTarget(scores: Record<string, number>, layout: Layout, open: Set<string>): [number, number] {
  const entries = Object.entries(scores).filter(([id]) => open.has(id) && layout.angles.has(id))
  if (entries.length === 0) return [0, 0]
  const top = Math.max(...entries.map(([, s]) => s))
  const mean = entries.reduce((sum, [, s]) => sum + s, 0) / entries.length
  let x = 0
  let y = 0
  let total = 0
  let bestAngle = 0
  for (const [id, score] of entries) {
    const angle = layout.angles.get(id)!
    if (score === top) bestAngle = angle
    const w = Math.exp((score - top) / 5)
    x += Math.cos(angle) * w
    y += Math.sin(angle) * w
    total += w
  }
  const resultant = Math.hypot(x, y) / total
  const bearing = resultant < 0.45 ? bestAngle : Math.atan2(y, x)
  const conviction = Math.min(1, Math.max(0, (top - mean) / 35))
  const range = 0.4 + 0.42 * conviction
  return [Math.cos(bearing) * range, Math.sin(bearing) * range]
}

/** Nudge points apart so blips and tags don't stack; a few relaxation passes are enough. */
export function separate(points: Map<string, [number, number]>, minDist: number): Map<string, [number, number]> {
  const ids = [...points.keys()]
  const p = new Map(ids.map((id) => [id, [...points.get(id)!] as [number, number]]))
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = p.get(ids[i])!
        const b = p.get(ids[j])!
        let dx = b[0] - a[0]
        let dy = b[1] - a[1]
        let d = Math.hypot(dx, dy)
        if (d >= minDist) continue
        if (d < 1e-6) {
          // Identical targets: fan out deterministically by index.
          const t = (j * 2.399) % (Math.PI * 2)
          d = 1e-3
          dx = Math.cos(t) * d
          dy = Math.sin(t) * d
        }
        const push = (minDist - d) / 2
        a[0] -= (dx / d) * push
        a[1] -= (dy / d) * push
        b[0] += (dx / d) * push
        b[1] += (dy / d) * push
      }
    }
  }
  return p
}
