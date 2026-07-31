import type { ReactNode } from 'react'

/**
 * A flight progress strip — the manila card surface used throughout the app.
 * The top edge carries a routing stripe, the colored plastic holder strip
 * controllers use to mark a flight's direction at a glance.
 */
export default function Strip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-strip text-strip-ink rounded-[3px] border-t-4 border-clearance shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  )
}
