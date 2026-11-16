import type { Agent, TowerModel } from '../model'
import { layoutRim, scoreTarget, separate, type Layout } from './geometry'
import { Phosphor } from './phosphor'
import { blockerPhrase, dayAndClock, fullTime } from '../../lib/timeLabels'

const AMBER = '232,169,58'
const ORANGE = '212,85,28'
const ORANGE_TEXT = '244,132,79' // --color-signal, orange that reads as text on the glass
const MIST = '147,170,189' // --color-mist
const STRIP = '236,223,194'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const SANS = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
/** Above this many people, tags show only the name unless someone is pointed at or busy. */
const CROWD = 12

const SWEEP_PERIOD = 5200
const CLOSE_STAGGER = 45
const LAND_DELAY = 1100
const LAND_STAGGER = 520
const LAND_DURATION = 1500

interface Plane {
  x: number // position as a fraction of the fix radius, origin at the tower
  y: number
  trail: { x: number; y: number }[]
  lastTrail: number
  landStart: number | null
  landFrom: [number, number] | null
  landed: boolean
}

export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

interface Departing {
  x: number
  y: number
  at: number
}

export interface EngineOptions {
  reducedMotion: boolean
  highlight: string | null
  onLanded?: () => void
  onHover?: (agentId: string | null) => void
}

const TAU = Math.PI * 2
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2
/** Shortest signed difference between two bearings. */
const angDiff = (a: number, b: number) => ((((a - b) % TAU) + TAU * 1.5) % TAU) - TAU / 2
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** Radians since the sweep last passed this bearing; drives the phosphor "paint". */
const sinceSweep = (sweep: number, angle: number) => (((sweep - angle) % TAU) + TAU) % TAU

export class ScopeEngine {
  private ctx: CanvasRenderingContext2D
  private model: TowerModel | null = null
  private layout: Layout = { angles: new Map(), sectors: [] }
  private layoutKey = ''
  private planes = new Map<string, Plane>()
  private targets = new Map<string, [number, number]>()
  private closeFx = new Map<string, number>()
  private askFx = new Map<string, number>()
  private replyFx = new Map<string, number>()
  private decisionAt: number | null = null
  private landingOrder: string[] = []
  private landedFired = false
  private landedAt: number | null = null
  private prevSeq = 0
  private raf = 0
  private last = 0
  private size = { w: 0, h: 0, dpr: 1 }
  private opts: EngineOptions = { reducedMotion: false, highlight: null }
  private observer: ResizeObserver
  private canvas: HTMLCanvasElement
  private phosphor: Phosphor | null
  private offscreen: HTMLCanvasElement | null = null
  private frameTarget: Frame | null = null
  private frameNow: Frame | null = null
  private shown = new Map<string, number>() // displayed bearing per fix, eased toward the layout
  private bornAt = new Map<string, number>()
  private ghosts = new Map<string, { angle: number; at: number }>()
  private sectorsShown = new Map<string, { start: number; end: number; label: string; born: number }>()
  private departing: Departing[] = []
  private hoverSlot: string | null = null
  private leaders: string[] = [] // up to three open times in the lead, best first
  private leaderRects: { x: number; y: number; w: number; h: number }[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.phosphor = Phosphor.create(canvas)
    if (this.phosphor) {
      this.offscreen = document.createElement('canvas')
      this.ctx = this.offscreen.getContext('2d')!
    } else {
      this.ctx = canvas.getContext('2d')!
    }
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    canvas.addEventListener('pointermove', this.onPointer)
    canvas.addEventListener('pointerdown', this.onPointer)
    canvas.addEventListener('pointerleave', () => {
      this.hoverSlot = null
      this.opts.onHover?.(null)
    })
  }

  setOptions(opts: EngineOptions) {
    this.opts = opts
  }

  /** Where the scope should sit in the canvas. Changes ease over, like a camera move. */
  setFrame(frame: Frame) {
    this.frameTarget = frame
    if (!this.frameNow || this.opts.reducedMotion) this.frameNow = { ...frame }
  }

  start() {
    const loop = (t: number) => {
      this.frame(t)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    this.canvas.removeEventListener('pointermove', this.onPointer)
    this.canvas.removeEventListener('pointerdown', this.onPointer)
  }

  /** Feed the latest model; one-shot effects start for anything new since last time. */
  setModel(model: TowerModel) {
    const now = performance.now()
    if (model.lastSeq < this.prevSeq || (this.model && model.slots.length === 0 && this.model.slots.length > 0)) {
      this.reset()
    }
    const key = model.slots.map((s) => s.id).join(',')
    if (key !== this.layoutKey) {
      this.layout = layoutRim(model.slots)
      this.layoutKey = key
      // Fixes that left fade where they stood; new ones pop onto the rim in time order.
      for (const [id, angle] of this.shown) {
        if (!this.layout.angles.has(id)) {
          this.ghosts.set(id, { angle, at: now })
          this.shown.delete(id)
          this.bornAt.delete(id)
        }
      }
      let born = 0
      for (const s of model.slots) {
        if (!this.shown.has(s.id)) {
          this.shown.set(s.id, this.layout.angles.get(s.id)!)
          this.bornAt.set(s.id, now + Math.min(born++, 72) * 14)
        }
      }
    }

    let k = 0
    for (const s of model.slots) {
      if (s.closed && !this.closeFx.has(s.id)) this.closeFx.set(s.id, now + k++ * CLOSE_STAGGER)
    }
    for (const a of model.asks) {
      if (!this.askFx.has(a.id)) this.askFx.set(a.id, now)
      if (a.reply && !this.replyFx.has(a.id)) this.replyFx.set(a.id, now)
    }
    if (model.decision && this.decisionAt === null) {
      this.decisionAt = now
      const scores = model.decision.scores
      // Land the least-compromised first: highest score at the chosen time.
      this.landingOrder = model.agents.map((a) => a.id).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    }

    for (const agent of model.agents) {
      if (!this.planes.has(agent.id)) {
        const [x, y] = this.holdingPoint(model.agents.indexOf(agent), model.agents.length, now)
        this.planes.set(agent.id, { x, y, trail: [], lastTrail: 0, landStart: null, landFrom: null, landed: false })
      }
    }

    const open = new Set(model.slots.filter((s) => !s.closed).map((s) => s.id))
    const raw = new Map<string, [number, number]>()
    for (const agent of model.agents) {
      const scores = model.scores[agent.id]
      if (scores && model.phase !== 'escalated') raw.set(agent.id, scoreTarget(scores, this.layout, open))
    }
    this.targets = separate(raw, 0.16)
    this.leaders = this.findLeaders(model, open)
    this.model = model
    this.prevSeq = model.lastSeq
  }

  /**
   * The times in the lead: the mediator's shortlist once there is one, before that the open
   * times whose least-happy person is happiest, so the labels move as scores arrive.
   */
  private findLeaders(model: TowerModel, open: Set<string>): string[] {
    if (model.decision) return []
    const ranked = model.slots.filter((s) => s.rank && !s.closed).sort((a, b) => a.rank! - b.rank!)
    if (ranked.length) return ranked.slice(0, 3).map((s) => s.id)
    const rows = Object.values(model.scores)
    if (rows.length === 0) return []
    return [...open]
      .map((id) => {
        const vals = rows.map((r) => r[id]).filter((v): v is number => v !== undefined)
        const min = vals.length ? Math.min(...vals) : -1
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : -1
        return { id, min, avg }
      })
      .filter((x) => x.min >= 0)
      .sort((a, b) => b.min - a.min || b.avg - a.avg)
      .slice(0, 3)
      .map((x) => x.id)
  }

  private reset() {
    const now = performance.now()
    for (const p of this.planes.values()) if (!p.landed) this.departing.push({ x: p.x, y: p.y, at: now })
    this.planes.clear()
    this.closeFx.clear()
    this.askFx.clear()
    this.replyFx.clear()
    this.decisionAt = null
    this.landingOrder = []
    this.landedFired = false
    this.landedAt = null
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.size = { w: rect.width, h: rect.height, dpr }
    this.canvas.width = Math.round(rect.width * dpr)
    this.canvas.height = Math.round(rect.height * dpr)
    if (this.offscreen) {
      this.offscreen.width = this.canvas.width
      this.offscreen.height = this.canvas.height
      this.phosphor!.resize(this.canvas.width, this.canvas.height)
    }
  }

  private geometry() {
    const f = this.frameNow ?? { x: 0, y: 0, w: this.size.w, h: this.size.h }
    const S = Math.min(f.w, f.h)
    const R = S * 0.48
    return { cx: f.x + f.w / 2, cy: f.y + f.h / 2, R, Rf: R * 0.8, scale: Math.max(0.7, Math.min(1.25, S / 640)) }
  }

  /** The bearing a fix is drawn at right now (eases when the rim re-lays out). */
  private bearing(id: string): number | undefined {
    return this.shown.get(id) ?? this.layout.angles.get(id)
  }

  private ease(dt: number) {
    const reduced = this.opts.reducedMotion
    if (this.frameTarget && this.frameNow) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4.2)
      const f = this.frameNow
      const t = this.frameTarget
      f.x += (t.x - f.x) * k
      f.y += (t.y - f.y) * k
      f.w += (t.w - f.w) * k
      f.h += (t.h - f.h) * k
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6)
    for (const [id, a] of this.shown) {
      const target = this.layout.angles.get(id)
      if (target !== undefined) this.shown.set(id, a + angDiff(target, a) * k)
    }
    const now = performance.now()
    const live = new Set<string>()
    for (const sec of this.layout.sectors) {
      live.add(sec.dayKey)
      const cur = this.sectorsShown.get(sec.dayKey)
      if (!cur) {
        this.sectorsShown.set(sec.dayKey, { start: sec.start, end: sec.end, label: sec.label, born: now })
      } else {
        cur.start += angDiff(sec.start, cur.start) * k
        cur.end += angDiff(sec.end, cur.end) * k
      }
    }
    for (const key of this.sectorsShown.keys()) if (!live.has(key)) this.sectorsShown.delete(key)
  }

  private holdingPoint(i: number, n: number, now: number): [number, number] {
    const spin = this.opts.reducedMotion ? 0 : (now / 60000) * Math.PI * 2
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2 + spin
    return [Math.cos(a) * 0.46, Math.sin(a) * 0.46]
  }

  private onPointer = (e: PointerEvent) => {
    if (!this.model) return
    const rect = this.canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const { cx, cy, Rf } = this.geometry()
    let best: string | null = null
    let bestD = 18
    for (const [id, p] of this.planes) {
      if (p.landed) continue
      const d = Math.hypot(cx + p.x * Rf - px, cy + p.y * Rf - py)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    this.opts.onHover?.(best)
    // Not on a dot: the nearest time on the ring, if the pointer is close to it.
    this.hoverSlot = null
    if (best) return
    let bestSlot: string | null = null
    let bestSlotD = 16
    for (const s of this.model.slots) {
      const a = this.bearing(s.id)
      if (a === undefined) continue
      const d = Math.hypot(cx + Math.cos(a) * Rf - px, cy + Math.sin(a) * Rf - py)
      if (d < bestSlotD) {
        bestSlotD = d
        bestSlot = s.id
      }
    }
    this.hoverSlot = bestSlot
  }

  // ---------- frame ----------

  private frame(now: number) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000)
    this.last = now
    const { ctx } = this
    const { w, h, dpr } = this.size
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (w === 0) return
    this.ease(dt)

    const g = this.geometry()
    const sweep = this.opts.reducedMotion ? null : (((now % SWEEP_PERIOD) / SWEEP_PERIOD) * Math.PI * 2 - Math.PI / 2)
    this.drawGlass(g)
    this.drawSectors(g)
    if (sweep !== null) this.drawSweep(g, sweep)
    this.drawRunway(g, now)
    this.drawFixes(g, now, sweep)
    this.drawClosures(g, now)
    this.updatePlanes(dt, now)
    this.drawAsks(g, now)
    this.drawGhosts(g, now)
    this.drawTower(g, now)
    this.drawDeparting(g, now)
    this.drawLeaderLabels(g)
    this.drawPlanes(g, now, sweep)
    this.drawTimeReadout(g)
    this.phosphor?.render(this.offscreen!, dt * 1000, this.opts.reducedMotion ? 0 : 1)
  }

  /** The leading times get their clock time written beside them, just inside the ring. */
  private drawLeaderLabels({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>) {
    const { ctx, model } = this
    this.leaderRects = []
    if (!model || this.leaders.length === 0) return
    const placed = this.leaderRects
    const fs = Math.round(12.5 * scale)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.leaders.forEach((id, i) => {
      const s = model.slots.find((x) => x.id === id)
      const a = this.bearing(id)
      if (!s || a === undefined) return
      const text = dayAndClock(s.label) // the day too, so two leaders at 4:30 on different days aren't confused
      ctx.font = `${i === 0 ? 600 : 500} ${fs}px ${MONO}`
      const w = ctx.measureText(text).width + 10
      const h = fs + 8
      // Step inward until the label clears the ones already written.
      let r = Rf - 24 * scale
      let rect = { x: 0, y: 0, w, h }
      for (let k = 0; k < 6; k++) {
        rect = { x: cx + Math.cos(a) * r - w / 2, y: cy + Math.sin(a) * r - h / 2, w, h }
        const hit = placed.some((p) => rect.x < p.x + p.w && p.x < rect.x + rect.w && rect.y < p.y + p.h && p.y < rect.y + rect.h)
        if (!hit) break
        r -= h + 2
      }
      placed.push(rect)
      ctx.fillStyle = 'rgba(11,20,28,0.85)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.fillStyle = i === 0 ? `rgb(${AMBER})` : `rgba(${AMBER},0.85)`
      ctx.fillText(text, rect.x + w / 2, rect.y + h / 2 + 1)
    })
  }

  /** Pointing at a time on the ring reads it out: when, and how many people can make it. */
  private drawTimeReadout({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>) {
    const { ctx, model } = this
    if (!model || !this.hoverSlot) return
    const s = model.slots.find((x) => x.id === this.hoverSlot)
    const a = this.bearing(this.hoverSlot)
    if (!s || a === undefined) return
    const total = model.agents.length
    const blocked = new Set(s.blockers.map((b) => b.user_id)).size
    const line1 = total ? `${fullTime(s.label)} · ${total - blocked} of ${total} can make it` : fullTime(s.label)
    const line2 = s.closed && s.blockers.length
      ? `Can't: ${blockerPhrase(s.blockers[0].name, s.blockers[0].reason)}${s.blockers.length > 1 ? ` +${s.blockers.length - 1} more` : ''}`
      : null
    const f1 = Math.round(13 * scale)
    const f2 = Math.round(12 * scale)
    ctx.font = `600 ${f1}px ${SANS}`
    let w = ctx.measureText(line1).width
    if (line2) {
      ctx.font = `400 ${f2}px ${SANS}`
      w = Math.max(w, ctx.measureText(line2).width)
    }
    w += 16
    const h = f1 + 12 + (line2 ? f2 + 6 : 0)
    const fx = cx + Math.cos(a) * Rf
    const fy = cy + Math.sin(a) * Rf
    // Sit inside the ring, toward the centre, and stay on the canvas.
    let x = fx - Math.cos(a) * (28 * scale) - w / 2
    let y = fy - Math.sin(a) * (28 * scale) - h / 2
    x = Math.max(4, Math.min(this.size.w - w - 4, x))
    y = Math.max(4, Math.min(this.size.h - h - 4, y))
    ctx.fillStyle = 'rgba(11,20,28,0.94)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = `rgba(${STRIP},0.35)`
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `600 ${f1}px ${SANS}`
    ctx.fillStyle = `rgb(${STRIP})`
    ctx.fillText(line1, x + 8, y + 6 + f1)
    if (line2) {
      ctx.font = `400 ${f2}px ${SANS}`
      ctx.fillStyle = `rgb(${ORANGE_TEXT})`
      ctx.fillText(line2, x + 8, y + 6 + f1 + 6 + f2)
    }
  }

  private drawGhosts({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number) {
    for (const [id, g] of this.ghosts) {
      const t = (now - g.at) / 320
      if (t >= 1 || this.opts.reducedMotion) {
        this.ghosts.delete(id)
        continue
      }
      const x = cx + Math.cos(g.angle) * Rf
      const y = cy + Math.sin(g.angle) * Rf
      this.triangle(x, y, g.angle, 4.5 * scale * (1 - t), `rgba(${AMBER},${0.6 * (1 - t)})`, false)
    }
  }

  /** Aircraft from a run that has left the scope peel off outward and fade. */
  private drawDeparting({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number) {
    const { ctx } = this
    this.departing = this.departing.filter((d) => now - d.at < 900 && !this.opts.reducedMotion)
    const s = 3.4 * scale
    for (const d of this.departing) {
      const t = (now - d.at) / 900
      const e = t * t
      const len = Math.hypot(d.x, d.y) || 1
      const push = 1 + e * (1.25 / len)
      ctx.fillStyle = `rgba(${AMBER},${1 - t})`
      ctx.fillRect(cx + d.x * push * Rf - s, cy + d.y * push * Rf - s, s * 2, s * 2)
    }
  }

  private drawGlass({ cx, cy, R, Rf }: ReturnType<ScopeEngine['geometry']>) {
    const { ctx } = this
    const glass = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R)
    glass.addColorStop(0, '#102030')
    glass.addColorStop(1, '#0b141c')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    ctx.lineWidth = 1
    for (const f of [0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = `rgba(${MIST},${f === 1 ? 0.28 : 0.14})`
      ctx.beginPath()
      ctx.arc(cx, cy, Rf * f, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = `rgba(${MIST},0.08)`
    ctx.beginPath()
    ctx.moveTo(cx - Rf, cy)
    ctx.lineTo(cx + Rf, cy)
    ctx.moveTo(cx, cy - Rf)
    ctx.lineTo(cx, cy + Rf)
    ctx.stroke()

    // Bezel with bearing ticks.
    ctx.strokeStyle = `rgba(${MIST},0.45)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180
      const len = deg % 30 === 0 ? 9 : deg % 10 === 0 ? 5 : 2.5
      ctx.strokeStyle = `rgba(${MIST},${deg % 30 === 0 ? 0.5 : 0.25})`
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len))
      ctx.stroke()
    }
  }

  private drawSectors({ cx, cy, R, scale }: ReturnType<ScopeEngine['geometry']>) {
    const { ctx } = this
    const rArc = R * 0.89
    ctx.font = `500 ${Math.round(11.5 * scale)}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const now = performance.now()
    for (const s of this.sectorsShown.values()) {
      const a = this.opts.reducedMotion ? 1 : clamp01((now - s.born) / 450)
      ctx.globalAlpha = a
      ctx.strokeStyle = `rgba(${MIST},0.35)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, rArc, s.start, s.end)
      ctx.stroke()
      for (const edge of [s.start, s.end]) {
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(edge) * (rArc - 4), cy + Math.sin(edge) * (rArc - 4))
        ctx.lineTo(cx + Math.cos(edge) * (rArc + 4), cy + Math.sin(edge) * (rArc + 4))
        ctx.stroke()
      }
      const mid = (s.start + s.end) / 2
      ctx.fillStyle = `rgba(${MIST},0.85)`
      ctx.fillText(s.label, cx + Math.cos(mid) * R * 0.94, cy + Math.sin(mid) * R * 0.94)
    }
    ctx.globalAlpha = 1
  }

  private drawSweep({ cx, cy, R }: ReturnType<ScopeEngine['geometry']>, sweep: number) {
    const { ctx } = this
    const tail = 1.1
    const grad = ctx.createConicGradient(sweep - tail, cx, cy)
    const frac = tail / (Math.PI * 2)
    grad.addColorStop(0, `rgba(${AMBER},0)`)
    grad.addColorStop(frac * 0.85, `rgba(${AMBER},0.07)`)
    grad.addColorStop(frac, `rgba(${AMBER},0.2)`)
    grad.addColorStop(Math.min(1, frac + 0.001), `rgba(${AMBER},0)`)
    grad.addColorStop(1, `rgba(${AMBER},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.985, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(${AMBER},0.55)`
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(sweep) * R * 0.985, cy + Math.sin(sweep) * R * 0.985)
    ctx.stroke()
  }

  private fixPoint(slotId: string, r: number, cx: number, cy: number): [number, number] | null {
    const a = this.bearing(slotId)
    return a === undefined ? null : [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  private drawFixes({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number, sweep: number | null) {
    const { ctx, model } = this
    if (!model) return
    const winner = model.decision?.status === 'converged' ? model.decision.slot?.id : null
    const anyRank = this.leaders.length > 0 && model.shortlist.length > 0
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const s of model.slots) {
      const angle = this.bearing(s.id)
      if (angle === undefined) continue
      const bornAt = this.bornAt.get(s.id)
      const grow = bornAt === undefined || this.opts.reducedMotion ? 1 : clamp01((now - bornAt) / 380)
      if (grow <= 0) continue
      const pop = easeOutBack(grow)
      const x = cx + Math.cos(angle) * Rf
      const y = cy + Math.sin(angle) * Rf
      const closeAt = this.closeFx.get(s.id)
      const closing = closeAt !== undefined && now - closeAt < 420 && now >= closeAt
      const closed = s.closed && closeAt !== undefined && now - closeAt >= 420
      const painted = sweep === null ? 0 : Math.exp(-sinceSweep(sweep, angle) * 1.6)

      if (closed || (s.closed && this.opts.reducedMotion)) {
        const d = 3.6 * scale  // a crossed-out time has to read at a glance: it is the point of the calendar step
        ctx.strokeStyle = `rgba(${ORANGE},0.7)`
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(x - d, y - d)
        ctx.lineTo(x + d, y + d)
        ctx.moveTo(x + d, y - d)
        ctx.lineTo(x - d, y + d)
        ctx.stroke()
        continue
      }
      if (closing) {
        const flicker = Math.sin((now - closeAt!) / 22) > 0 ? 1 : 0.25
        this.triangle(x, y, angle, 5.5 * scale, `rgba(${ORANGE},${flicker})`, true)
        continue
      }
      if (s.id === winner) {
        this.triangle(x, y, angle, 9 * scale, `rgb(${ORANGE})`, true)
        continue
      }
      if (this.leaders.includes(s.id)) {
        this.triangle(x, y, angle, (this.leaders[0] === s.id ? 8 : 6.5) * scale * pop, `rgba(${AMBER},0.95)`, true)
        continue
      }
      if (this.hoverSlot === s.id) {
        this.triangle(x, y, angle, 6.5 * scale, `rgba(${STRIP},0.95)`, false)
        continue
      }
      const dim = anyRank ? 0.28 : 0.6
      // A fresh fix lands bright, then settles to the resting phosphor level.
      const flash = grow < 1 ? 0.4 * (1 - grow) : 0
      this.triangle(x, y, angle, 4.5 * scale * pop, `rgba(${AMBER},${(dim + painted * 0.35 + flash) * grow})`, grow < 0.6)
    }
  }

  private triangle(x: number, y: number, angle: number, size: number, color: string, fill: boolean) {
    const { ctx } = this
    // Point the fix toward the tower, like an inbound arrow.
    const a = angle + Math.PI
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const t = a + (i * Math.PI * 2) / 3
      const px = x + Math.cos(t) * size
      const py = y + Math.sin(t) * size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    if (fill) {
      ctx.fillStyle = color
      ctx.fill()
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }

  private drawClosures({ cx, cy, Rf }: ReturnType<ScopeEngine['geometry']>, now: number) {
    const { ctx, model } = this
    if (!model || this.opts.reducedMotion) return
    for (const s of model.slots) {
      const at = this.closeFx.get(s.id)
      if (at === undefined || now < at || now - at > 650 || !s.blockers.length) continue
      const plane = this.planes.get(s.blockers[0].user_id)
      const fix = this.fixPoint(s.id, Rf, cx, cy)
      if (!plane || !fix) continue
      const t = (now - at) / 650
      ctx.strokeStyle = `rgba(${ORANGE},${0.65 * (1 - t)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(fix[0], fix[1])
      ctx.lineTo(cx + plane.x * Rf, cy + plane.y * Rf)
      ctx.stroke()
    }
  }

  private updatePlanes(dt: number, now: number) {
    const model = this.model
    if (!model) return
    const reduced = this.opts.reducedMotion
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.6)
    const winner = model.decision?.status === 'converged' ? model.decision.slot?.id : null
    const winAngle = winner ? this.layout.angles.get(winner) : undefined
    model.agents.forEach((agent, i) => {
      const p = this.planes.get(agent.id)
      if (!p || p.landed) return

      if (winAngle !== undefined && this.decisionAt !== null) {
        const order = this.landingOrder.indexOf(agent.id)
        const start = this.decisionAt + LAND_DELAY + Math.max(0, order) * LAND_STAGGER
        if (reduced) {
          p.landed = true
          return
        }
        if (now >= start) {
          if (p.landStart === null) {
            p.landStart = start
            p.landFrom = [p.x, p.y]
          }
          const t = Math.min(1, (now - p.landStart) / LAND_DURATION)
          const e = easeInOut(t)
          const [x0, y0] = p.landFrom!
          // Join the extended centreline near the tower, then roll out to the fix.
          const qx = Math.cos(winAngle) * 0.3
          const qy = Math.sin(winAngle) * 0.3
          const fx = Math.cos(winAngle)
          const fy = Math.sin(winAngle)
          p.x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * qx + e * e * fx
          p.y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * qy + e * e * fy
          if (t >= 1) p.landed = true
          this.pushTrail(p, now)
          return
        }
      }

      const target =
        this.targets.get(agent.id) ?? this.holdingPoint(i, model.agents.length, now)
      p.x += (target[0] - p.x) * k
      p.y += (target[1] - p.y) * k
      this.pushTrail(p, now)
    })

    if (this.decisionAt !== null && !this.landedFired) {
      const escalated = model.decision?.status === 'escalated'
      const allDown = model.agents.every((a) => this.planes.get(a.id)?.landed)
      const waitedOut = escalated && now - this.decisionAt > 1600
      if (allDown || waitedOut || (reduced && this.decisionAt !== null)) {
        this.landedFired = true
        this.landedAt = now
        window.setTimeout(() => this.opts.onLanded?.(), allDown && !reduced ? 350 : 0)
      }
    }
  }

  private pushTrail(p: Plane, now: number) {
    if (this.opts.reducedMotion) return
    if (now - p.lastTrail < 260) return
    p.lastTrail = now
    p.trail.push({ x: p.x, y: p.y })
    if (p.trail.length > 6) p.trail.shift()
  }

  private planePx(id: string, cx: number, cy: number, Rf: number): [number, number] | null {
    const p = this.planes.get(id)
    return p && !p.landed ? [cx + p.x * Rf, cy + p.y * Rf] : null
  }

  private drawAsks({ cx, cy, Rf }: ReturnType<ScopeEngine['geometry']>, now: number) {
    const { ctx, model } = this
    if (!model || model.decision) return
    for (const ask of model.asks) {
      if (ask.round !== model.round) continue
      const at = this.askFx.get(ask.id) ?? now
      const target = this.planePx(ask.toId, cx, cy, Rf)
      if (!target) continue
      const dist = Math.hypot(target[0] - cx, target[1] - cy)
      const age = now - at

      if (age < 750 && !this.opts.reducedMotion) {
        const t = age / 750
        ctx.strokeStyle = `rgba(${ORANGE},${0.7 * (1 - t)})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, dist * t), 0, Math.PI * 2)
        ctx.stroke()
      }

      const replyAt = this.replyFx.get(ask.id)
      const fade = replyAt === undefined ? 1 : Math.max(0, 1 - (now - replyAt) / 1800)
      if (fade <= 0) continue
      const color = ask.reply ? (ask.reply.response === 'hold' ? MIST : AMBER) : ORANGE
      const reach = this.opts.reducedMotion ? 1 : Math.min(1, age / 500)
      ctx.setLineDash([6, 5])
      ctx.lineDashOffset = this.opts.reducedMotion ? 0 : -now / 40
      ctx.strokeStyle = `rgba(${color},${0.85 * fade})`
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + (target[0] - cx) * reach, cy + (target[1] - cy) * reach)
      ctx.stroke()
      const fix = this.fixPoint(ask.slotId, Rf, cx, cy)
      if (fix && reach >= 1) {
        ctx.setLineDash([2, 4])
        ctx.strokeStyle = `rgba(${color},${0.45 * fade})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(target[0], target[1])
        ctx.lineTo(fix[0], fix[1])
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
  }

  private drawRunway({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number) {
    const { ctx, model } = this
    const winner = model?.decision?.status === 'converged' ? model.decision.slot?.id : null
    if (!winner || this.decisionAt === null) return
    const angle = this.bearing(winner)
    if (angle === undefined) return
    // Once everyone is down the runway fades, so it never shows through the stamp.
    const fade = this.landedAt === null ? 1 : this.opts.reducedMotion ? 0 : Math.max(0, 1 - (now - this.landedAt) / 300)
    if (fade <= 0) return
    const grow = this.opts.reducedMotion ? 1 : Math.min(1, (now - this.decisionAt) / 700)
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    const nx = -uy
    const ny = ux
    const half = 9 * scale
    const len = Rf * grow
    ctx.save()
    ctx.globalAlpha = fade
    ctx.strokeStyle = `rgba(${ORANGE},0.85)`
    ctx.lineWidth = 1.3
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + nx * half * side, cy + ny * half * side)
      ctx.lineTo(cx + ux * len + nx * half * side, cy + uy * len + ny * half * side)
      ctx.stroke()
    }
    ctx.setLineDash([8, 7])
    ctx.strokeStyle = `rgba(${STRIP},0.35)`
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + ux * len, cy + uy * len)
    ctx.stroke()
    ctx.setLineDash([])
    // Sequenced approach lights running toward the threshold.
    if (!this.opts.reducedMotion && grow >= 1) {
      const n = 12
      const lead = Math.floor((now / 90) % (n + 4))
      for (let i = 0; i < n; i++) {
        const t = 0.12 + (i / n) * 0.8
        const on = i === lead || i === lead - 1
        ctx.fillStyle = on ? `rgba(${STRIP},0.95)` : `rgba(${ORANGE},0.25)`
        ctx.beginPath()
        ctx.arc(cx + ux * Rf * t, cy + uy * Rf * t, on ? 2.4 : 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  private drawPlanes({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number, sweep: number | null) {
    const { ctx, model } = this
    if (!model) return
    const lead = model.shortlist[0]?.slot_id
    const f1 = Math.round(12.5 * scale)
    const f2 = Math.round(11.5 * scale)
    const s = 3.8 * scale
    const crowded = model.agents.length > CROWD

    interface Drawn { agent: Agent; p: Plane; x: number; y: number; line2: { text: string; rgb: string } | null; w: number; h: number }
    const drawn: Drawn[] = []
    for (const agent of model.agents) {
      const p = this.planes.get(agent.id)
      if (!p || p.landed) continue
      const status = this.tagStatus(agent, model, lead, now)
      // In a crowd only the name shows, unless this person is pointed at or the mediator is talking to them.
      const line2 = !crowded || status.urgent || this.opts.highlight === agent.id ? status : null
      ctx.font = `600 ${f1}px ${SANS}`
      const w1 = ctx.measureText(agent.callsign).width
      ctx.font = `500 ${f2}px ${SANS}`
      const w = Math.max(w1, line2 ? ctx.measureText(line2.text).width : 0) + 8
      drawn.push({ agent, p, x: cx + p.x * Rf, y: cy + p.y * Rf, line2, w, h: f1 + 6 + (line2 ? f2 + 3 : 0) })
    }

    // Place each tag at whichever position beside its dot collides least with dots and
    // tags already placed.
    const off = 14 * scale
    const tower = 22 * scale
    const mediatorW = 64 * scale
    const placed: { x: number; y: number; w: number; h: number }[] = [
      { x: cx - mediatorW / 2, y: cy - tower / 2, w: mediatorW, h: tower * 1.5 }, // the mediator's mark and label
      ...drawn.map((d) => ({ x: d.x - s - 2, y: d.y - s - 2, w: 2 * s + 4, h: 2 * s + 4 })),
      ...this.leaderRects, // name tags steer around the leading-time labels
    ]
    const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    const tags = drawn.map((d) => {
      const h = d.h
      const options = [
        { dx: off, dy: -off - h }, { dx: -off - d.w, dy: -off - h },
        { dx: off, dy: off }, { dx: -off - d.w, dy: off },
        { dx: off * 2.2, dy: -h / 2 }, { dx: -off * 2.2 - d.w, dy: -h / 2 },
        { dx: -d.w / 2, dy: -off * 2.4 - h }, { dx: -d.w / 2, dy: off * 2.4 },
      ]
      let best = options[0]
      let bestCost = Infinity
      for (const [i, o] of options.entries()) {
        const rect = { x: d.x + o.dx, y: d.y + o.dy, w: d.w, h }
        let cost = i * 4 // mild preference for the conventional up-right tag
        for (const r of placed) cost += overlap(rect, r)
        const fromCentre = Math.hypot(rect.x + rect.w / 2 - cx, rect.y + rect.h / 2 - cy)
        if (fromCentre > Rf * 1.05) cost += 4000 // keep tags on the glass
        if (cost < bestCost) {
          bestCost = cost
          best = o
        }
      }
      const rect = { x: d.x + best.dx, y: d.y + best.dy, w: d.w, h: d.h }
      placed.push(rect)
      return rect
    })

    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    drawn.forEach((d, i) => {
      const { agent, p, x, y, line2 } = d
      const angle = Math.atan2(p.y, p.x)
      const painted = sweep === null ? 1 : 0.38 + 0.62 * Math.exp(-sinceSweep(sweep, angle) * 1.1)
      const rgb = agent.fallback ? MIST : agent.status === 'asked' ? ORANGE : AMBER

      p.trail.forEach((t, k) => {
        ctx.fillStyle = `rgba(${rgb},${0.08 + (k / p.trail.length) * 0.3})`
        ctx.beginPath()
        ctx.arc(cx + t.x * Rf, cy + t.y * Rf, 1.6, 0, Math.PI * 2)
        ctx.fill()
      })

      const pulse = agent.status === 'thinking' && !this.opts.reducedMotion ? 0.5 + 0.5 * Math.sin(now / 140) : 1
      ctx.fillStyle = `rgba(${rgb},${painted * pulse})`
      ctx.fillRect(x - s, y - s, s * 2, s * 2)
      if (this.opts.highlight === agent.id) {
        ctx.strokeStyle = `rgba(${STRIP},0.9)`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(x, y, 11 * scale, 0, Math.PI * 2)
        ctx.stroke()
      }

      const tag = tags[i]
      const ax = Math.max(tag.x, Math.min(x, tag.x + tag.w))
      const ay = Math.max(tag.y, Math.min(y, tag.y + tag.h))
      ctx.strokeStyle = `rgba(${rgb},0.5)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(ax, ay)
      ctx.stroke()
      ctx.fillStyle = 'rgba(11,20,28,0.78)'
      ctx.fillRect(tag.x, tag.y, tag.w, tag.h)
      ctx.font = `600 ${f1}px ${SANS}`
      ctx.fillStyle = `rgba(${STRIP},${0.7 + 0.3 * painted})`
      ctx.fillText(agent.callsign, tag.x + 4, tag.y + f1 + 1)
      if (line2) {
        ctx.font = `500 ${f2}px ${SANS}`
        ctx.fillStyle = `rgba(${line2.rgb},0.95)`
        ctx.fillText(line2.text, tag.x + 4, tag.y + f1 + f2 + 4)
      }
    })
  }

  private tagStatus(agent: Agent, model: TowerModel, _lead: string | undefined, now: number): { text: string; rgb: string; urgent?: boolean } {
    if (model.decision?.status === 'escalated') return { text: 'No time works', rgb: MIST }
    if (model.decision) return { text: 'Booked', rgb: ORANGE_TEXT }
    if (agent.reply) {
      const at = model.asks.find((a) => a.reply?.seq === agent.reply!.seq)
      const firstSeen = at ? this.replyFx.get(at.id) : undefined
      if (firstSeen !== undefined && now - firstSeen < 2800) {
        const r = agent.reply.response
        return r === 'flex'
          ? { text: 'Can move', rgb: AMBER, urgent: true }
          : r === 'hold'
            ? { text: "Won't move", rgb: MIST, urgent: true }
            : { text: 'Agrees', rgb: AMBER, urgent: true }
      }
    }
    switch (agent.status) {
      case 'holding':
        return { text: 'Setting up', rgb: MIST }
      case 'ready':
        return { text: 'Ready', rgb: AMBER }
      case 'thinking':
        return { text: `Thinking${'.'.repeat(1 + (Math.floor(now / 300) % 3))}`, rgb: AMBER }
      case 'asked':
        return { text: 'Asked to move', rgb: ORANGE_TEXT, urgent: true }
      case 'failed':
        return { text: 'Agent error', rgb: MIST }
      default: {
        const scores = model.scores[agent.id]
        if (!scores) return { text: 'Ready', rgb: AMBER }
        const open = new Set(model.slots.filter((s) => !s.closed).map((s) => s.id))
        const top = Object.entries(scores).filter(([id]) => open.has(id)).sort((a, b) => b[1] - a[1])[0]
        const slot = top && model.slots.find((s) => s.id === top[0])
        return { text: slot ? `Likes ${dayAndClock(slot.label)}` : 'Rated the times', rgb: AMBER }
      }
    }
  }

  private drawTower({ cx, cy, scale }: ReturnType<ScopeEngine['geometry']>, now: number) {
    const { ctx, model } = this
    const calling = model?.asks.some((a) => now - (this.askFx.get(a.id) ?? -1e9) < 900)
    const r = 7 * scale
    ctx.strokeStyle = calling ? `rgb(${ORANGE})` : `rgba(${STRIP},0.7)`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      const px = cx + Math.cos(a) * r
      const py = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = calling ? `rgb(${ORANGE})` : `rgba(${STRIP},0.7)`
    ctx.beginPath()
    ctx.arc(cx, cy, 1.8 * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `600 ${Math.round(10.5 * scale)}px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(${STRIP},0.6)`
    ctx.fillText('Mediator', cx, cy + r + 12 * scale)
  }
}
