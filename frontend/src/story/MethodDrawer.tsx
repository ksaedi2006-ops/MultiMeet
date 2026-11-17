import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'

const REPO = 'https://github.com/aperture71/MultiMeet/blob/main'

const STEPS: [string, string][] = [
  ['Rule out', 'Code crosses out every time that clashes with someone’s fixed commitments. Those are never negotiated.'],
  ['Score', 'Each agent turns its person’s calendar and preferences into a score for every time that’s left. The scores come from those rules, not from numbers a language model made up, and they’re put on a common scale so nobody can win by shouting louder.'],
  ['Pick the fairest', 'The solver chooses the time with the highest product of everyone’s scores (the Nash bargaining solution). A small floor stops one zero from vetoing a time outright, and ties go to whichever time leaves the least happy person better off.'],
  ['Ask for give', 'For up to three rounds, the mediator asks the one person whose concession would help the group most. Their agent can agree, flex a preference, or hold firm. It can only move within the flexibility its person declared, and never backwards.'],
  ['Explain', 'The mediator explains the result, and the app checks that the explanation names the person the decision actually turned on.'],
]

const RESULTS: [string, string][] = [
  ['0', 'hard-constraint violations: nobody was ever booked into a fixed commitment'],
  ['96%', 'as fair as the best possible time, on average (0.962 of an oracle that knows everyone’s true preferences)'],
  ['98%+', 'of picks are Pareto-optimal: no other time is better for someone and worse for nobody'],
  ['≤ 2', 'concession rounds at the median, even with 8 people'],
]

/** The method layer: the rule, the protocol and the measured results, for anyone who wants them. */
export default function MethodDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
          <motion.aside role="dialog" aria-modal="true" aria-labelledby="method-title"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative w-full max-w-[36rem] h-full overflow-y-auto bg-board border-l border-board-line px-6 py-7">
            <div className="flex items-start justify-between gap-4">
              <h2 id="method-title" className="font-display font-bold text-[2.2rem] leading-[0.95] text-strip">How it decides</h2>
              <button type="button" onClick={onClose} autoFocus
                className="h-9 px-3 rounded-[2px] border border-board-line font-mono text-[12px] tracking-[0.12em] text-strip/80 hover:border-amber hover:text-amber">
                CLOSE
              </button>
            </div>

            <p className="mt-4 text-[17px] leading-relaxed text-strip">
              Pick the time where nobody is left far behind. A time three people love and one person hates loses
              to a time everyone finds fine.
            </p>

            <h3 className="mt-7 font-mono text-[11px] tracking-[0.16em] text-amber">THE FIVE STEPS</h3>
            <ol className="mt-3 flex flex-col gap-3.5">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="font-mono text-[13px] text-amber tabular-nums pt-0.5">{i + 1}</span>
                  <p className="text-[15px] leading-relaxed text-strip/90"><span className="font-semibold text-strip">{title}.</span> {text}</p>
                </li>
              ))}
            </ol>

            <h3 className="mt-8 font-mono text-[11px] tracking-[0.16em] text-amber">TESTED ON 1,530 SIMULATED MEETINGS</h3>
            <p className="mt-2 text-[14px] text-mist">Groups of 3, 5 and 8 people, with the thresholds written down before the run.</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              {RESULTS.map(([n, t]) => (
                <div key={t} className="contents">
                  <dt className="font-display font-bold text-[1.8rem] leading-none text-strip tabular-nums">{n}</dt>
                  <dd className="text-[14px] leading-snug text-strip/85 pt-0.5">{t}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-8 font-mono text-[11px] tracking-[0.16em] text-amber">WHAT IT DOESN’T DO YET</h3>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-relaxed text-strip/85 list-disc pl-5">
              <li>With honest people it roughly ties, rather than beats, the app’s earlier and simpler rule: make the least happy person as happy as possible.</li>
              <li>Exaggerating preferences backfires, but faking an “I can’t make it” still pays off a little.</li>
              <li>These results use simulated agents. The live language-model agents weren’t part of this test.</li>
            </ul>

            <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
              <a href={`${REPO}/docs/eval/RESULTS.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Full results</a>
              <a href={`${REPO}/docs/eval/preregistration.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Preregistration</a>
              <a href={`${REPO}/docs/research/negotiation-layer.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Research behind it</a>
            </p>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
