import { useMemo } from 'react'
import type { BusyEvent } from '../api/client'

const FIRST = 7
const LAST = 22
const ROW = 26
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function parts(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(new Date(iso))) o[p.type] = p.value
  return { key: `${o.year}-${o.month}-${o.day}`, minutes: Number(o.hour) * 60 + Number(o.minute) }
}

export function mondayOf(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toLocaleDateString('en-CA')
}

interface Props {
  events: BusyEvent[]
  tz: string
  weekStart: string // a Monday, YYYY-MM-DD
  onToggle: (title: string, kind: 'hard' | 'soft') => void
}

/** One week of a person's calendar. Solid blocks are fixed; hatched blocks are movable. Click to flip. */
export default function WeekView({ events, tz, weekStart, onToggle }: Props) {
  const columns = useMemo(() => {
    const out: { key: string; label: string; dom: number }[] = []
    const d = new Date(`${weekStart}T12:00:00`)
    for (let i = 0; i < 7; i++) {
      out.push({ key: d.toLocaleDateString('en-CA'), label: DAYS[i], dom: d.getDate() })
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [weekStart])

  const blocks = useMemo(() => {
    const byDay = new Map<string, { e: BusyEvent; top: number; height: number }[]>()
    for (const e of events) {
      if (e.all_day) continue
      const p = parts(e.start, tz)
      const duration = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000
      const top = Math.max(0, p.minutes - FIRST * 60)
      const height = Math.min(duration, (LAST + 1) * 60 - p.minutes)
      if (height <= 0 || p.minutes >= (LAST + 1) * 60) continue
      const list = byDay.get(p.key) ?? []
      list.push({ e, top, height })
      byDay.set(p.key, list)
    }
    return byDay
  }, [events, tz])

  const hours = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i)
  const px = (min: number) => (min / 60) * ROW

  return (
    <div className="flex gap-px select-none">
      <div className="w-9 shrink-0 mt-9 relative font-mono text-[10px] text-mist" style={{ height: ROW * hours.length }} aria-hidden>
        {hours.map((h, i) => (
          <div key={h} style={{ top: i * ROW - 6 }} className="absolute right-0 pr-1.5 leading-3">
            {`${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`}
          </div>
        ))}
      </div>
      {columns.map((c) => (
        <div key={c.key} className="flex-1 min-w-0">
          <div className="h-9 text-center font-mono leading-tight pt-0.5" aria-hidden>
            <div className="text-[10px] text-mist">{c.label}</div>
            <div className="text-[12px] text-strip">{c.dom}</div>
          </div>
          <div className="relative bg-board-raised/50 border-l border-board-line/60" style={{ height: ROW * hours.length }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-board-line/40" style={{ top: i * ROW }} aria-hidden />
            ))}
            {(blocks.get(c.key) ?? []).map(({ e, top, height }, i) => {
              const soft = e.kind === 'soft'
              return (
                <button key={`${e.start}-${i}`} type="button"
                  onClick={() => onToggle(e.title, soft ? 'hard' : 'soft')}
                  aria-label={`${e.title}, ${soft ? 'movable' : 'fixed'}. Press to make it ${soft ? 'fixed' : 'movable'}.`}
                  title={`${e.title} (${soft ? 'movable' : 'fixed'}). Click to change.`}
                  className="absolute inset-x-px overflow-hidden rounded-[1px] text-left px-1 pt-0.5 text-strip-ink font-mono text-[10px] leading-tight transition-[background-color,opacity] hover:outline hover:outline-1 hover:outline-amber"
                  style={{
                    top: px(top), height: Math.max(4, px(height) - 1),
                    background: soft
                      ? 'repeating-linear-gradient(135deg, rgba(236,223,194,0.62) 0 4px, rgba(236,223,194,0.28) 4px 8px)'
                      : 'rgb(236,223,194)',
                  }}>
                  {px(height) > 22 ? e.title : ''}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
