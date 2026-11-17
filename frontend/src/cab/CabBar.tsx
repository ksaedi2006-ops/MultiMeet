import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'
import { useSoundSetting } from '../lib/sound'
import type { StageSpec } from './stages'

const local = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** The slim bar along the top: the product, the current step in plain words, the local time. */
export default function CabBar({ stage, toolsRef }: { stage: StageSpec; toolsRef?: (el: HTMLElement | null) => void }) {
  const [sound, setSound] = useSoundSetting()
  const [now, setNow] = useState(() => local(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setNow(local(new Date())), 15000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <header className="console relative z-20 h-11 shrink-0 flex items-stretch border-b border-board-line font-mono text-[11px] tracking-[0.14em]">
      <Link to="/" className="flex items-center gap-2.5 px-3 sm:px-4 lg:px-5 border-r border-board-line hover:bg-board-raised/60 transition-colors">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="text-amber">
          <path d="M8 1.5 13.6 4.75v6.5L8 14.5 2.4 11.25v-6.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
        <span className="font-display font-bold text-[17px] tracking-[0.06em] text-strip leading-none">
          MULTIMEET
        </span>
      </Link>
      <div className="relative flex-1 min-w-0 flex items-center px-3 sm:px-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={stage.name} className="font-sans text-[14px] tracking-normal text-strip whitespace-nowrap truncate"
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}>
            {stage.name}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* A step can put its own controls here (the decision-rule picker, for one). */}
      <div ref={toolsRef} className="flex items-stretch empty:hidden" />
      <NavLink to="/lab" title="Race the decision rules on simulated meetings"
        className={({ isActive }) => `items-center gap-2 px-3 sm:px-4 border-l border-board-line transition-colors ${isActive ? 'hidden sm:flex text-amber bg-board-raised/60' : 'flex text-strip hover:text-amber'}`}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 2h4M7 2v4.5L3 13a1 1 0 0 0 .9 1.5h8.2A1 1 0 0 0 13 13L9 6.5V2" /><path d="M4.8 10.5h6.4" />
        </svg>
        <span className="hidden sm:inline">LAB</span>
      </NavLink>
      <button type="button" onClick={() => setSound(!sound)} aria-pressed={sound}
        aria-label={sound ? 'Sound is on; turn it off' : 'Sound is off; turn it on'}
        className={`flex items-center gap-2 px-3 sm:px-4 border-l border-board-line transition-colors ${sound ? 'text-amber' : 'text-mist hover:text-strip'}`}>
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" />
          {sound ? <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" /> : <path d="m11 6 4 4m0-4-4 4" />}
        </svg>
        <span className="hidden md:inline font-sans text-[13px] tracking-normal">{sound ? 'Sound on' : 'Sound off'}</span>
      </button>
      <span className="hidden sm:flex items-center px-4 lg:px-5 border-l border-board-line text-mist tabular-nums">{now}</span>
    </header>
  )
}
