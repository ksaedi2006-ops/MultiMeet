import { useState } from 'react'
import { api } from '../api/client'

interface Preference {
  id: string
  raw_text: string
  parsed_rules: Record<string, unknown>
  strength: string
}

export default function Preferences() {
  const [userId, setUserId] = useState('')
  const [text, setText] = useState('')
  const [prefs, setPrefs] = useState<Preference[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadPrefs(uid: string) {
    const res = await api.get<Preference[]>(`/users/${uid}/preferences`)
    setPrefs(res.data)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post(`/users/${userId}/preferences`, { raw_text: text })
      setText('')
      await loadPrefs(userId)
    } catch {
      setError('Could not save preference. Is the backend running?')
    }
  }

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-4">Preferences</h1>

      <input
        className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent w-full mb-3"
        placeholder="Your user id"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        onBlur={() => userId && loadPrefs(userId)}
      />

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-transparent flex-1"
          placeholder="e.g. I hate mornings, don't schedule anything before 11"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <button className="bg-violet-600 text-white rounded-lg px-3 py-2 hover:bg-violet-700 transition">
          Add
        </button>
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <ul className="flex flex-col gap-2">
        {prefs.map((p) => (
          <li key={p.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <p className="text-sm">{p.raw_text}</p>
            <p className="text-xs text-gray-500 mt-1">
              strength: {p.strength} · parsed: {JSON.stringify(p.parsed_rules)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
