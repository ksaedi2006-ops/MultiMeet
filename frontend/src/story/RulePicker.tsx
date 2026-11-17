import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { RuleId, RuleOutcome } from '../api/events'
import { EASE } from '../lib/motion'
import { RULES, RULE, USED_RULE } from '../lib/rules'
import { dayAndClock } from '../lib/timeLabels'

interface Props {
  rule: RuleId
  onChange: (r: RuleId) => void
  outcomes: RuleOutcome[] // empty until the negotiation is decided
}

/**
 * The decision-rule switch in the top bar. Every rule is run on the same final preferences, so
 * switching shows what each one would have booked; the booking itself always used Nash.
 */
export default function RulePicker({ rule, onChange, outcomes }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const byRule = new Map(outcomes.map((o) => [o.rule, o]))
  const used = byRule.get(USED_RULE)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} className="relative flex items-stretch border-l border-board-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox"
        className={`flex items-center gap-2 px-4 transition-colors ${open ? 'bg-board-raised text-amber' : 'text-strip hover:text-amber'}`}>
        <span className="text-mist hidden md:inline">RULE</span>
        <span>{RULE[rule].short}</span>
        {rule !== USED_RULE && <span className="text-signal hidden md:inline">WHAT IF</span>}
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="listbox" aria-label="Decision rule"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="fixed left-2 right-2 top-12 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[27rem] z-50 bg-console border border-board-line shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] font-sans tracking-normal">
            <p className="px-4 pt-3.5 pb-2.5 text-[13px] leading-snug text-mist border-b border-board-line">
              Five rules from economics, run on the same people’s final preferences.
              {outcomes.length ? ' The booking used Nash; pick another to see what it would have done.' : ' Their picks appear once the agents finish.'}
            </p>
            <ul className="max-h-[70vh] overflow-y-auto">
              {RULES.map((r) => {
                const o = byRule.get(r.id)
                const same = o?.slot_id && used?.slot_id === o.slot_id && r.id !== USED_RULE
                const selected = r.id === rule
                return (
                  <li key={r.id}>
                    <button type="button" role="option" aria-selected={selected}
                      onClick={() => { onChange(r.id); setOpen(false) }}
                      className={`w-full text-left px-4 py-3 border-b border-board-line/60 transition-colors ${selected ? 'bg-amber/[0.08]' : 'hover:bg-board-raised/60'}`}>
                      <span className="flex items-baseline gap-2">
                        <span className={`font-mono text-[11px] tracking-[0.12em] w-12 shrink-0 ${selected ? 'text-amber' : 'text-mist'}`}>{r.short}</span>
                        <span className="text-[15px] font-semibold text-strip">{r.name}</span>
                        {r.id === USED_RULE && <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-amber">USED</span>}
                      </span>
                      <span className="mt-1 block pl-14 text-[13px] leading-snug text-strip/80">{r.idea}</span>
                      {o?.slot_id && (
                        <span className="mt-1.5 flex flex-wrap gap-x-3 pl-14 text-[12px] text-mist tabular-nums">
                          <span className="text-strip">{dayAndClock(o.label ?? '')}{same ? ' (same)' : ''}</span>
                          <span>least happy {o.min_score}/100</span>
                          <span>average {Math.round(o.avg_score ?? 0)}</span>
                          {o.pareto_dominated_by && <span className="text-signal">wasteful</span>}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
