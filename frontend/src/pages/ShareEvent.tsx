import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEvent, type Event } from '../api/client'
import StepHeader from '../components/StepHeader'

export default function ShareEvent() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getEvent(eventId).then(setEvent)
  }, [eventId])

  const shareLink = event ? `${window.location.origin}/join/${event.invite_code}` : ''

  function handleCopy() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <StepHeader step={1} />
      <div className="max-w-md mx-auto px-8 py-12">
        <h1 className="text-3xl font-semibold mb-2">Share it</h1>
        <p className="text-gray-500 mb-8">
          Send this link to everyone you want at "{event?.title ?? '…'}". Their agents will join the
          negotiation once they open it.
        </p>

        <div className="flex gap-2 mb-8">
          <input
            readOnly
            value={shareLink}
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm hover:border-violet-400 transition"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button
          onClick={() => navigate(`/event/${eventId}/upload`)}
          className="w-full bg-violet-600 text-white rounded-lg px-4 py-3 hover:bg-violet-700 transition"
        >
          Continue — set up my agent
        </button>
      </div>
    </div>
  )
}
