import { motion } from 'framer-motion'
import Stamp from '../components/Stamp'
import type { DecisionModel } from './model'

/** The finale on the scope: the stamp, and the chosen time written out large enough to read at a glance. */
export default function ChosenTime({ decision, timezone }: { decision: DecisionModel; timezone: string | null }) {
  if (decision.status !== 'converged' || !decision.slot) return <Stamp label="NO TIME WORKS" size="lg" />
  const start = new Date(decision.slot.start)
  const opts = { timeZone: timezone ?? undefined }
  const day = start.toLocaleDateString('en-US', { ...opts, weekday: 'long', month: 'short', day: 'numeric' })
  const time = start.toLocaleTimeString('en-US', { ...opts, hour: 'numeric', minute: '2-digit' })
  return (
    <div className="flex flex-col items-center gap-3">
      <Stamp label="BOOKED" size="lg" />
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
        className="bg-glass px-4 py-2 text-center leading-none">
        <span className="block font-display font-bold text-[clamp(1.6rem,3.2vw,2.6rem)] text-strip">{day}</span>
        <span className="block mt-1.5 font-display font-bold text-[clamp(1.3rem,2.4vw,2rem)] text-amber">{time}</span>
      </motion.p>
    </div>
  )
}
