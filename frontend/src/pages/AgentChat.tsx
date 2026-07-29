import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { addPreference, getOrCreateUserId, listPreferences, markReady } from '../api/client'
import StepHeader from '../components/StepHeader'
import Button from '../components/Button'

interface ChatMessage {
  from: 'user' | 'agent'
  text: string
}

const INTRO =
  "I'm your scheduling agent. Tell me anything about your preferences — mornings, buffer time, days off — and I'll advocate for it during negotiation."

export default function AgentChat() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: 'agent', text: INTRO }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadExisting() {
      const userId = await getOrCreateUserId()
      const prefs = await listPreferences(userId)
      if (prefs.length) {
        const history = prefs.flatMap((p) => [
          { from: 'user' as const, text: p.raw_text },
          { from: 'agent' as const, text: p.parsed_rules.ack ?? "Got it, I'll factor that in." },
        ])
        setMessages((prev) => [prev[0], ...history])
      }
    }
    loadExisting()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { from: 'user', text }])
    setSending(true)
    try {
      const userId = await getOrCreateUserId()
      const pref = await addPreference(userId, text)
      setMessages((prev) => [
        ...prev,
        { from: 'agent', text: pref.parsed_rules.ack ?? "Got it, I'll factor that in." },
      ])
    } catch {
      setMessages((prev) => [...prev, { from: 'agent', text: 'Sorry, I had trouble parsing that.' }])
    } finally {
      setSending(false)
    }
  }

  async function handleReady() {
    setCheckingIn(true)
    try {
      const userId = await getOrCreateUserId()
      await markReady(eventId, userId)
      navigate(`/event/${eventId}/negotiate`)
    } catch {
      setCheckingIn(false)
    }
  }

  return (
    <div>
      <StepHeader step={3} />
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-8 flex flex-col h-[75vh]">
        <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-2">BRIEFING</p>
        <h1 className="font-mono text-xl sm:text-2xl font-semibold mb-6">Talk to your agent</h1>

        <div ref={logRef} className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 pr-1">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`max-w-[85%] ${m.from === 'user' ? 'self-end' : 'self-start'}`}
            >
              <p
                className={`font-mono text-[10px] tracking-widest mb-1 ${
                  m.from === 'user' ? 'text-right text-mist' : 'text-brass'
                }`}
              >
                {m.from === 'user' ? 'YOU' : 'AGENT'}
              </p>
              <div
                className={`rounded-sm px-4 py-2.5 text-sm leading-relaxed ${
                  m.from === 'agent'
                    ? 'bg-ink-raised border-l-2 border-brass'
                    : 'bg-seal text-paper'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
          {sending && (
            <div className="self-start">
              <p className="font-mono text-[10px] tracking-widest mb-1 text-brass">AGENT</p>
              <div className="rounded-sm px-4 py-2.5 text-sm bg-ink-raised border-l-2 border-brass text-mist">
                thinking…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-3 mb-5 border-t border-ink-line pt-4">
          <input
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-mist/60"
            placeholder="I hate mornings, don't schedule before 11…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button disabled={sending}>SEND</Button>
        </form>

        <Button variant="ghost-ink" onClick={handleReady} disabled={checkingIn} className="w-full">
          {checkingIn ? 'CHECKING IN…' : "I'M READY →"}
        </Button>
        <p className="font-mono text-[11px] text-mist mt-3 text-center">
          Negotiation starts once everyone has checked in.
        </p>
      </div>
    </div>
  )
}
