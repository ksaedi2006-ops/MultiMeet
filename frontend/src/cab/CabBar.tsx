import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'
import type { StageSpec } from './stages'

const local = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** The slim bar along the top: the product, the current step in plain words, the local time. */
export default function CabBar({ stage }: { stage: StageSpec }) {
  const [now, setNow] = useState(() => local(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setNow(local(new Date())), 15000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <header className="console relative z-10 h-11 shrink-0 flex items-stretch border-b border-board-line font-mono text-[11px] tracking-[0.14em]">
      <Link to="/" className="flex items-center gap-2.5 px-4 lg:px-5 border-r border-board-line hover:bg-board-raised/60 transition-colors">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="text-signal">
          <path d="M8 1.5 13.6 4.75v6.5L8 14.5 2.4 11.25v-6.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
        <span className="font-display font-bold text-[17px] tracking-[0.06em] text-strip leading-none">
          MULTIMEET
        </span>
      </Link>
      <div className="relative flex-1 min-w-0 flex items-center px-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={stage.id} className="font-sans text-[14px] tracking-normal text-strip whitespace-nowrap truncate"
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}>
            {stage.name}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="hidden sm:flex items-center px-4 lg:px-5 border-l border-board-line text-mist tabular-nums">{now}</span>
    </header>
  )
}
