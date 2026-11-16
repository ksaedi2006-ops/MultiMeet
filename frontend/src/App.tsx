import { useEffect } from 'react'
import { Outlet, Routes, Route, useLocation } from 'react-router-dom'
import { MotionConfig, motion } from 'framer-motion'
import Masthead from './components/Masthead'
import TowerCab from './cab/TowerCab'
import AttractStage from './cab/AttractStage'
import PlanStage from './cab/PlanStage'
import InviteStage from './cab/InviteStage'
import CalendarStage from './cab/CalendarStage'
import PreferencesStage from './cab/PreferencesStage'
import JoinEvent from './pages/JoinEvent'
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
          <Route path="/event/:eventId/share" element={<InviteStage />} />
          <Route path="/event/:eventId/upload" element={<CalendarStage />} />
          <Route path="/event/:eventId/agent" element={<PreferencesStage />} />
        </Route>
        <Route element={<OldPages />}>
        <Route path="/join/:inviteCode" element={<Page><JoinEvent /></Page>} />
        <Route path="/event/:eventId/negotiate" element={<Page><NegotiationLiveView /></Page>} />
        </Route>
      </Routes>
    </MotionConfig>
  )
}
