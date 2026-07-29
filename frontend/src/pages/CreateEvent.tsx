import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvent, getOrCreateUserId, getSavedName, setUserName } from '../api/client'
import StepHeader from '../components/StepHeader'
import Paper from '../components/Paper'
import Button from '../components/Button'

export default function CreateEvent() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [name, setName] = useState(getSavedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, name)
      const event = await createEvent(title, userId)
      navigate(`/event/${event.event_id}/share`)
    } catch {
      setError('Could not reach the backend. Check that it is running, then try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <StepHeader step={0} />
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10">
        <Paper className="p-8 sm:p-10">
          <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-4">NEW DISPATCH</p>
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold leading-snug mb-3">
            What are we scheduling?
          </h1>
          <p className="text-paper-ink/70 mb-8 leading-relaxed">
            Name it. Your agent handles the rest — finding a time, checking with everyone else's.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <label className="block">
              <span className="font-mono text-[11px] tracking-widest text-paper-ink/50">TITLE</span>
              <input
                autoFocus
                className="w-full bg-transparent border-0 border-b-2 border-paper-ink/20 focus:border-seal outline-none px-0 py-2 text-xl font-medium placeholder:font-normal placeholder:text-paper-ink/35 transition-colors"
                placeholder="CS Club weekly meeting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] tracking-widest text-paper-ink/50">YOUR NAME</span>
              <input
                className="w-full bg-transparent border-0 border-b-2 border-paper-ink/20 focus:border-seal outline-none px-0 py-2 text-lg placeholder:font-normal placeholder:text-paper-ink/35 transition-colors"
                placeholder="So others know who they're negotiating with"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <Button disabled={loading} className="self-start">
              {loading ? 'CREATING…' : 'CREATE EVENT →'}
            </Button>
          </form>
        </Paper>
        {error && <p className="mt-5 text-sm text-seal font-mono px-1">{error}</p>}
      </div>
    </div>
  )
}
