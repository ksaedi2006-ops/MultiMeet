import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createSampleEvent, errorMessage, getOrCreateUserId, getSavedName, setUserName } from '../api/client'
import type { LogEvent } from '../api/events'
import { EASE, rise, stagger } from '../lib/motion'
import { getRecents, rememberEvent } from '../lib/recents'
import Stamp from '../components/Stamp'
import demoLog from '../tower/demo-log.json'
import RadarScope from '../tower/RadarScope'
import RadioTicker from '../tower/RadioTicker'
import { usePlayback } from '../tower/usePlayback'

const SIZES = [8, 16, 30] as const

const PROTOCOL = [
  { title: 'Close', body: 'Code strikes every time somebody physically can’t make, and says whose class or shift did it.' },
  { title: 'Score', body: 'Each person’s agent rates what’s left from what they told it, in parallel.' },
  { title: 'Ask', body: 'The tower radios the people holding a good time back. Each agent accepts, flexes or holds.' },
  { title: 'Clear', body: 'The time that’s best for the least-happy person wins, with who gave something up.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const events = useMemo(() => demoLog as unknown as LogEvent[], [])
  const playback = usePlayback(events)
  const { model } = playback
  const [landed, setLanded] = useState(false)
  const [size, setSize] = useState<(typeof SIZES)[number]>(16)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const recents = useMemo(getRecents, [])

  // The recorded run loops: land, hold on the result, then fly it again.
  const replay = playback.replay
  useEffect(() => {
    if (!landed) return
    const id = window.setTimeout(() => {
      setLanded(false)
      replay()
    }, 7500)
    return () => window.clearTimeout(id)
  }, [landed, replay])

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

  const stampLabel = model.decision?.status === 'converged' ? 'CLEARED' : 'HOLD'

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-8 sm:pt-12 pb-24">
      <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center">
        <motion.div variants={stagger(0.09, 0.05)} initial="hidden" animate="show" className="min-w-0">
          <motion.h1 variants={rise}
            className="font-display font-bold text-[clamp(3rem,7.4vw,5.75rem)] leading-[0.92] tracking-tight text-strip">
            Nobody paints a grid.
            <span className="block text-signal">Your agents settle it.</span>
          </motion.h1>
          <motion.p variants={rise} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-strip/85">
            Everyone’s agent knows their calendar and what they’ll bend on. Code closes the times that can’t
            work, the agents bargain over the rest, and the fairest time wins, with the reason.
          </motion.p>

          <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/new"
              className="inline-flex items-center h-12 px-6 rounded-[2px] bg-clearance text-strip font-mono text-sm tracking-wider hover:bg-clearance-dim transition-colors">
              SCHEDULE A MEETING
            </Link>
            <div className="flex items-center h-12 border border-board-line rounded-[2px] overflow-hidden">
              <div role="radiogroup" aria-label="Sample size" className="flex h-full">
                {SIZES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}
                    className={`px-3 font-mono text-xs tracking-wider transition-colors ${
                      size === n ? 'bg-strip text-strip-ink' : 'text-mist hover:text-strip'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={runSample} disabled={busy}
                className="h-full px-4 border-l border-board-line font-mono text-xs tracking-wider text-strip hover:text-amber disabled:opacity-50 transition-colors">
                {busy ? 'LAUNCHING…' : 'RUN A SAMPLE'}
              </button>
            </div>
          </motion.div>
          <motion.p variants={rise} className="mt-3 text-sm text-mist max-w-[34rem]">
            A sample invents {size} students with realistic weeks, then runs the whole negotiation for you to watch.
          </motion.p>
          {error && <p role="alert" className="mt-3 text-sm text-signal">{error}</p>}

        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }} className="min-w-0">
          <div className="relative w-full aspect-square max-w-[640px] mx-auto">
            <RadarScope model={model} highlight={highlight} onHover={setHighlight} onLanded={() => setLanded(true)} />
            {model.decision && landed && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(6,12,18,0.72)_0%,rgba(6,12,18,0.5)_45%,transparent_70%)]" />
                <div className="relative"><Stamp label={stampLabel} detail={model.decision.slot?.label.toUpperCase()} size="lg" /></div>
              </div>
            )}
          </div>
          <div className="mt-3 max-w-[640px] mx-auto">
            <RadioTicker model={model} />
            <p className="mt-1 font-mono text-[11px] tracking-wider text-mist">
              RECORDED RUN · {model.agents.length || 14} SIMULATED AGENTS
            </p>
          </div>
        </motion.div>
      </div>

      {recents.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.5 }} className="mt-14 max-w-[34rem]" aria-labelledby="recent">
          <h2 id="recent" className="font-mono text-[11px] tracking-[0.16em] text-mist uppercase">Pick up where you left off</h2>
          <ul className="mt-2 divide-y divide-board-line border-y border-board-line">
            {recents.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link to={`/event/${r.id}/negotiate`}
                  className="flex items-center justify-between gap-4 py-2.5 text-strip hover:text-amber transition-colors">
                  <span className="truncate">{r.title}</span>
                  <span className="font-mono text-[11px] text-mist shrink-0">
                    {new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.section aria-labelledby="how" className="mt-24 sm:mt-32"
        variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
        <motion.h2 id="how" variants={rise}
          className="font-display font-bold text-3xl sm:text-5xl leading-none tracking-tight text-strip">
          How a negotiation runs
        </motion.h2>
        <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROTOCOL.map((p, i) => (
            <motion.li key={p.title} variants={rise} className="border-t-2 border-board-line pt-4 relative">
              <motion.span aria-hidden className="absolute -top-[2px] left-0 h-[2px] bg-amber"
                initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.15 }} />
              <h3 className="font-display font-bold text-2xl tracking-tight text-strip">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-strip/80">{p.body}</p>
            </motion.li>
          ))}
        </ol>
      </motion.section>
    </div>
  )
}
