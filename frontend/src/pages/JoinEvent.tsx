import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrCreateUserId, joinEvent } from '../api/client'

export default function JoinEvent() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      try {
        const userId = await getOrCreateUserId()
        const event = await joinEvent(inviteCode, userId)
        navigate(`/event/${event.event_id}/upload`, { replace: true })
      } catch {
        setError('This invite link looks invalid, or the backend is unreachable.')
      }
    }
    run()
  }, [inviteCode, navigate])

  return (
    <div className="max-w-md mx-auto px-8 py-16 text-center">
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <p className="text-gray-500">Joining event…</p>
      )}
    </div>
  )
}
