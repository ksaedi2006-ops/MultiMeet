import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createSampleEvent, errorMessage, getOrCreateUserId, getSavedName, setUserName } from '../api/client'
import type { LogEvent } from '../api/events'
import Stamp from '../components/Stamp'
import { EASE } from '../lib/motion'
import { getRecents, rememberEvent } from '../lib/recents'
import demoLog from '../tower/demo-log.json'
import RadioTicker from '../tower/RadioTicker'
import { usePlayback } from '../tower/usePlayback'
import Atis from './Atis'
import BayStrip, { Box, EmptyHolder } from './BayStrip'
import { useFixture, useScopeFeed } from './context'

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

/** Attract mode: the recorded run flies on the scope, the ATIS reads the pitch, the bay offers strips. */
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
      landed && model.decision ? (
        <Stamp label={model.decision.status === 'converged' ? 'CLEARED' : 'HOLD'} detail={model.decision.slot?.label.toUpperCase()} size="lg" />
      ) : null,
    [landed, model.decision],
  )
  useScopeFeed({ model, onLanded, overlay, label: `Radar scope replaying a recorded negotiation between ${model.agents.length} simulated agents.` })

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

  const strips = (
    <div className="px-4 lg:px-5 py-5">
      <div className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.16em]">
        <h2 className="text-strip">STRIP BAY</h2>
        <span className="text-mist tabular-nums">{2 + recents.length} ACTIVE</span>
      </div>
      <motion.ul className="mt-3 flex flex-col gap-2" initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}>
        <motion.li className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
          <button type="button" onClick={() => navigate('/new')} className="block w-full text-left group" aria-label="New flight plan: schedule a meeting">
            <BayStrip holder="plan" code="FPL" layoutId="strip-fpl">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-px h-full">
                <Box code="ACID">
                  <span className="block font-display font-extrabold text-[30px] leading-[0.9] text-strip-ink">NEW</span>
                </Box>
                <Box code="RMK">
                  <span className="block text-[14px] leading-snug text-strip-ink">Schedule a meeting. Invite people; their agents settle the time.</span>
                </Box>
                <div className="bg-clearance text-strip flex items-center px-3.5 group-hover:bg-clearance-dim transition-colors"><Arrow /></div>
              </div>
            </BayStrip>
          </button>
        </motion.li>

        <motion.li className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
          <BayStrip holder="sim" code="SMPL">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
              <Box code="RMK">
                <span className="block text-[14px] leading-snug text-strip-ink">
                  Invent {size} students with real weeks and watch their agents negotiate.
                </span>
              </Box>
              <button type="button" onClick={runSample} disabled={busy}
                className="row-span-2 bg-strip-ink text-strip px-3.5 font-mono text-[11px] tracking-[0.14em] hover:bg-board transition-colors disabled:opacity-60">
                {busy ? 'LAUNCHING' : 'RUN'}
              </button>
              <Box code="ACFT" className="!pt-3.5 !pb-1.5">
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

        {recents.map((r) => (
          <motion.li key={r.id} className={pull} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}>
            <button type="button" onClick={() => navigate(`/event/${r.id}/negotiate`)} className="block w-full text-left" aria-label={`Open ${r.title}`}>
              <BayStrip holder="event" code="EVT">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-px">
                  <Box code="ACID"><span className="block truncate font-display font-bold text-[20px] leading-none text-strip-ink">{r.title}</span></Box>
                  <Box code="FILED">
                    <span className="block font-mono text-[12px] text-strip-ink tabular-nums">
                      {new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
                    </span>
                  </Box>
                </div>
              </BayStrip>
            </button>
          </motion.li>
        ))}
        {Array.from({ length: Math.max(1, 4 - recents.length) }, (_, i) => (
          <motion.li key={`empty-${i}`} className="hidden lg:block" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.6 } } }}>
            <EmptyHolder />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )

  const comms = (
    <div className="flex flex-col min-h-full">
      <Atis />
      <section aria-label="Recorded run" className="mt-auto px-5 lg:px-6 py-5 border-t border-board-line">
        <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-mist mb-3">
          <span>ON FREQUENCY · RECORDED RUN</span>
          <span className="tabular-nums">{model.agents.length || 14} SIM</span>
        </div>
        <RadioTicker model={model} />
      </section>
    </div>
  )

  return (
    <>
      {bay && createPortal(strips, bay)}
      {panel && createPortal(comms, panel)}
    </>
  )
}
