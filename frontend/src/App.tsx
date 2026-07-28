import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import CreateMeeting from './pages/CreateMeeting'
import NegotiationLiveView from './pages/NegotiationLiveView'
import Preferences from './pages/Preferences'

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-200 dark:border-gray-800 px-8 py-4 flex gap-6 items-center">
        <Link to="/" className="font-semibold">
          MeetMind
        </Link>
        <Link to="/groups" className="text-sm text-gray-500 hover:text-violet-500">
          Groups
        </Link>
        <Link to="/meetings/new" className="text-sm text-gray-500 hover:text-violet-500">
          Create Meeting
        </Link>
        <Link to="/preferences" className="text-sm text-gray-500 hover:text-violet-500">
          Preferences
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/meetings/new" element={<CreateMeeting />} />
        <Route path="/negotiate/:meetingId" element={<NegotiationLiveView />} />
        <Route path="/preferences" element={<Preferences />} />
      </Routes>
    </div>
  )
}
