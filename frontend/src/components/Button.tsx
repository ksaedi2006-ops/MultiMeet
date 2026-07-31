import type { ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'ghost' | 'ghost-ink' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-clearance text-strip hover:bg-clearance-dim disabled:bg-clearance/40',
  // for use on strip (light manila) surfaces
  ghost: 'border border-strip-ink/25 text-strip-ink hover:border-strip-ink/60 disabled:opacity-40',
  // for use directly on the dark board background
  'ghost-ink': 'border border-strip/20 text-strip hover:border-amber hover:text-amber disabled:opacity-40',
  quiet: 'text-mist hover:text-amber disabled:opacity-40',
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
