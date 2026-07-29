import type { ReactNode } from 'react'

export default function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-paper text-paper-ink rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  )
}
