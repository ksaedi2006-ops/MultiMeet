import type { Variants } from 'framer-motion'

/** One easing for everything that arrives: fast out, long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const

export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})

export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export const slideIn: Variants = {
  hidden: { opacity: 0, x: 28 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } },
}
