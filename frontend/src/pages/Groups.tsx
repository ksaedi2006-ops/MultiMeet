import { useState } from 'react'
import { createGroup } from '../api/client'

export default function Groups() {
  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const group = await createGroup(name, userId)
      setCreatedCode(group.invite_code)
    } catch {
      setError('Could not create group. Is the backend running?')
    }
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Groups</h1>
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
          placeholder="Group name (e.g. CS Club)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent"
          placeholder="Your user id (admin)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <button className="bg-violet-600 text-white rounded-lg px-3 py-2 hover:bg-violet-700 transition">
          Create group
        </button>
      </form>

      {createdCode && (
        <p className="mt-4 text-sm text-gray-500">
          Group created. Invite code: <code className="font-mono">{createdCode}</code>
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  )
}
