import type { Agent, TowerModel } from '../model'
import { layoutRim, scoreTarget, separate, type Layout } from './geometry'

const AMBER = '232,169,58'
const ORANGE = '212,85,28'
const MIST = '147,170,189' // --color-mist
const STRIP = '236,223,194'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'

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

export interface EngineOptions {
  reducedMotion: boolean
  highlight: string | null
  onLanded?: () => void
  onHover?: (agentId: string | null) => void
}

const TAU = Math.PI * 2
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    canvas.addEventListener('pointermove', this.onPointer)
    canvas.addEventListener('pointerleave', () => this.opts.onHover?.(null))
  }

  setOptions(opts: EngineOptions) {
    this.opts = opts
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
    this.model = model
    this.prevSeq = model.lastSeq
  }

  private reset() {
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
  }

  private geometry() {
    const { w, h } = this.size
    const S = Math.min(w, h)
    const R = S * 0.48
    return { cx: w / 2, cy: h / 2, R, Rf: R * 0.8, scale: Math.max(0.7, Math.min(1.25, S / 640)) }
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
    this.drawTower(g, now)
    this.drawPlanes(g, now, sweep)
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
    for (const s of this.layout.sectors) {
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
    const a = this.layout.angles.get(slotId)
    return a === undefined ? null : [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  private drawFixes({ cx, cy, Rf, scale }: ReturnType<ScopeEngine['geometry']>, now: number, sweep: number | null) {
    const { ctx, model } = this
    if (!model) return
    const winner = model.decision?.status === 'converged' ? model.decision.slot?.id : null
    const anyRank = model.slots.some((s) => s.rank)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const s of model.slots) {
      const angle = this.layout.angles.get(s.id)
      if (angle === undefined) continue
      const x = cx + Math.cos(angle) * Rf
      const y = cy + Math.sin(angle) * Rf
      const closeAt = this.closeFx.get(s.id)
      const closing = closeAt !== undefined && now - closeAt < 420 && now >= closeAt
      const closed = s.closed && closeAt !== undefined && now - closeAt >= 420
      const painted = sweep === null ? 0 : Math.exp(-sinceSweep(sweep, angle) * 1.6)

      if (closed || (s.closed && this.opts.reducedMotion)) {
        const d = 2.6 * scale
        ctx.strokeStyle = `rgba(${ORANGE},0.42)`
        ctx.lineWidth = 1
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
      if (s.rank) {
        this.triangle(x, y, angle, 7 * scale, `rgba(${AMBER},0.95)`, true)
        ctx.font = `600 ${Math.round(11 * scale)}px ${MONO}`
        ctx.fillStyle = `rgba(${AMBER},0.95)`
        const [lx, ly] = [cx + Math.cos(angle) * (Rf - 18 * scale), cy + Math.sin(angle) * (Rf - 18 * scale)]
        ctx.fillText(String(s.rank), lx, ly)
        continue
      }
      const dim = anyRank ? 0.28 : 0.6
      this.triangle(x, y, angle, 4.5 * scale, `rgba(${AMBER},${dim + painted * 0.35})`, false)
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
    const angle = this.layout.angles.get(winner)
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

    interface Drawn { agent: Agent; p: Plane; x: number; y: number; line2: { text: string; rgb: string }; w: number }
    const drawn: Drawn[] = []
    for (const agent of model.agents) {
      const p = this.planes.get(agent.id)
      if (!p || p.landed) continue
      const line2 = this.tagStatus(agent, model, lead, now)
      ctx.font = `600 ${f1}px ${MONO}`
      const w1 = ctx.measureText(agent.callsign).width
      ctx.font = `500 ${f2}px ${MONO}`
      const w = Math.max(w1, ctx.measureText(line2.text).width) + 8
      drawn.push({ agent, p, x: cx + p.x * Rf, y: cy + p.y * Rf, line2, w })
    }

    // Place each data tag at whichever leader position collides least with blips and
    // tags already placed, the way controllers drag tags off each other.
    const h = f1 + f2 + 8
    const off = 14 * scale
    const tower = 22 * scale
    const placed: { x: number; y: number; w: number; h: number }[] = [
      { x: cx - tower / 2, y: cy - tower / 2, w: tower, h: tower * 1.4 }, // TWR glyph and label
      ...drawn.map((d) => ({ x: d.x - s - 2, y: d.y - s - 2, w: 2 * s + 4, h: 2 * s + 4 })),
    ]
    const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    const tags = drawn.map((d) => {
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
      const rect = { x: d.x + best.dx, y: d.y + best.dy, w: d.w, h }
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
      ctx.font = `600 ${f1}px ${MONO}`
      ctx.fillStyle = `rgba(${STRIP},${0.6 + 0.4 * painted})`
      ctx.fillText(agent.callsign, tag.x + 4, tag.y + f1 + 1)
      ctx.font = `500 ${f2}px ${MONO}`
      ctx.fillStyle = `rgba(${line2.rgb},0.95)`
      ctx.fillText(line2.text, tag.x + 4, tag.y + f1 + f2 + 4)
    })
  }

  private tagStatus(agent: Agent, model: TowerModel, lead: string | undefined, now: number): { text: string; rgb: string } {
    const sim = agent.fallback || model.backend === 'simulated' ? ' SIM' : ''
    if (model.decision?.status === 'escalated') return { text: 'HOLDING', rgb: MIST }
    if (model.decision && this.decisionAt !== null) {
      const order = this.landingOrder.indexOf(agent.id)
      const start = this.decisionAt + LAND_DELAY + Math.max(0, order) * LAND_STAGGER
      return { text: now >= start ? 'FINAL' : 'CLEARED', rgb: ORANGE }
    }
    if (agent.reply) {
      const at = model.asks.find((a) => a.reply?.seq === agent.reply!.seq)
      const firstSeen = at ? this.replyFx.get(at.id) : undefined
      if (firstSeen !== undefined && now - firstSeen < 2800) {
        const r = agent.reply.response
        return r === 'flex'
          ? { text: `FLEX +${agent.reply.delta}`, rgb: AMBER }
          : r === 'hold'
            ? { text: 'HOLD', rgb: MIST }
            : { text: 'ACCEPT', rgb: AMBER }
      }
    }
    switch (agent.status) {
      case 'holding':
        return { text: `BRIEFING${sim}`, rgb: MIST }
      case 'ready':
        return { text: `READY${sim}`, rgb: AMBER }
      case 'thinking':
        return { text: `SCAN${'.'.repeat(1 + (Math.floor(now / 300) % 3))}`, rgb: AMBER }
      case 'asked':
        return { text: 'TWR CALL', rgb: ORANGE }
      default: {
        const scores = model.scores[agent.id]
        if (!scores) return { text: `READY${sim}`, rgb: AMBER }
        const value = lead ? scores[lead] : Math.max(...Object.values(scores))
        return { text: `${lead ? 'LDR' : 'BEST'} ${String(value ?? 0).padStart(3, '0')}${sim}`, rgb: AMBER }
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
    ctx.font = `600 ${Math.round(9 * scale)}px ${MONO}`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(${STRIP},0.6)`
    ctx.fillText('TWR', cx, cy + r + 12 * scale)
  }
}
