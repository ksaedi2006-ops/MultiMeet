import { Routes, Route, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Masthead from './components/Masthead'
import CreateEvent from './pages/CreateEvent'
import ShareEvent from './pages/ShareEvent'
import JoinEvent from './pages/JoinEvent'
import UploadCalendar from './pages/UploadCalendar'
import AgentChat from './pages/AgentChat'
import NegotiationLiveView from './pages/NegotiationLiveView'

function Page({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Masthead />
      <Routes>
        <Route path="/" element={<Page><CreateEvent /></Page>} />
        <Route path="/event/:eventId/share" element={<Page><ShareEvent /></Page>} />
        <Route path="/join/:inviteCode" element={<Page><JoinEvent /></Page>} />
        <Route path="/event/:eventId/upload" element={<Page><UploadCalendar /></Page>} />
        <Route path="/event/:eventId/agent" element={<Page><AgentChat /></Page>} />
        <Route path="/event/:eventId/negotiate" element={<Page><NegotiationLiveView /></Page>} />
      </Routes>
    </div>
  )
}
