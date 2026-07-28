import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-2">MeetMind</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Your AI scheduling agent negotiates meeting times on your behalf.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/groups"
          className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-violet-400 transition"
        >
          <h2 className="font-medium mb-1">Groups</h2>
          <p className="text-sm text-gray-500">Create or join a club, study group, or project team.</p>
        </Link>
        <Link
          to="/meetings/new"
          className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-violet-400 transition"
        >
          <h2 className="font-medium mb-1">Create Meeting</h2>
          <p className="text-sm text-gray-500">Kick off a negotiation across your group's agents.</p>
        </Link>
        <Link
          to="/preferences"
          className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-violet-400 transition"
        >
          <h2 className="font-medium mb-1">Preferences</h2>
          <p className="text-sm text-gray-500">Tell your agent what you like in plain English.</p>
        </Link>
      </div>
    </div>
  )
}
