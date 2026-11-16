import { useEffect, useRef } from 'react'
import type { LogLine, TowerModel } from './model'

const TONE: Record<LogLine['tone'], string> = {
  sys: 'text-mist',
  agent: 'text-amber',
  tower: 'text-strip',
  close: 'text-signal',
  clear: 'text-signal',
  warn: 'text-signal',
}

function clock(at: string | null) {
  if (!at) return '--:--:--'
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

export default function TowerLog({ model, viewerId }: { model: TowerModel; viewerId: string | null }) {
  const list = useRef<HTMLOListElement>(null)
  const lines = model.log

  useEffect(() => {
    const el = list.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [lines.length])

  const viewerSign = model.agents.find((a) => a.id === viewerId)?.callsign
  let lastRound = -1

  return (
    <section aria-label="Tower log" className="border border-board-line rounded-[2px] flex flex-col min-h-0 bg-board-raised/40">
      <h2 className="px-4 py-2 border-b border-board-line font-mono text-[11px] tracking-[0.18em] text-mist">TOWER LOG</h2>
      <ol ref={list} role="log" className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[12px] leading-relaxed min-h-0">
        {lines.length === 0 && <li className="text-mist py-1">Nothing on frequency yet.</li>}
        {lines.map((l) => {
          const divider = l.round !== lastRound && l.round > 0
          lastRound = l.round
          return (
            <li key={l.seq}>
              {divider && (
                <div className="flex items-center gap-2 my-2 text-[10px] tracking-[0.18em] text-mist/80">
                  <span className="h-px flex-1 bg-board-line" />
                  ROUND {l.round}
                  <span className="h-px flex-1 bg-board-line" />
                </div>
              )}
              <div className="grid grid-cols-[4.5rem_4.5rem_1fr] gap-x-2 py-0.5">
                <span className="text-mist/70 tabular-nums">{clock(l.at)}</span>
                <span className={`${TONE[l.tone]} font-semibold truncate`}>{l.speaker}</span>
                <span className="text-strip/90 font-sans text-[13px]">
                  {l.text}
                  {l.privateNote && l.speaker === viewerSign && (
                    <span className="block text-amber/80 text-[12px]">Only you see this: {l.privateNote}</span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
