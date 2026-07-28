import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMeetingRequest } from '../api/client'

export default function CreateMeeting() {
  const navigate = useNavigate()
  const [groupId, setGroupId] = useState('')
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const meeting = await createMeetingRequest(
        {
          group_id: groupId,
          title,
          duration_minutes: duration,
          date_range_start: new Date(start).toISOString(),
          date_range_end: new Date(end).toISOString(),
        },
        userId
      )
      navigate(`/negotiate/${meeting.id}`)
    } catch {
      setError('Could not create meeting request. Is the backend running?')
    }
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Create Meeting</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
          placeholder="Group id"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          required
        />
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
          placeholder="Your user id (requester)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
          placeholder="Meeting title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <label className="text-sm text-gray-500">
          Duration (minutes)
          <input
            type="number"
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent w-full mt-1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label className="text-sm text-gray-500">
          Search range start
          <input
            type="datetime-local"
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent w-full mt-1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </label>
        <label className="text-sm text-gray-500">
          Search range end
          <input
            type="datetime-local"
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent w-full mt-1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>
        <button className="bg-violet-600 text-white rounded-lg px-3 py-2 hover:bg-violet-700 transition">
          Launch negotiation
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  )
}
