import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvent, getOrCreateUserId } from '../api/client'
import StepHeader from '../components/StepHeader'

export default function CreateEvent() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      const event = await createEvent(title, userId)
      navigate(`/event/${event.event_id}/share`)
    } catch {
      setError('Could not create event. Is the backend running?')
      setLoading(false)
    }
  }

  return (
    <div>
      <StepHeader step={0} />
      <div className="max-w-md mx-auto px-8 py-12">
        <h1 className="text-3xl font-semibold mb-2">What are we scheduling?</h1>
        <p className="text-gray-500 mb-8">Give your meeting a title. Everything else comes next.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 bg-transparent text-lg"
            placeholder="e.g. CS Club weekly meeting"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <button
            disabled={loading}
            className="bg-violet-600 text-white rounded-lg px-4 py-3 hover:bg-violet-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create event'}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
