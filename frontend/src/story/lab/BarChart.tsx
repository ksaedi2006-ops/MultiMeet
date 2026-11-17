import type { ReactNode } from 'react'
import type { Stat } from '../../lib/lab'

interface Bar { id: string; label: string; color: string; stat: Stat }

interface Props {
  title: ReactNode
  subtitle: ReactNode
  bars: Bar[]
  domain: [number, number] // may straddle zero
  format: (v: number) => string
  threshold?: { v: number; label: string }
}

/** One horizontal bar per rule with its 95% interval, around a zero line. */
export default function BarChart({ title, subtitle, bars, domain, format, threshold }: Props) {
  const [lo, hi] = domain
  const pct = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`
  const zero = pct(0)
  return (
    <figure className="m-0">
      <figcaption>
        <h3 className="text-[15px] font-semibold text-strip leading-tight">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-mist leading-snug">{subtitle}</p>
      </figcaption>
      <div className="mt-3 flex flex-col gap-2">
        {bars.map((b) => {
          const v = b.stat.mean
          const left = v < 0 ? pct(v) : zero
          const width = `calc(${v < 0 ? zero : pct(v)} - ${v < 0 ? pct(v) : zero})`
          return (
            <div key={b.id} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-[12.5px]"
              title={`${b.label}: ${format(v)} (95% interval ${format(b.stat.lo)} to ${format(b.stat.hi)}, ${b.stat.n} meetings)`}>
              <span className="text-strip truncate">{b.label}</span>
              <span className="relative h-4">
                <span aria-hidden className="absolute inset-y-0 w-px bg-mist/50" style={{ left: zero }} />
                {threshold && <span aria-hidden className="absolute -inset-y-1 border-l border-dashed border-strip/50" style={{ left: pct(threshold.v) }} />}
                <span className="absolute inset-y-[3px] rounded-[2px]" style={{ left, width, background: b.color }} />
                {b.stat.n > 1 && (
                  <span aria-hidden className="absolute top-1/2 h-px bg-strip/80"
                    style={{ left: pct(b.stat.lo), width: `calc(${pct(b.stat.hi)} - ${pct(b.stat.lo)})` }} />
                )}
              </span>
              <span className="text-right tabular-nums text-strip">{b.stat.n ? format(v) : '–'}</span>
            </div>
          )
        })}
      </div>
      {threshold && <p className="mt-2 text-[11.5px] text-mist">Dashed line: {threshold.label}</p>}
    </figure>
  )
}
