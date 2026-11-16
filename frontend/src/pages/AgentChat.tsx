import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  addPreference, deletePreference, errorMessage, getOrCreateUserId, listPreferences, setReady,
  type Preference, type Rule,
} from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import Button from '../components/Button'
import StepHeader from '../components/StepHeader'
import { EASE, rise, stagger } from '../lib/motion'

const INTRO =
  'I’m your scheduling agent. Tell me what you will and won’t do (mornings, buffers, days off) and I’ll hold the line for you in the negotiation.'

const SUGGESTIONS = [
  'I can’t do anything before 11am',
  'I’d rather be done by 6pm',
  'Keep Fridays free if you can',
  'I need 15 minutes between things',
]

function RuleChip({ rule }: { rule: Rule }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-mono text-[11px] tracking-wide ${
      rule.strength === 'hard' ? 'border-signal text-signal' : 'border-mist/60 text-mist'}`}>
      <span className="font-semibold">{rule.strength === 'hard' ? 'MUST' : 'PREFER'}</span>
      <span className="text-strip">{rule.summary}</span>
    </span>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export default function AgentChat() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { organiser } = useEventInfo(eventId)
  const [prefs, setPrefs] = useState<Preference[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getOrCreateUserId()
      .then(listPreferences)
      .then(setPrefs)
      .catch(() => setError("Couldn't load what you've already told your agent."))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [prefs.length, pending, error])

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || pending) return
    setInput('')
    setError(null)
    setPending(clean)
    try {
      const pref = await addPreference(await getOrCreateUserId(), clean, eventId)
      setPrefs((cur) => [...cur, pref])
    } catch (err) {
      setError(errorMessage(err, "I couldn't save that. Check the backend is running and try again."))
      setInput(clean)
    } finally {
      setPending(null)
    }
  }

  async function remove(id: string) {
    const before = prefs
    setPrefs((cur) => cur.filter((p) => p.id !== id))
    try {
      await deletePreference(await getOrCreateUserId(), id, eventId)
    } catch (err) {
      setPrefs(before)
      setError(errorMessage(err, "Couldn't remove that rule."))
    }
  }

  async function checkIn() {
    setCheckingIn(true)
    setError(null)
    try {
      await setReady(eventId, await getOrCreateUserId())
      navigate(`/event/${eventId}/negotiate`)
    } catch (err) {
      setError(errorMessage(err, "Couldn't mark you ready. Try again."))
      setCheckingIn(false)
    }
  }

  const ruleCount = prefs.reduce((n, p) => n + p.rules.length, 0)

  return (
    <div>
      <StepHeader current="briefing" organiser={organiser} />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-24 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="min-w-0 flex flex-col">
          <motion.h1 variants={rise} className="font-display font-bold text-5xl sm:text-6xl leading-[0.95] tracking-tight text-strip">
            Your preferences
          </motion.h1>

          <motion.div variants={rise} ref={log} role="log" aria-label="Conversation with your agent"
            className="mt-7 flex flex-col gap-4 max-h-[26rem] overflow-y-auto pr-2">
            <div className="max-w-[88%]">
              <p className="font-mono text-[11px] tracking-wider text-amber mb-1">AGENT</p>
              <p className="bg-board-raised px-4 py-3 text-[15px] leading-relaxed text-strip rounded-[2px]">{INTRO}</p>
            </div>
            <AnimatePresence initial={false}>
              {prefs.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE }} className="flex flex-col gap-4">
                  <div className="self-end max-w-[88%]">
                    <p className="font-mono text-[11px] tracking-wider text-mist mb-1 text-right">YOU</p>
                    <p className="bg-clearance px-4 py-3 text-[15px] leading-relaxed text-strip rounded-[2px]">{p.raw_text}</p>
                  </div>
                  <div className="max-w-[88%]">
                    <p className="font-mono text-[11px] tracking-wider text-amber mb-1">AGENT</p>
                    <div className="bg-board-raised px-4 py-3 rounded-[2px]">
                      <p className="text-[15px] leading-relaxed text-strip">{p.ack ?? 'Noted.'}</p>
                      {p.rules.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.rules.map((r, i) => <RuleChip key={i} rule={r} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {pending && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                <div className="self-end max-w-[88%]">
                  <p className="font-mono text-[11px] tracking-wider text-mist mb-1 text-right">YOU</p>
                  <p className="bg-clearance px-4 py-3 text-[15px] text-strip rounded-[2px]">{pending}</p>
                </div>
                <div className="max-w-[88%]" aria-live="polite">
                  <p className="font-mono text-[11px] tracking-wider text-amber mb-1">AGENT</p>
                  <p className="bg-board-raised px-4 py-3 rounded-[2px] flex gap-1.5" aria-label="Your agent is reading that">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-amber"
                        animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                    ))}
                  </p>
                </div>
              </motion.div>
            )}
            {error && <p role="alert" className="text-sm text-signal">{error}</p>}
          </motion.div>

          <motion.div variants={rise} className="mt-4 flex flex-wrap gap-2" aria-label="Things you could say">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} disabled={Boolean(pending)}
                className="rounded-[2px] border border-board-line px-3 py-1.5 text-sm text-mist hover:text-strip hover:border-mist disabled:opacity-50 transition-colors">
                {s}
              </button>
            ))}
          </motion.div>

          <motion.form variants={rise} onSubmit={(e) => { e.preventDefault(); void send(input) }}
            className="mt-4 flex items-stretch border border-board-line rounded-[2px] overflow-hidden bg-board-raised/50 focus-within:border-amber transition-colors">
            <label className="sr-only" htmlFor="brief-input">Tell your agent</label>
            <input id="brief-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
              placeholder="I hate mornings, nothing before 11…" autoComplete="off"
              className="flex-1 min-w-0 bg-transparent px-4 py-3 text-[15px] text-strip outline-none placeholder:text-mist" />
            <button type="submit" disabled={!input.trim() || Boolean(pending)}
              className="px-5 font-mono text-xs tracking-wider border-l border-board-line text-strip hover:text-amber disabled:opacity-40 disabled:pointer-events-none transition-colors">
              SEND
            </button>
          </motion.form>
        </motion.div>

        <motion.aside initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 }} className="min-w-0 lg:pt-24">
          <h2 className="font-display font-bold text-2xl tracking-tight text-strip">What your agent will enforce</h2>
          <p className="mt-1 text-sm text-mist">“Must” rules cross times out before anyone negotiates. “Prefer” rules make a time less likely.</p>

          <ul className="mt-5 flex flex-col gap-1.5" aria-live="polite">
            <AnimatePresence initial={false}>
              {prefs.flatMap((p) =>
                p.rules.map((r, i) => (
                  <motion.li key={`${p.id}-${i}`} layout="position"
                    initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 22 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex items-center gap-3 bg-strip text-strip-ink rounded-[2px] px-3 py-2.5">
                    <span className={`font-mono text-[11px] font-semibold tracking-wider w-14 shrink-0 ${
                      r.strength === 'hard' ? 'text-clearance-dim' : 'text-strip-ink/65'}`}>
                      {r.strength === 'hard' ? 'MUST' : 'PREFER'}
                    </span>
                    <span className="flex-1 min-w-0 text-[15px] leading-snug">{r.summary}</span>
                    <button type="button" onClick={() => remove(p.id)} aria-label={`Remove rule: ${r.summary}`}
                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[2px] text-strip-ink/65 hover:text-strip-ink hover:bg-strip-ink/10 transition-colors">
                      <Icon d="m4 4 8 8M12 4l-8 8" />
                    </button>
                  </motion.li>
                )),
              )}
            </AnimatePresence>
          </ul>
          {loaded && ruleCount === 0 && (
            <p className="mt-2 text-[15px] text-mist leading-relaxed">
              Nothing yet. With no rules your agent is happy with any time your calendar allows.
            </p>
          )}

          <div className="mt-8 border-t border-board-line pt-6">
            <Button arrow={!checkingIn} onClick={checkIn} disabled={checkingIn} className="w-full sm:w-auto">
              {checkingIn ? 'SAVING…' : 'I’M READY'}
            </Button>
            <p className="mt-3 text-sm text-mist">You can still change this until the organiser starts the negotiation.</p>
          </div>
        </motion.aside>
      </div>
    </div>
  )
}
