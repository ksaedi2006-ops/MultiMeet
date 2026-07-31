import { motion } from 'framer-motion'

/** The signature mark: a rectangular ink clearance stamp that lands when something becomes official. */
export default function Stamp({ label = 'CLEARED', size = 'md' }: { label?: string; size?: 'sm' | 'md' }) {
  return (
    <motion.div
      initial={{ scale: 1.9, opacity: 0, rotate: 8 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 280, damping: 14 }}
      className={`inline-flex items-center justify-center border-2 border-clearance text-clearance font-mono font-bold tracking-[0.15em] rounded-[2px] shrink-0 ${
        size === 'sm' ? 'text-[10px] px-2.5 py-1' : 'text-xs px-3.5 py-1.5'
      }`}
      style={{ boxShadow: '0 0 0 1px rgba(212,85,28,0.15), 0 6px 18px -6px rgba(212,85,28,0.5)' }}
    >
      {label}
    </motion.div>
  )
}
