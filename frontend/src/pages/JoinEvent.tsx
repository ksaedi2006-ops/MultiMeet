import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getEventByInvite, getOrCreateUserId, getSavedName, joinEvent, setUserName, errorMessage, type EventInfo } from '../api/client'
import Button from '../components/Button'
import Field, { inputClass } from '../components/Field'
import Strip from '../components/Strip'
import { rise, stagger } from '../lib/motion'
import { rememberEvent } from '../lib/recents'

const NEXT = [
  'Show your agent your calendar, or skip it.',
  'Tell it what you will and won’t do.',
  'Say you’re ready. The organiser starts the negotiation.',
]

export default function JoinEvent() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [name, setName] = useState(getSavedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    getEventByInvite(inviteCode).then(setEvent, () => setMissing(true))
  }, [inviteCode])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, name)
      const joined = await joinEvent(inviteCode, userId)
      rememberEvent(joined.event_id, joined.title)
      navigate(`/event/${joined.event_id}/upload`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, "Couldn't join. Check that the backend is running, then try again."))
      setLoading(false)
    }
  }

  if (missing) {
    return (
      <div className="max-w-xl mx-auto px-5 py-20">
        <h1 className="font-display font-bold text-5xl text-strip leading-none">This invite doesn’t work</h1>
        <p className="mt-4 text-strip/85 text-[17px] leading-relaxed">
          The link may be mistyped, or the organiser started over. Ask them to send it again.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-24 grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-start">
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="min-w-0">
        <motion.h1 variants={rise} className="font-display font-bold text-[clamp(3rem,8vw,5.5rem)] leading-[0.92] tracking-tight text-strip">
          {event ? event.title : '…'}
        </motion.h1>
        <motion.p variants={rise} className="mt-4 text-[17px] text-strip/85">You’re invited. Here’s what happens next.</motion.p>
        <motion.ol variants={rise} className="mt-8 space-y-3 max-w-[28rem]">
          {NEXT.map((line) => (
            <li key={line} className="flex gap-3 text-[16px] text-strip/85 leading-snug">
              <span aria-hidden className="mt-2 h-px w-5 bg-amber shrink-0" />
              {line}
            </li>
          ))}
        </motion.ol>
      </motion.div>

      <motion.form onSubmit={handleJoin} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }} className="min-w-0">
        <Strip className="p-6 sm:p-8 flex flex-col gap-7">
          <Field label="Your name" hint="what the group will see">
            <input autoFocus required className={inputClass} placeholder="Kofi Mensah" value={name}
              onChange={(e) => setName(e.target.value)} disabled={!event} maxLength={60} />
          </Field>
          <Button arrow={!loading} disabled={loading || !event} className="self-start">
            {loading ? 'JOINING…' : 'JOIN THE MEETING'}
          </Button>
          {error && <p role="alert" className="text-sm text-clearance-dim -mt-3">{error}</p>}
        </Strip>
      </motion.form>
    </div>
  )
}
