import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const LINES = [
  'MeetMind tower, information Alpha.',
  'Nobody paints a grid. Everyone’s agent knows their calendar and what they will bend on.',
  'Code closes every time somebody can’t make. The agents bargain over the rest.',
  'The time that is best for the least-happy person is cleared, with the reason.',
  'Advise on initial contact you have information Alpha.',
]

/**
 * The automatic terminal information broadcast: the tower's standing message, typed out as it
 * is read. It is the pitch, in the tower's own voice.
 */
export default function Atis() {
  const reduced = useReducedMotion()
  const total = LINES.join('').length
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (reduced) {
      setShown(total)
      return
    }
    setShown(0)
    const id = window.setInterval(() => setShown((n) => (n >= total ? n : n + 1)), 19)
    return () => window.clearInterval(id)
  }, [reduced, total])

  let left = shown
  const zulu = new Date().toISOString().slice(11, 16).replace(':', '')
  return (
    <section aria-labelledby="atis-h" className="px-5 lg:px-6 py-5">
      <div className="flex items-stretch gap-4 border-b border-board-line pb-4">
        <span aria-hidden className="w-[4.5rem] flex items-center justify-center border border-amber/60 rounded-[2px] font-display font-extrabold text-[4.25rem] leading-none text-amber">
          A
        </span>
        <div className="flex flex-col justify-center gap-1 font-mono text-[11px] tracking-[0.16em]">
          <h2 id="atis-h" className="text-strip">MEETMIND TOWER ATIS</h2>
          <span className="text-mist">INFORMATION ALPHA</span>
          <span className="text-mist tabular-nums">{zulu}Z · AUTOMATED</span>
        </div>
      </div>
      <p className="sr-only">{LINES.join(' ')}</p>
      <ol aria-hidden className="mt-4 space-y-3">
        {LINES.map((line, i) => {
          const n = Math.max(0, Math.min(line.length, left))
          left -= line.length
          if (n === 0) return null
          const typing = n < line.length
          return (
            <li key={i} className={`font-mono leading-relaxed ${i === 0 ? 'text-[15px] text-amber' : 'text-[14.5px] text-strip/90'}`}>
              {line.slice(0, n).toUpperCase()}
              {typing && <span className="inline-block w-[0.55em] h-[1.05em] align-[-0.15em] bg-amber ml-0.5" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
