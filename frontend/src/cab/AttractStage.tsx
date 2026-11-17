import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createSampleEvent, errorMessage, getOrCreateUserId, getSavedName, setUserName } from '../api/client'
import type { LogEvent } from '../api/events'
import { EASE } from '../lib/motion'
import { getRecents, rememberEvent } from '../lib/recents'
import demoLog from '../tower/demo-log.json'
import RadioTicker from '../tower/RadioTicker'
import { usePlayback } from '../tower/usePlayback'
import Atis from './Atis'
import BayStrip, { Box } from './BayStrip'
import { useCab, useFixture, useScopeFeed } from './context'
import ChosenTime from '../tower/ChosenTime'

const SIZES = [8, 16, 30] as const

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

const pull = 'transition-transform duration-300 ease-out-expo hover:translate-x-1.5 focus-within:translate-x-1.5'

/** The first screen: a recorded negotiation replays on the scope, the right panel explains it, the left offers what to do. */
export default function AttractStage() {
  const navigate = useNavigate()
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const events = useMemo(() => demoLog as unknown as LogEvent[], [])
  const playback = usePlayback(events)
  const { model, replay } = playback
  const [landed, setLanded] = useState(false)
  const [size, setSize] = useState<(typeof SIZES)[number]>(16)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recents = useMemo(() => getRecents().slice(0, 3), [])

  // The recorded run loops: land, hold on the result, then fly it again.
  useEffect(() => {
    if (!landed) return
    const id = window.setTimeout(() => {
      setLanded(false)
      replay()
    }, 7500)
    return () => window.clearTimeout(id)
  }, [landed, replay])

  const onLanded = useCallback(() => setLanded(true), [])
  const overlay = useMemo(
    () =>
      landed && model.decision ? <ChosenTime decision={model.decision} timezone={model.timezone} /> : null,
    [landed, model.decision, model.timezone],
  )
  // Idle tour: after 20 s without input, point at each person in turn so their tag shows
  // what their agent is doing. Any pointer, key or scroll stops it (and restarts the clock).
  const { setHighlight } = useCab()
  const touring = useRef(false)
  const agentIds = useMemo(() => model.agents.map((a) => a.id).join(','), [model.agents])
  useEffect(() => {
    const ids = agentIds ? agentIds.split(',') : []
    if (!ids.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let idle = 0
    let step = 0
    let timer = 0
    const stop = () => {
      idle = 0
      if (touring.current) {
        touring.current = false
        setHighlight(null)
      }
    }
    timer = window.setInterval(() => {
      idle += 1
      if (idle >= 20 && (idle - 20) % 3 === 0) {
        touring.current = true
        setHighlight(ids[step++ % ids.length])
      }
    }, 1000)
    const opts = { passive: true } as const
    window.addEventListener('pointermove', stop, opts)
    window.addEventListener('pointerdown', stop, opts)
    window.addEventListener('keydown', stop)
    window.addEventListener('wheel', stop, opts)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointermove', stop)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('keydown', stop)
      window.removeEventListener('wheel', stop)
      if (touring.current) setHighlight(null)
    }
  }, [agentIds, setHighlight])

  useScopeFeed({
    model, onLanded, overlay,
    label: `Replay of ${model.agents.length} people's agents negotiating a meeting time.`,
  })

  async function runSample() {
    setError(null)
    setBusy(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, getSavedName() || 'Alex')
      const event = await createSampleEvent(userId, size)
      rememberEvent(event.event_id, event.title)
      navigate(`/event/${event.event_id}/negotiate`)
    } catch (err) {
      setError(errorMessage(err, "Couldn't start a sample. Check that the backend is running, then try again."))
      setBusy(false)
    }
  }

  const ticker = (where: string) => (
    <section aria-label="What's happening in the replay" className={`px-5 lg:px-6 py-5 border-t border-board-line ${where}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[13px] text-mist">Replay of a recorded run</span>
        <span className="px-2 py-0.5 border border-mist/40 rounded-[2px] text-[12px] text-mist whitespace-nowrap">
          {model.agents.length || 14} people · simulated agents
        </span>
      </div>
      <RadioTicker model={model} />
    </section>
  )

  const strips = (
    <div className="px-4 lg:px-5 py-5">
      <h2 className="sr-only">Get started</h2>
      <motion.ul className="mt-3 flex flex-col gap-2" initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
        <motion.li className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
          <button type="button" onClick={() => navigate('/new')} className="block w-full text-left group">
            <BayStrip holder="plan" layoutId="strip-fpl">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px h-full">
                <Box>
                  <span className="block font-display font-bold text-[26px] leading-none text-strip-ink">Schedule a meeting</span>
                  <span className="block mt-1.5 text-[14px] leading-snug text-strip-ink/80">Invite people. Their agents settle the time.</span>
                </Box>
                <div className="bg-clearance text-strip flex items-center px-3.5 group-hover:bg-clearance-dim transition-colors"><Arrow /></div>
              </div>
            </BayStrip>
          </button>
        </motion.li>

        <motion.li className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
          <BayStrip holder="sim">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
              <Box>
                <span className="block font-display font-bold text-[26px] leading-none text-strip-ink">Run a sample</span>
                <span className="block mt-1.5 text-[14px] leading-snug text-strip-ink/80">
                  Invent {size} students with realistic weeks and watch their agents negotiate.
                </span>
              </Box>
              <button type="button" onClick={runSample} disabled={busy}
                className="row-span-2 bg-strip-ink text-strip px-3.5 font-mono text-[11px] tracking-[0.14em] hover:bg-board transition-colors disabled:opacity-60">
                {busy ? 'STARTING' : 'RUN'}
              </button>
              <Box code="People" className="!pb-2">
                <div role="radiogroup" aria-label="How many sample people" className="flex gap-1.5">
                  {SIZES.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}
                      className={`min-w-9 h-7 px-2 rounded-[2px] font-mono text-xs border transition-colors ${
                        size === n ? 'bg-strip-ink text-strip border-strip-ink' : 'border-strip-ink/30 text-strip-ink hover:border-strip-ink'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </Box>
            </div>
          </BayStrip>
          {error && <p role="alert" className="mt-2 text-sm text-signal">{error}</p>}
        </motion.li>

        <motion.li className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
          <button type="button" onClick={() => navigate('/lab')} className="block w-full text-left group">
            <BayStrip holder="person">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px h-full">
                <Box>
                  <span className="block font-display font-bold text-[26px] leading-none text-strip-ink">Explore the Lab</span>
                  <span className="block mt-1.5 text-[14px] leading-snug text-strip-ink/80">
                    The research behind it: 14 decision rules from economics, raced on simulated meetings.
                  </span>
                </Box>
                <div className="bg-strip-ink text-strip flex items-center px-3.5 group-hover:bg-board transition-colors"><Arrow /></div>
              </div>
            </BayStrip>
          </button>
        </motion.li>

        {recents.map((r) => (
          <motion.li key={r.id} className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
            <button type="button" onClick={() => navigate(`/event/${r.id}/negotiate`)} className="block w-full text-left" aria-label={`Open ${r.title}`}>
              <BayStrip holder="event">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
                  <Box code="Recent"><span className="block truncate font-display font-bold text-[20px] leading-none text-strip-ink">{r.title}</span></Box>
                  <Box code="Created">
                    <span className="block text-[14px] text-strip-ink tabular-nums">
                      {new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </Box>
                </div>
              </BayStrip>
            </button>
          </motion.li>
        ))}
      </motion.ul>
    {ticker('lg:hidden mt-2 -mx-4')}
    </div>
  )


  const comms = (
    <div className="flex flex-col min-h-full">
      <Atis />
      {/* On a phone the cards are a long scroll away, so the two actions come right here. */}
      <div className="lg:hidden px-5 pb-6 -mt-1 flex flex-wrap gap-2">
        <button type="button" onClick={runSample} disabled={busy}
          className="h-11 px-4 rounded-[2px] bg-clearance text-strip font-mono text-[12px] tracking-[0.14em] hover:bg-clearance-dim disabled:opacity-60 transition-colors">
          {busy ? 'STARTING…' : 'RUN A SAMPLE'}
        </button>
        <button type="button" onClick={() => navigate('/new')}
          className="h-11 px-4 rounded-[2px] border border-strip/50 text-strip font-mono text-[12px] tracking-[0.14em] hover:border-strip transition-colors">
          SCHEDULE A MEETING
        </button>
        {error && <p role="alert" className="w-full text-sm text-signal">{error}</p>}
      </div>
      {ticker('hidden lg:block mt-auto')}
    </div>
  )

  return (
    <>
      {bay && createPortal(strips, bay)}
      {panel && createPortal(comms, panel)}
    </>
  )
}
