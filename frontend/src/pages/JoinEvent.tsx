import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEventByInvite, getOrCreateUserId, getSavedName, joinEvent, setUserName } from '../api/client'
import Paper from '../components/Paper'
import Button from '../components/Button'

export default function JoinEvent() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState<string | null>(null)
  const [name, setName] = useState(getSavedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEventByInvite(inviteCode)
      .then((event) => setTitle(event.title))
      .catch(() => setError('This invite link looks invalid, or the backend is unreachable.'))
  }, [inviteCode])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const userId = await getOrCreateUserId()
      await setUserName(userId, name)
      const event = await joinEvent(inviteCode, userId)
      navigate(`/event/${event.event_id}/upload`, { replace: true })
    } catch {
      setError('Could not join. Check that the backend is running, then try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-5 sm:px-8 py-10">
      <Paper className="p-8 sm:p-10">
        <p className="font-mono text-[11px] tracking-[0.25em] text-seal mb-4">INVITATION</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-semibold leading-snug mb-3">
          {title ? `Join "${title}"` : error ? 'Invite not found' : 'Loading invite…'}
        </h1>
        {!error && (
          <>
            <p className="text-paper-ink/70 mb-8 leading-relaxed">
              Your agent will join the negotiation once you've briefed it — right after this.
            </p>
            <form onSubmit={handleJoin} className="flex flex-col gap-6">
              <label className="block">
                <span className="font-mono text-[11px] tracking-widest text-paper-ink/50">YOUR NAME</span>
                <input
                  autoFocus
                  className="w-full bg-transparent border-0 border-b-2 border-paper-ink/20 focus:border-seal outline-none px-0 py-2 text-xl font-medium placeholder:font-normal placeholder:text-paper-ink/35 transition-colors"
                  placeholder="So others know who they're negotiating with"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={!title}
                />
              </label>
              <Button disabled={loading || !title} className="self-start">
                {loading ? 'JOINING…' : 'JOIN EVENT →'}
              </Button>
            </form>
          </>
        )}
        {error && <p className="font-mono text-sm text-seal">{error}</p>}
      </Paper>
    </div>
  )
}
