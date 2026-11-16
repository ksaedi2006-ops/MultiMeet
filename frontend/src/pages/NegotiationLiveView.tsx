import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { currentUserId, errorMessage, getEvent, type EventInfo } from '../api/client'
import { useEventLog } from '../api/useEventLog'
import ChosenTime from '../tower/ChosenTime'
import DecisionBrief from '../tower/DecisionBrief'
import FairnessMeter from '../tower/FairnessMeter'
import HoldingPanel from '../tower/HoldingPanel'
import RadarScope from '../tower/RadarScope'
import RadioTicker from '../tower/RadioTicker'
import StatusBar from '../tower/StatusBar'
import StripBoard from '../tower/StripBoard'
import TowerLog from '../tower/TowerLog'
import { usePlayback } from '../tower/usePlayback'

export default function NegotiationLiveView() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const viewerId = currentUserId()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { events, state } = useEventLog(eventId, viewerId)
  const playback = usePlayback(events)
  const { model } = playback
  const [highlight, setHighlight] = useState<string | null>(null)
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    getEvent(eventId).then(setEvent, (err) => setLoadError(errorMessage(err, "Couldn't load this event.")))
  }, [eventId])

  // Replaying or scrubbing back before the decision un-lands the result.
  useEffect(() => {
    if (!model.decision) setLanded(false)
  }, [model.decision])

  if (loadError || state === 'closed') {
    return (
      <div className="max-w-xl mx-auto px-5 py-16">
        <p className="font-display text-3xl font-bold text-strip">This event doesn't exist</p>
        <p className="mt-2 text-strip/75">{loadError ?? 'The link may be mistyped, or the event was removed.'}</p>
        <Link to="/" className="inline-block mt-6 font-mono text-sm text-amber hover:underline underline-offset-4">
          Schedule something new
        </Link>
      </div>
    )
  }

  const decided = model.decision && landed

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-16">
      <StatusBar title={event?.title ?? ' '} model={model} playback={playback} connection={state} />

      <div className="grid gap-6 lg:gap-8 pt-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="relative w-full aspect-square max-h-[calc(100svh-13rem)] mx-auto">
            <RadarScope model={model} highlight={highlight} onHover={setHighlight} onLanded={() => setLanded(true)} />
            <AnimatePresence>
              {decided && (
                <motion.div
                  key="stamp"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Plain darkening of the glass so the ink reads; ink itself doesn't glow. */}
                  <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(6,12,18,0.72)_0%,rgba(6,12,18,0.5)_45%,transparent_70%)]" />
                  <div className="relative">
                    <ChosenTime decision={model.decision!} timezone={model.timezone} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-[13px] leading-snug text-mist text-center">
            Each dot is someone’s agent, drifting toward the times they prefer. Crossed-out times are ones someone
            can’t make. Point at a time to read it.
          </p>
          <RadioTicker model={model} />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {model.phase === 'holding' && event ? (
            <HoldingPanel event={event} model={model} viewerId={viewerId} />
          ) : decided ? (
            <DecisionBrief eventId={eventId} title={event?.title ?? 'Meeting'} model={model} viewerId={viewerId} />
          ) : model.phase === 'failed' ? (
            <section role="alert" className="border border-clearance/60 rounded-[2px] px-4 py-4">
              <p className="font-display text-2xl font-bold text-strip">The negotiation stopped</p>
              <p className="mt-1 text-sm text-strip/80">{model.error} Nothing was scheduled.</p>
            </section>
          ) : (
            <FairnessMeter model={model} />
          )}
          <div className="lg:max-h-[calc(100svh-22rem)] lg:overflow-y-auto lg:pr-1 -mr-1 pr-1">
            <StripBoard model={model} viewerId={viewerId} highlight={highlight} onHover={setHighlight} />
          </div>
        </div>
      </div>

      <div className="mt-8 h-[22rem] flex">
        <TowerLog model={model} viewerId={viewerId} />
      </div>
    </div>
  )
}
