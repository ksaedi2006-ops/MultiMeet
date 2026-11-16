import type { ReactNode } from 'react'

/** A printed field on a manila form: tracked label, ruled underline that lights on focus. */
export const inputClass =
  'w-full bg-transparent border-0 border-b-2 border-strip-ink/25 focus:border-clearance outline-none px-0 py-2 text-lg text-strip-ink placeholder:text-strip-ink/45 transition-colors'

export default function Field({ label, hint, children, className = '' }: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.14em] text-strip-ink/70 uppercase">
        {label}
        {hint && <span className="normal-case tracking-normal text-strip-ink/60">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
