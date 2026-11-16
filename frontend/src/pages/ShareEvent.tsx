import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { addSamplePeople, currentUserId, errorMessage, type Member } from '../api/client'
import { useEventInfo } from '../api/useEventInfo'
import { useEventLog } from '../api/useEventLog'
import Button from '../components/Button'
import Stamp from '../components/Stamp'
import StepHeader from '../components/StepHeader'
import { EASE, rise, stagger } from '../lib/motion'
import { buildModel } from '../tower/model'
import RadarScope from '../tower/RadarScope'

const SIZES = [6, 12, 24] as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`font-mono text-[11px] tracking-wider px-1.5 py-0.5 rounded-[2px] border transition-colors ${
      on ? 'border-strip-ink/70 text-strip-ink' : 'border-strip-ink/20 text-strip-ink/55'}`}>
      {children}
    </span>
  )
}

export default function ShareEvent() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const filed = Boolean((useLocation().state as { filed?: boolean } | null)?.filed)
  const { event } = useEventInfo(eventId)
  const viewerId = currentUserId()
  const { events } = useEventLog(eventId || null, viewerId)
  const model = useMemo(() => buildModel(events), [events])
  const [copied, setCopied] = useState(false)
  const [size, setSize] = useState<(typeof SIZES)[number]>(12)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)

  const members = useMemo(() => {
    const byId = new Map<string, Member>()
    for (const e of events) {
      if (e.type === 'member_joined' || e.type === 'member_updated') {
        const { user_id, name, role, ready, calendar_events, rules } = e
        byId.set(user_id, { user_id, name, role, ready, calendar_events, rules })
      }
    }
    return [...byId.values()]
  }, [events])

  const shareLink = event ? `${window.location.origin}/join/${event.invite_code}` : ''
  const organiser = event ? event.organizer_id === viewerId : true
  const ready = members.filter((m) => m.ready).length

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      // Plain-HTTP origins can't use the clipboard API; fall back to selecting the field.
      const input = document.getElementById('share-link') as HTMLInputElement | null
      input?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function addPeople() {
    setError(null)
    setAdding(true)
    try {
      await addSamplePeople(eventId, viewerId!, size)
    } catch (err) {
      setError(errorMessage(err, "Couldn't add sample people."))
    } finally {
      window.setTimeout(() => setAdding(false), 1200)
    }
  }

  return (
    <div>
      <StepHeader current="share" />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-24 grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="min-w-0">
          <motion.div variants={rise} className="flex items-start justify-between gap-4">
            <h1 className="font-display font-bold text-5xl sm:text-6xl leading-[0.95] tracking-tight text-strip">
              Invite people
            </h1>
            {filed && <div className="pt-2 pr-1"><Stamp label="CREATED" size="md" /></div>}
          </motion.div>
          <motion.p variants={rise} className="mt-4 text-[17px] leading-relaxed text-strip/85 max-w-[30rem]">
            Send this link to everyone you want in “{event?.title ?? '…'}”. Their agents show up on the circle as they join.
          </motion.p>

          <motion.div variants={rise} className="mt-7 flex items-stretch border border-board-line rounded-[2px] overflow-hidden bg-board-raised/60">
            <input id="share-link" readOnly value={shareLink} aria-label="Invite link"
              className="flex-1 min-w-0 bg-transparent px-4 py-3 font-mono text-sm text-strip outline-none"
              onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy}
              className="px-5 font-mono text-xs tracking-wider border-l border-board-line text-strip hover:text-amber transition-colors">
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </motion.div>
          <p className="sr-only" role="status">{copied ? 'Invite link copied' : ''}</p>

          <motion.section variants={rise} className="mt-9" aria-label="Who has joined">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display font-bold text-2xl tracking-tight text-strip">Who’s joined</h2>
              <span className="font-mono text-xs text-mist tabular-nums" aria-live="polite">
                {members.length} joined · {ready} ready
              </span>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 max-h-[22rem] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {members.map((m) => (
                  <motion.li key={m.user_id} layout="position"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    onPointerEnter={() => setHighlight(m.user_id)} onPointerLeave={() => setHighlight(null)}
                    className={`flex items-center gap-3 bg-strip text-strip-ink rounded-[2px] px-3 py-2 outline outline-2 transition-[outline-color] ${
                      highlight === m.user_id ? 'outline-amber' : 'outline-transparent'}`}>
                    <span aria-hidden className="w-8 h-8 rounded-full bg-strip-ink/10 flex items-center justify-center font-mono text-[11px] font-semibold shrink-0">
                      {initials(m.name)}
                    </span>
                    <span className="flex-1 min-w-0 truncate">
                      {m.name}
                      {m.role === 'admin' && <span className="ml-2 font-mono text-[11px] text-strip-ink/65">ORGANISER</span>}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5">
                      <Pill on={m.calendar_events > 0}>CALENDAR</Pill>
                      <Pill on={m.rules > 0}>{m.rules > 0 ? `${m.rules} ${m.rules === 1 ? 'RULE' : 'RULES'}` : 'RULES'}</Pill>
                    </span>
                    <span className={`font-mono text-[11px] tracking-wider w-[5.5rem] text-right ${
                      m.ready ? 'text-clearance-dim font-semibold' : 'text-strip-ink/65'}`}>
                      {m.ready ? 'READY' : 'SETTING UP'}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>

          {organiser && (
            <motion.div variants={rise} className="mt-6 flex flex-wrap items-center gap-3 border-t border-board-line pt-5">
              <span className="text-sm text-mist">Want a crowd to watch?</span>
              <div className="flex items-center h-10 border border-board-line rounded-[2px] overflow-hidden">
                <div role="radiogroup" aria-label="How many sample people" className="flex h-full">
                  {SIZES.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}
                      className={`px-3 font-mono text-xs transition-colors ${size === n ? 'bg-strip text-strip-ink' : 'text-mist hover:text-strip'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={addPeople} disabled={adding}
                  className="h-full px-4 border-l border-board-line font-mono text-xs tracking-wider text-strip hover:text-amber disabled:opacity-50 transition-colors">
                  {adding ? 'ADDING…' : 'ADD SAMPLE PEOPLE'}
                </button>
              </div>
              {error && <p role="alert" className="w-full text-sm text-signal">{error}</p>}
            </motion.div>
          )}

          <motion.div variants={rise} className="mt-8">
            <Button arrow onClick={() => navigate(`/event/${eventId}/upload`)} className="w-full sm:w-auto">
              CONTINUE: SET UP MY AGENT
            </Button>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} className="min-w-0 lg:sticky lg:top-8 self-start">
          <div className="relative w-full aspect-square max-w-[560px] mx-auto">
            <RadarScope model={model} highlight={highlight} onHover={setHighlight} onLanded={() => {}} />
          </div>
          <p className="mt-2 text-center font-mono text-[11px] tracking-wider text-mist">
            {members.length} {members.length === 1 ? 'PERSON’S AGENT' : 'PEOPLE’S AGENTS'} WAITING TO NEGOTIATE
          </p>
        </motion.div>
      </div>
    </div>
  )
}
