import { useEffect } from 'react'
import { Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import TowerCab from './cab/TowerCab'
import AttractStage from './cab/AttractStage'
import PlanStage from './cab/PlanStage'
import InviteStage from './cab/InviteStage'
import JoinStage from './cab/JoinStage'
import CalendarStage from './cab/CalendarStage'
import PreferencesStage from './cab/PreferencesStage'
import NegotiateStage from './cab/NegotiateStage'
import LabStage from './cab/LabStage'

/** Every screen is a step of one persistent console (cab/TowerCab); routes only pick the step. */
/** Keyed by meeting, so moving from one negotiation to another starts from a clean slate. */
function NegotiateRoute() {
  const { eventId } = useParams()
  return <NegotiateStage key={eventId} />
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
          <Route path="/lab" element={<LabStage />} />
          <Route path="/event/:eventId/share" element={<InviteStage />} />
          <Route path="/join/:inviteCode" element={<JoinStage />} />
          <Route path="/event/:eventId/upload" element={<CalendarStage />} />
          <Route path="/event/:eventId/agent" element={<PreferencesStage />} />
          <Route path="/event/:eventId/negotiate" element={<NegotiateRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MotionConfig>
  )
}
