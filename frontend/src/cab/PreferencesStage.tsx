import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  addPreference, currentUserId, deletePreference, errorMessage, getCalendar, getOrCreateUserId, listPreferences,
  setReady, type BusyEvent, type Preference, type Rule,
} from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import { useEventLog } from '../api/useEventLog'
import { EASE } from '../lib/motion'
import { buildModel } from '../tower/model'
import BayStrip, { Box } from './BayStrip'
import { play, useGrowth } from '../lib/sound'
import { useCab, useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'

const SUGGESTIONS = [
  'I can’t do anything before 11am',
  'I’d rather be done by 6pm',
  'Keep Fridays free if you can',
  'Ideally around 2pm',
]

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

/** What the agent understood, in one plain sentence per rule. */
function understood(rule: Rule): string {
  return `${rule.summary}${rule.strength === 'hard' ? ', and that’s a must' : ', as a preference'}`
}

function localParts(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday)
  return { day, minutes: +p.hour * 60 + +p.minute }
}

const hm = (t?: string) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null)

/** Does a "must" rule rule this slot out? Mirrors the backend's hard-rule filter for display. */
function mustBlocks(rule: Rule, start: string, end: string, tz: string): boolean {
  if (rule.strength !== 'hard') return false
  const a = localParts(start, tz)
  const b = localParts(end, tz)
  if ((rule.kind === 'not_before' || rule.kind === 'not_after') && rule.weekdays?.length && !rule.weekdays.includes(a.day)) return false
  if (rule.kind === 'not_before') return hm(rule.time) !== null && a.minutes < hm(rule.time)!
  if (rule.kind === 'not_after') return hm(rule.time) !== null && (b.day !== a.day ? true : b.minutes > hm(rule.time)!)
  if (rule.kind === 'avoid_weekdays') return Boolean(rule.weekdays?.includes(a.day))
  return false
}

/**
 * Your preferences. You tell your agent in plain words; it confirms what it understood in
 * one sentence, and writes it on your card as a note. Your musts cross times out on the
 * ring alongside your fixed commitments.
 */
export default function PreferencesStage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { setHighlight } = useCab()
  const { event } = useEventInfo(eventId)
  const viewerId = currentUserId()
  const { events: log } = useEventLog(eventId || null, viewerId)
  const [prefs, setPrefs] = useState<Preference[]>([])
  const [busy, setBusy] = useState<BusyEvent[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const transcript = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getOrCreateUserId()
      .then(async (id) => {
        setPrefs(await listPreferences(id))
        setBusy((await getCalendar(id)).events)
      })
      .catch(() => setError("Couldn't load what you've already told your agent."))
  }, [])
  useEffect(() => {
    setHighlight(viewerId)
    return () => setHighlight(null)
  }, [setHighlight, viewerId])
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' })
  }, [prefs.length, pending, error])

  // Stable across renders: it feeds the scope model, and a fresh array would re-feed it every render.
  const rules = useMemo(
    () => prefs.flatMap((p) => p.rules.map((r, i) => ({ pref: p, rule: r, key: `${p.id}-${i}` }))),
    [prefs],
  )

  const model = useMemo(() => {
    const live = buildModel(log)
    if (!event) return live
    const me = live.agents.find((a) => a.id === viewerId)
    const who = { user_id: viewerId ?? '', name: me?.name ?? 'You' }
    const slots = previewSlots({
      start: event.start_date, end: event.end_date, duration: event.duration_minutes,
      earliest: event.earliest_hour, latest: event.latest_hour, weekdays: event.weekdays, tz: event.timezone,
    }).map((s) => {
      const a = Date.parse(s.start)
      const b = Date.parse(s.end)
      const clash = busy.find((e) => e.kind === 'hard' && Date.parse(e.start) < b && Date.parse(e.end) > a)
      if (clash) return { ...s, closed: true, blockers: [{ ...who, reason: clash.title }] }
      const must = rules.find(({ rule }) => mustBlocks(rule, s.start, s.end, event.timezone))
      return must ? { ...s, closed: true, blockers: [{ ...who, reason: `Rule: ${must.rule.summary}` }] } : s
    })
    return { ...live, slots }
  }, [log, event, busy, rules, viewerId])

  const closed = model.slots.filter((s) => s.closed).length
  useGrowth(closed, useCallback((n: number) => play('cross', n), []))
  useScopeFeed({
    model,
    label: `${closed} of ${model.slots.length} possible times are ruled out by your calendar and your musts.`,
    legend: 'Crossed out: times your calendar or your musts rule out. Preferences don’t cross anything out; they tip the balance.',
  })

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
      setError(errorMessage(err, "Couldn't remove that."))
    }
  }

  async function ready() {
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

  const myName = model.agents.find((a) => a.id === viewerId)?.name ?? 'You'

  const card = (
    <div className="px-4 lg:px-5 py-5">
      <h2 className="font-display font-bold text-[1.6rem] leading-none text-strip">Your card</h2>
      <p className="mt-1.5 text-[14px] text-mist">What your agent will hold to. Everyone sees your card; only you see your agent’s reasoning.</p>
      <div className="mt-4">
        <BayStrip holder="person">
          <div className="flex flex-col gap-px">
            <Box>
              <span className="block font-display font-bold text-[24px] leading-none text-strip-ink">{myName}</span>
              <span className="mt-1 block text-[13px] text-strip-ink/70">
                {busy.length ? (() => {
                  const count = (k: 'hard' | 'soft') => new Set(busy.filter((e) => e.kind === k).map((e) => e.title)).size
                  return `${count('hard')} fixed and ${count('soft')} movable commitments`
                })() : 'No calendar added'}
              </span>
            </Box>
            <Box className="min-h-28">
              {rules.length === 0 ? (
                <p className="font-[family-name:var(--font-hand)] text-[22px] leading-tight text-strip-ink/45 py-1">
                  Nothing yet: any time your calendar allows is fine.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 py-1" aria-live="polite">
                  <AnimatePresence initial={false}>
                    {rules.map(({ pref, rule, key }) => (
                      <motion.li key={key} layout="position" exit={{ opacity: 0, transition: { duration: 0.25 } }}
                        className="group flex items-center gap-2">
                        {/* Written out left to right, like a note being added to the card. */}
                        <motion.span initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }}
                          transition={{ duration: 0.9, ease: [0.45, 0, 0.2, 1] }}
                          className={`flex-1 min-w-0 font-[family-name:var(--font-hand)] text-[24px] leading-tight ${
                            rule.strength === 'hard' ? 'text-clearance-dim' : 'text-strip-ink'}`}>
                          {rule.strength === 'hard' ? 'Must: ' : ''}{rule.summary}
                        </motion.span>
                        <button type="button" onClick={() => remove(pref.id)} aria-label={`Remove: ${rule.summary}`}
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[2px] text-strip-ink/45 hover:text-strip-ink hover:bg-strip-ink/10 transition-colors">
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6"
                            strokeLinecap="round" aria-hidden><path d="m4 4 8 8M12 4l-8 8" /></svg>
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </Box>
          </div>
        </BayStrip>
      </div>
      <p className="mt-3 text-[13px] text-mist">
        <span className="text-signal font-semibold">Must</span> crosses times out before anyone negotiates.
        Everything else is a preference your agent weighs.
      </p>
    </div>
  )

  const chat = (
    <div className="px-5 lg:px-6 py-6 flex flex-col gap-4 lg:min-h-full">
      <div>
        <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] tracking-tight text-strip">Your preferences</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-strip/80">
          Tell your agent what you will and won’t do, in your own words.
        </p>
      </div>

      <div ref={transcript} role="log" aria-label="Conversation with your agent"
        className="flex flex-col gap-3 lg:max-h-[38svh] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {prefs.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }} className="flex flex-col gap-2">
              <p className="self-end max-w-[90%] bg-strip px-3.5 py-2.5 text-[15px] leading-snug text-strip-ink rounded-[2px]">
                {p.raw_text}
              </p>
              <div className="max-w-[90%] bg-board-raised px-3.5 py-2.5 rounded-[2px]">
                <p className="text-[12px] text-amber mb-1">Your agent</p>
                {p.rules.length ? (
                  <p className="text-[15px] leading-snug text-strip">Got it: {p.rules.map(understood).join('; ')}.</p>
                ) : (
                  <p className="text-[15px] leading-snug text-strip">{p.ack ?? 'Noted.'}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {pending && (
          <div className="flex flex-col gap-2">
            <p className="self-end max-w-[90%] bg-strip px-3.5 py-2.5 text-[15px] text-strip-ink rounded-[2px]">{pending}</p>
            <p className="bg-board-raised px-3.5 py-3 rounded-[2px] flex gap-1.5 self-start" aria-label="Your agent is reading that">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-amber"
                  animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
              ))}
            </p>
          </div>
        )}
        {prefs.length === 0 && !pending && (
          <p className="text-[14px] text-mist">For example: mornings, days off, how late you’ll stay, a gap between things.</p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-signal">{error}</p>}

      <div className="flex flex-wrap gap-1.5" aria-label="Things you could say">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} disabled={Boolean(pending)}
            className="px-2.5 py-1.5 rounded-[2px] border border-board-line text-[13px] text-strip/80 hover:border-strip/60 hover:text-strip disabled:opacity-50 transition-colors">
            {s}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input) }}
        className="flex items-stretch border border-board-line rounded-[2px] overflow-hidden bg-black/20 focus-within:border-amber">
        <label className="sr-only" htmlFor="pref-input">Tell your agent</label>
        <input id="pref-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
          placeholder="I hate mornings, nothing before 11…" autoComplete="off"
          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-[15px] text-strip outline-none" />
        <button type="submit" disabled={!input.trim() || Boolean(pending)}
          className="px-4 font-mono text-xs tracking-wider border-l border-board-line text-strip hover:text-amber disabled:opacity-40 transition-colors">
          SEND
        </button>
      </form>

      <div className="mt-2">
        <button type="button" onClick={ready} disabled={checkingIn}
          className="inline-flex items-center gap-2.5 h-12 px-5 rounded-[2px] bg-clearance text-strip font-mono text-[13px] tracking-[0.14em] hover:bg-clearance-dim disabled:opacity-60 transition-colors">
          {checkingIn ? 'SAVING…' : <>I’M READY <Arrow /></>}
        </button>
        <p className="mt-2 text-[13px] text-mist">You can change this until the organiser starts the negotiation.</p>
      </div>
    </div>
  )

  return (
    <>
      {bay && createPortal(card, bay)}
      {panel && createPortal(chat, panel)}
    </>
  )
}
