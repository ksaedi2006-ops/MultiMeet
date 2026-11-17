import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'

const KEY = 'multimeet_lab_coach'
const STEPS = [
  { title: 'Five people, true preferences', text: 'Each person’s own words are on the left; the radar pulls them toward the times they truly prefer.' },
  { title: 'Pick a decision rule', text: 'Every card is a rule from bargaining theory, welfare economics, voting or mechanism design. Hover any underlined term for its definition and source.' },
  { title: 'Add a manipulator', text: 'Make one agent lie and see each rule’s manipulation gain. Then try Many meetings to see if this meeting was typical.' },
]

function seen(): boolean {
  try { return localStorage.getItem(KEY) === 'done' } catch { return false }
}

/** Three short steps on a first visit; dismissed for good once closed. */
export default function Coach() {
  const [step, setStep] = useState(() => (seen() ? -1 : 0))
  const close = () => {
    setStep(-1)
    try { localStorage.setItem(KEY, 'done') } catch { /* a convenience only */ }
  }
  const s = STEPS[step]
  return (
    <AnimatePresence>
      {s && (
        <motion.div role="dialog" aria-label="Lab introduction" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.3, ease: EASE }}
          className="fixed z-50 bottom-4 left-1/2 -translate-x-1/2 w-[min(26rem,calc(100vw-2rem))] rounded-[2px] border border-amber/60 bg-console px-4 py-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
          <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">{step + 1} / {STEPS.length}</p>
          <p className="mt-1 text-[15px] font-semibold text-strip">{s.title}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-strip/85">{s.text}</p>
          <div className="mt-3 flex justify-between">
            <button type="button" onClick={close} className="text-[12.5px] text-mist hover:text-strip">Skip</button>
            <button type="button" autoFocus onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : close())}
              className="h-8 px-3 rounded-[2px] bg-clearance text-strip font-mono text-[11.5px] tracking-[0.12em] hover:bg-clearance-dim">
              {step + 1 < STEPS.length ? 'NEXT' : 'START'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
