import { motion } from 'framer-motion'

const FIRST_HOUR = 7
const LAST_HOUR = 23
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface Props {
  start: string
  end: string
  earliest: number
  latest: number
  weekdays: number[]
  duration: number
}

function days(start: string, end: string) {
  const out: { key: string; dow: number; dom: number }[] = []
  const a = new Date(`${start}T12:00:00`)
  const b = new Date(`${end}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return out
  for (let d = new Date(a); d <= b && out.length < 31; d.setDate(d.getDate() + 1)) {
    out.push({ key: d.toISOString().slice(0, 10), dow: (d.getDay() + 6) % 7, dom: d.getDate() })
  }
  return out
}

/** The times this event will search, drawn as a grid that repaints as the settings change. */
export default function WindowPreview({ start, end, earliest, latest, weekdays, duration }: Props) {
  const cols = days(start, end)
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i)
  const open = cols.filter((c) => weekdays.includes(c.dow))
  const perDay = Math.max(0, Math.floor(((latest - earliest) * 60) / Math.max(15, duration)))
  const candidates = Math.min(72, open.length * Math.max(1, Math.ceil(perDay / 1.5)))

  return (
    <figure className="min-w-0" aria-label="Preview of the times that will be searched">
      <div className="flex items-end gap-px" style={{ paddingLeft: '2.25rem' }} aria-hidden>
        {cols.map((c) => (
          <div key={c.key} className="flex-1 min-w-0 text-center font-mono leading-none">
            <div className={`text-[9px] ${weekdays.includes(c.dow) ? 'text-mist' : 'text-mist/45'}`}>{DOW[c.dow]}</div>
            <div className={`text-[10px] mt-0.5 ${weekdays.includes(c.dow) ? 'text-strip' : 'text-mist/45'}`}>{c.dom}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-px" aria-hidden>
        <div className="w-9 shrink-0 flex flex-col font-mono text-[10px] text-mist">
          {hours.map((h) => (
            <div key={h} className="h-[14px] leading-[14px] text-right pr-1.5">
              {h % 3 === 0 ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}` : ''}
            </div>
          ))}
        </div>
        {cols.map((c, ci) => {
          const dayOn = weekdays.includes(c.dow)
          return (
            <motion.div key={c.key} className="flex-1 min-w-0 flex flex-col gap-px"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(ci, 20) * 0.02 }}>
              {hours.map((h) => {
                const on = dayOn && h >= earliest && h < latest
                return (
                  <div key={h}
                    className="h-[14px] rounded-[1px] transition-colors duration-300"
                    style={{ background: on ? 'rgba(232,169,58,0.78)' : 'rgba(147,170,189,0.1)' }} />
                )
              })}
            </motion.div>
          )
        })}
      </div>
      <figcaption className="mt-4 flex items-baseline justify-between gap-3">
        <span className="font-display font-bold text-4xl leading-none text-strip tabular-nums">{candidates}</span>
        <span className="text-sm text-mist text-right">
          candidate times over {open.length} {open.length === 1 ? 'day' : 'days'}
          {candidates >= 72 && ', thinned to fit'}
        </span>
      </figcaption>
    </figure>
  )
}
