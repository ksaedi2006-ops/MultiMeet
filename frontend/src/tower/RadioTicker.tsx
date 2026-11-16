import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { TowerModel } from './model'

/** The latest transmission, typed out like a radio transcript under the scope. */
export default function RadioTicker({ model }: { model: TowerModel }) {
  const latest = [...model.log].reverse().find((l) => l.speaker !== 'SYS' || l.tone === 'close')
  const text = latest ? latest.text : 'Standing by.'
  const speaker = latest?.speaker ?? 'TWR'
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    setShown(reduced ? text.length : 0)
    if (reduced) return
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(id)
          return n
        }
        return n + 2
      })
    }, 16)
    return () => window.clearInterval(id)
  }, [text, reduced])

  return (
    <div className="flex items-start gap-3 min-h-[2.75rem]">
      <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-wider rounded-[2px] ${
        speaker === 'TWR' ? 'bg-strip text-board' : 'bg-amber/15 text-amber'}`}
      >
        {speaker}
      </span>
      <p className="text-[15px] text-strip/90 leading-snug">
        {text.slice(0, shown)}
        {shown < text.length && <span className="inline-block w-2 h-3.5 align-[-2px] bg-amber/80 ml-0.5" />}
      </p>
    </div>
  )
}
