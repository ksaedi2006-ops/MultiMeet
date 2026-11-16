import { motion } from 'framer-motion'
import { EASE } from '../lib/motion'

export type Step = 'plan' | 'share' | 'manifest' | 'briefing' | 'approach'

const STEPS: { key: Step; label: string }[] = [
  { key: 'plan', label: 'New meeting' },
  { key: 'share', label: 'Invite people' },
  { key: 'manifest', label: 'Your calendar' },
  { key: 'briefing', label: 'Your preferences' },
  { key: 'approach', label: 'Negotiating' },
]

// The fill remembers where the last page left it, so progress slides rather than jumps.
let lastFraction = 0

function Check() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m2.5 6.5 2.5 2.5 4.5-5.5" />
    </svg>
  )
}

/** Where you are in the flow. Members who join by link only see the steps they actually do. */
export default function StepHeader({ current, organiser = true }: { current: Step; organiser?: boolean }) {
  const steps = organiser ? STEPS : STEPS.filter((s) => s.key !== 'plan' && s.key !== 'share')
  const index = Math.max(0, steps.findIndex((s) => s.key === current))
  const fraction = steps.length > 1 ? index / (steps.length - 1) : 1
  const from = lastFraction
  lastFraction = fraction

  return (
    <nav aria-label="Progress" className="max-w-5xl mx-auto px-5 sm:px-8 pt-7">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] tracking-wider">
        {steps.map((s, i) => {
          const done = i < index
          const here = i === index
          return (
            <li key={s.key} aria-current={here ? 'step' : undefined}
              className={`flex items-center gap-1.5 uppercase ${here ? 'text-signal font-semibold' : done ? 'text-amber' : 'text-mist'}`}>
              {done && <Check />}
              {s.label}
            </li>
          )
        })}
      </ol>
      <div className="relative mt-3 h-px bg-board-line" aria-hidden>
        <motion.div
          className="absolute inset-y-0 left-0 h-[2px] -top-px bg-amber origin-left w-full"
          initial={{ scaleX: from }}
          animate={{ scaleX: fraction }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
    </nav>
  )
}
