import type { ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'ghost' | 'ghost-ink' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-seal text-paper hover:bg-seal-dim disabled:bg-seal/40',
  // for use on paper (light) surfaces
  ghost: 'border border-paper-ink/25 text-paper-ink hover:border-paper-ink/60 disabled:opacity-40',
  // for use directly on the dark page background
  'ghost-ink': 'border border-paper/20 text-paper hover:border-brass hover:text-brass disabled:opacity-40',
  quiet: 'text-mist hover:text-brass disabled:opacity-40',
}

// framer-motion's HTMLMotionProps redefines drag/animation event handlers with
// its own gesture-aware signatures, which conflict with the native DOM ones.
type NativeProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

interface Props extends NativeProps {
  variant?: Variant
}

export default function Button({ variant = 'primary', className = '', children, ...props }: Props) {
  const isQuiet = variant === 'quiet'
  return (
    <motion.button
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      className={`font-mono text-sm tracking-wide rounded-[3px] transition-colors disabled:cursor-not-allowed ${
        isQuiet ? 'px-0 py-1' : 'px-5 py-3'
      } ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}
