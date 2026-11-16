import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type Holder = 'plan' | 'sim' | 'event'

/** Strip holders are coloured plastic carriers; the colour says what kind of traffic it is. */
const HOLDER: Record<Holder, string> = {
  plan: 'bg-clearance text-strip',
  sim: 'bg-holder-steel text-strip',
  event: 'bg-holder-ochre text-strip',
}

/** A boxed field on a strip, with its printed field code in the corner. */
export function Box({ code, className = '', children }: { code?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`relative bg-strip px-3 pt-4 pb-2 min-w-0 ${className}`}>
      {code && (
        <span aria-hidden className="absolute left-1.5 top-1 font-mono text-[9px] leading-none tracking-[0.12em] text-strip-ink/55">
          {code}
        </span>
      )}
      {children}
    </div>
  )
}

interface Props {
  holder: Holder
  code: string
  layoutId?: string
  className?: string
  children: ReactNode
}

/**
 * A flight strip seated in its holder: the carrier end with its code set sideways, then the
 * manila strip ruled into boxes (children are laid out as a grid by the caller; the 1px gaps
 * between boxes show the printed rules).
 */
export default function BayStrip({ holder, code, layoutId, className = '', children }: Props) {
  return (
    <motion.div layoutId={layoutId} transition={{ type: 'spring', stiffness: 210, damping: 28 }}
      className={`flex items-stretch rounded-[2px] overflow-hidden shadow-[0_1px_0_rgba(0,0,0,0.35),0_6px_14px_-8px_rgba(0,0,0,0.6)] ${className}`}>
      <div aria-hidden className={`w-7 shrink-0 flex items-center justify-center ${HOLDER[holder]}`}>
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] [writing-mode:vertical-rl] rotate-180">{code}</span>
      </div>
      <div className="on-strip flex-1 min-w-0 bg-strip-ink/25">{children}</div>
    </motion.div>
  )
}

/** An empty holder in the bay, waiting for a strip. */
export function EmptyHolder() {
  return <div aria-hidden className="h-14 rounded-[2px] border border-board-line/80 bg-black/15" />
}
