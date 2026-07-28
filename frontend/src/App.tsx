import { Routes, Route, Link } from 'react-router-dom'
import CreateEvent from './pages/CreateEvent'
import ShareEvent from './pages/ShareEvent'
import JoinEvent from './pages/JoinEvent'
import UploadCalendar from './pages/UploadCalendar'
import AgentChat from './pages/AgentChat'
import NegotiationLiveView from './pages/NegotiationLiveView'

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-200 dark:border-gray-800 px-8 py-4">
        <Link to="/" className="font-semibold">
          MeetMind
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<CreateEvent />} />
        <Route path="/event/:eventId/share" element={<ShareEvent />} />
        <Route path="/join/:inviteCode" element={<JoinEvent />} />
        <Route path="/event/:eventId/upload" element={<UploadCalendar />} />
        <Route path="/event/:eventId/agent" element={<AgentChat />} />
        <Route path="/event/:eventId/negotiate" element={<NegotiationLiveView />} />
      </Routes>
    </div>
  )
}
