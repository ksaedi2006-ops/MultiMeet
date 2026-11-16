import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const LINES = [
  'MultiMeet finds a meeting time without anyone filling in a grid.',
  'Each person gets an AI agent that knows their calendar and what they’re willing to move.',
  'The agents negotiate. The time that’s best for the least-happy person wins, and you see why.',
  'Try a sample: invented students with real-looking weeks, start to finish in under a minute.',
]

/**
 * What MultiMeet is, typed out line by line beside the replay, the way a broadcast reads.
 * Screen readers get the whole text at once.
 */
export default function Atis() {
  const reduced = useReducedMotion()
  const total = LINES.join('').length
  const [shown, setShown] = useState(0)

  useEffect(() => {
    // On a phone the whole explanation has to land within a glance: no typing there.
    if (reduced || window.matchMedia('(max-width: 1023px)').matches) {
      setShown(total)
      return
    }
    setShown(0)
    const id = window.setInterval(() => setShown((n) => (n >= total ? n : n + 1)), 17)
    return () => window.clearInterval(id)
  }, [reduced, total])

  let left = shown
  return (
    <section aria-labelledby="about-h" className="px-5 lg:px-6 py-6">
      <h2 id="about-h" className="font-display font-bold text-[2.4rem] leading-[0.95] tracking-tight text-strip">
        Agents that schedule your meeting
      </h2>
      <p className="sr-only">{LINES.join(' ')}</p>
      <ol aria-hidden className="mt-5 space-y-3.5">
        {LINES.map((line, i) => {
          const n = Math.max(0, Math.min(line.length, left))
          left -= line.length
          if (n === 0) return null
          const typing = n < line.length
          return (
            <li key={i} className={`leading-relaxed ${i === 0 ? 'text-[17px] text-amber' : 'text-[16px] text-strip/90'}`}>
              {line.slice(0, n)}
              {typing && <span className="inline-block w-[0.5em] h-[1.05em] align-[-0.15em] bg-amber ml-0.5" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
