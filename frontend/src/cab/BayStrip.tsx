import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type Holder = 'plan' | 'sim' | 'event' | 'person'

/** The coloured end of a card says what kind of card it is. */
const HOLDER: Record<Holder, string> = {
  plan: 'bg-clearance text-strip',
  sim: 'bg-holder-steel text-strip',
  event: 'bg-holder-ochre text-strip',
  person: 'bg-holder-person text-strip',
}

/** A ruled box on a card, with an optional small label in the corner. */
export function Box({ code, className = '', children }: { code?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`relative bg-strip px-3 ${code ? 'pt-5' : 'pt-2.5'} pb-2.5 min-w-0 ${className}`}>
      {code && (
        <span aria-hidden className="absolute left-3 top-1.5 text-[11px] leading-none text-strip-ink/60">
          {code}
        </span>
      )}
      {children}
    </div>
  )
}

const ICONS: Record<Holder, string> = {
  plan: 'M3 3.5h10v9.5H3zM3 6.5h10M6 2v3M10 2v3M8 8.5v3M6.5 10h3',
  sim: 'M5 3.5v9l7-4.5z',
  event: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3l2 1.5',
  person: 'M8 8a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 8 8zM3 13.5c.6-2.5 2.6-4 5-4s4.4 1.5 5 4',
}

interface Props {
  holder: Holder
  layoutId?: string
  className?: string
  children: ReactNode
}

/**
 * A paper card: a coloured end with an icon, then manila ruled into boxes (children are laid
 * out as a grid by the caller; the 1px gaps between boxes show the printed rules).
 */
export default function BayStrip({ holder, layoutId, className = '', children }: Props) {
  return (
    <motion.div layoutId={layoutId} transition={{ type: 'spring', stiffness: 210, damping: 28 }}
      className={`flex items-stretch rounded-[2px] overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.35),0_6px_14px_-8px_rgba(0,0,0,0.6)] ${className}`}>
      <div aria-hidden className={`w-7 shrink-0 flex items-center justify-center ${HOLDER[holder]}`}>
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[holder]} /></svg>
      </div>
      <div className="on-strip flex-1 min-w-0 bg-strip-ink/25">{children}</div>
    </motion.div>
  )
}
