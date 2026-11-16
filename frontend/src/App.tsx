import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import Masthead from './components/Masthead'
import CreateEvent from './pages/CreateEvent'
import ShareEvent from './pages/ShareEvent'
import JoinEvent from './pages/JoinEvent'
import UploadCalendar from './pages/UploadCalendar'
import AgentChat from './pages/AgentChat'
import NegotiationLiveView from './pages/NegotiationLiveView'

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen">
      <Masthead />
      <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Page><CreateEvent /></Page>} />
        <Route path="/event/:eventId/share" element={<Page><ShareEvent /></Page>} />
        <Route path="/join/:inviteCode" element={<Page><JoinEvent /></Page>} />
        <Route path="/event/:eventId/upload" element={<Page><UploadCalendar /></Page>} />
        <Route path="/event/:eventId/agent" element={<Page><AgentChat /></Page>} />
        <Route path="/event/:eventId/negotiate" element={<Page><NegotiationLiveView /></Page>} />
      </Routes>
      </AnimatePresence>
    </div>
    </MotionConfig>
  )
}
