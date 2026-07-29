import { motion } from 'framer-motion'

/** The signature mark: a wax-seal stamp that lands when something becomes official. */
export default function Seal({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <motion.div
      initial={{ scale: 2.2, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      className="inline-flex items-center justify-center rounded-full bg-seal text-paper shrink-0"
      style={{ width: size, height: size }}
      aria-hidden={!label}
    >
      <svg viewBox="0 0 24 24" width={size * 0.52} height={size * 0.52} fill="none">
        <path
          d="M12 3l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7L12 3z"
          fill="currentColor"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </motion.div>
  )
}
