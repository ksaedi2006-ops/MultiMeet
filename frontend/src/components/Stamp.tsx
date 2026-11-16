import { motion } from 'framer-motion'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  sm: 'text-[10px] px-2.5 py-1',
  md: 'text-xs px-3.5 py-1.5',
  // Filled with the scope glass so sweep and runway lines never cross the lettering.
  lg: 'text-3xl sm:text-5xl px-6 py-2.5 border-[3px] bg-glass',
}

/** The signature mark: a rectangular ink clearance stamp that lands when something becomes official. */
export default function Stamp({ label = 'BOOKED', detail, size = 'md' }: { label?: string; detail?: string; size?: Size }) {
  return (
    <motion.div
      initial={{ scale: 1.9, opacity: 0, rotate: 8 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 280, damping: 14 }}
      className={`inline-flex flex-col items-center justify-center border-2 border-clearance text-clearance font-mono font-bold tracking-[0.15em] rounded-[2px] shrink-0 ${SIZES[size]}`}
    >
      <span className={size === 'lg' ? 'font-display tracking-[0.12em]' : undefined}>{label}</span>
      {detail && <span className="mt-1 font-mono text-[11px] sm:text-sm tracking-[0.2em] font-semibold">{detail}</span>}
    </motion.div>
  )
}
