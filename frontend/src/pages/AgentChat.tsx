import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addPreference, getOrCreateUserId, listPreferences } from '../api/client'
import StepHeader from '../components/StepHeader'

interface ChatMessage {
  from: 'user' | 'agent'
  text: string
}

const INTRO =
  "Hi, I'm your scheduling agent. Tell me anything about your preferences — mornings, buffer time, days off — and I'll advocate for it during negotiation."

export default function AgentChat() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: 'agent', text: INTRO }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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

  return (
    <div>
      <StepHeader step={3} />
      <div className="max-w-md mx-auto px-8 py-8 flex flex-col h-[70vh]">
        <h1 className="text-2xl font-semibold mb-1">Talk to your agent</h1>
        <p className="text-gray-500 text-sm mb-4">
          Say as much or as little as you want. You can always add more later.
        </p>

        <div ref={logRef} className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.from === 'agent'
                  ? 'bg-gray-100 dark:bg-gray-800 self-start'
                  : 'bg-violet-600 text-white self-end'
              }`}
            >
              {m.text}
            </div>
          ))}
          {sending && (
            <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 self-start text-gray-400">
              thinking…
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2 mb-4">
          <input
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
            placeholder="I hate mornings, don't schedule before 11…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            disabled={sending}
            className="bg-violet-600 text-white rounded-lg px-4 py-2 hover:bg-violet-700 transition disabled:opacity-50"
          >
            Send
          </button>
        </form>

        <button
          onClick={() => navigate(`/event/${eventId}/negotiate`)}
          className="w-full border border-violet-400 text-violet-500 rounded-lg px-4 py-3 hover:bg-violet-50 dark:hover:bg-violet-950 transition"
        >
          Start negotiation
        </button>
      </div>
    </div>
  )
}
