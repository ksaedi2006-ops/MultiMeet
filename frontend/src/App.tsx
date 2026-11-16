import { useEffect } from 'react'
import { Outlet, Routes, Route, useLocation } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import Masthead from './components/Masthead'
import TowerCab from './cab/TowerCab'
import AttractStage from './cab/AttractStage'
import PlanStage from './cab/PlanStage'
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
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Stages not yet moved into the cab keep the old page shell for now. */
function OldPages() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <Masthead />
      <Outlet />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route element={<TowerCab />}>
          <Route path="/" element={<AttractStage />} />
          <Route path="/new" element={<PlanStage />} />
        </Route>
        <Route element={<OldPages />}>
        <Route path="/event/:eventId/share" element={<Page><ShareEvent /></Page>} />
        <Route path="/join/:inviteCode" element={<Page><JoinEvent /></Page>} />
        <Route path="/event/:eventId/upload" element={<Page><UploadCalendar /></Page>} />
        <Route path="/event/:eventId/agent" element={<Page><AgentChat /></Page>} />
        <Route path="/event/:eventId/negotiate" element={<Page><NegotiationLiveView /></Page>} />
        </Route>
      </Routes>
    </MotionConfig>
  )
}
