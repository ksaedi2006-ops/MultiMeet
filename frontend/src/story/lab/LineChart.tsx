import { useLayoutEffect, useRef, useState } from 'react'

export interface Series {
  id: string
  label: string
  color: string
  points: { x: number; y: number; lo?: number; hi?: number }[]
}

interface Props {
  title: string
  subtitle: string
  series: Series[]
  focus: string | null // this series is drawn heaviest, with its 95% band
  domain: [number, number]
  format: (y: number) => string
  threshold?: { y: number; label: string }
  xLabel?: string
  height?: number
}

const PAD = { l: 40, r: 64, t: 10, b: 22 }

/** Running results as meetings come in: one line per rule, one axis, a crosshair to read any point. */
export default function LineChart({ title, subtitle, series, focus, domain, format, threshold, xLabel = 'meetings run', height = 170 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(480)
  const [hover, setHover] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const maxX = Math.max(10, ...series.map((s) => s.points[s.points.length - 1]?.x ?? 0))
  const [y0, y1] = domain
  const iw = Math.max(10, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const sx = (x: number) => PAD.l + (x / maxX) * iw
  const sy = (y: number) => PAD.t + (1 - (Math.min(y1, Math.max(y0, y)) - y0) / (y1 - y0)) * ih
  const path = (pts: Series['points']) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const band = (pts: Series['points']) => {
    const top = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.hi ?? p.y).toFixed(1)}`).join('')
    const bot = [...pts].reverse().map((p) => `L${sx(p.x).toFixed(1)},${sy(p.lo ?? p.y).toFixed(1)}`).join('')
    return `${top}${bot}Z`
  }
  const ticks = [y0, (y0 + y1) / 2, y1]
  const ordered = [...series].sort((a, b) => Number(a.id === focus) - Number(b.id === focus))
  const at = (s: Series, x: number) => {
    let best = s.points[0]
    for (const p of s.points) if (Math.abs(p.x - x) < Math.abs((best?.x ?? 0) - x)) best = p
    return best
  }
  // End labels for the focused series and Nash only; the legend names the rest.
  const labelled = series.filter((s) => s.id === focus || s.id === 'nash')

  return (
    <figure className="m-0">
      <figcaption>
        <h3 className="text-[15px] font-semibold text-strip leading-tight">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-mist leading-snug">{subtitle}</p>
      </figcaption>
      <div ref={box} className="relative mt-2">
        <svg width={w} height={height} role="img" aria-label={`${title}. ${subtitle}`}
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const x = ((e.clientX - r.left - PAD.l) / iw) * maxX
            setHover(x >= 0 && x <= maxX ? Math.round(x) : null)
          }}
          onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--color-board-line)" strokeWidth={1} />
              <text x={PAD.l - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-mist text-[10.5px] font-mono">{format(t)}</text>
            </g>
          ))}
          {threshold && (
            <g>
              <line x1={PAD.l} x2={PAD.l + iw} y1={sy(threshold.y)} y2={sy(threshold.y)} stroke="var(--color-strip)" strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={1} />
              <text x={PAD.l + 4} y={sy(threshold.y) - 5} className="fill-strip/70 text-[10.5px]">{threshold.label}</text>
            </g>
          )}
          <text x={PAD.l + iw} y={height - 4} textAnchor="end" className="fill-mist text-[10.5px]">{maxX} {xLabel}</text>
          {series.filter((s) => s.id === focus && s.points.length > 1).map((s) => (
            <path key={`band-${s.id}`} d={band(s.points)} fill={s.color} fillOpacity={0.16} />
          ))}
          {ordered.map((s) => s.points.length > 1 && (
            <path key={s.id} d={path(s.points)} fill="none" stroke={s.color}
              strokeWidth={s.id === focus ? 2.5 : 1.75} strokeOpacity={focus && s.id !== focus ? 0.55 : 1}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {labelled.map((s) => {
            const p = s.points[s.points.length - 1]
            return p ? (
              <text key={`lab-${s.id}`} x={sx(p.x) + 6} y={sy(p.y)} dominantBaseline="middle" className="fill-strip text-[11px] font-semibold">
                {s.label.split(' ')[0]} {format(p.y)}
              </text>
            ) : null
          })}
          {hover !== null && (
            <line x1={sx(hover)} x2={sx(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-strip)" strokeOpacity={0.4} strokeWidth={1} />
          )}
        </svg>
        {hover !== null && series.some((s) => s.points.length) && (
          <div className="pointer-events-none absolute top-1 z-10 min-w-[11rem] rounded-[2px] border border-board-line bg-console/95 px-2.5 py-2 text-[12px] shadow-lg"
            style={{ left: Math.min(Math.max(0, sx(hover) + 10), w - 190) }}>
            <p className="text-mist mb-1">After {hover} meetings</p>
            {[...series].sort((a, b) => (at(b, hover)?.y ?? 0) - (at(a, hover)?.y ?? 0)).map((s) => {
              const p = at(s, hover)
              return p ? (
                <p key={s.id} className="flex items-center gap-2 text-strip">
                  <span aria-hidden className="w-2.5 h-0.5 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <span className="tabular-nums">{format(p.y)}</span>
                </p>
              ) : null
            })}
          </div>
        )}
      </div>
    </figure>
  )
}
