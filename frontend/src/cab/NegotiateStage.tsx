import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { currentUserId, errorMessage, getEvent, type EventInfo } from '../api/client'
import { useEventLog } from '../api/useEventLog'
import ChosenTime from '../tower/ChosenTime'
import DecisionBrief from '../tower/DecisionBrief'
import FairnessMeter from '../tower/FairnessMeter'
import HoldingPanel from '../tower/HoldingPanel'
import RadioTicker from '../tower/RadioTicker'
import StatusBar from '../tower/StatusBar'
import StripBoard from '../tower/StripBoard'
import TowerLog from '../tower/TowerLog'
import { usePlayback } from '../tower/usePlayback'
import { play, useGrowth } from '../lib/sound'
import { useCab, useFixture, useScopeFeed } from './context'
import { previewSlots } from './previewSlots'

/**
 * Negotiating, then Booked. The camera centres on the scope; the left panel holds every
 * person's row of scores, and the right panel the playback, the fairness meter, what is
 * happening and, once a time lands, the booking itself.
 */
export default function NegotiateStage() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { highlight, setHighlight } = useCab()
  const viewerId = currentUserId()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { events, state } = useEventLog(eventId, viewerId)
  const playback = usePlayback(events)
  // Until the negotiation starts, the ring shows the meeting's times as the earlier steps did.
  const model = useMemo(() => {
    const live = playback.model
    if (!event || live.slots.length) return live
    return { ...live, slots: previewSlots({
      start: event.start_date, end: event.end_date, duration: event.duration_minutes,
      earliest: event.earliest_hour, latest: event.latest_hour, weekdays: event.weekdays, tz: event.timezone,
    }) }
  }, [playback.model, event])
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    getEvent(eventId).then(setEvent, (err) => setLoadError(errorMessage(err, "Couldn't load this meeting.")))
  }, [eventId])
  // Replaying or scrubbing back before the decision un-lands the result.
  useEffect(() => {
    if (!model.decision) setLanded(false)
  }, [model.decision])

  const onLanded = useCallback(() => {
    setLanded(true)
    play('chime')
  }, [])
  useGrowth(playback.model.slots.filter((s) => s.closed).length, useCallback((n: number) => play('cross', n), []))
  useGrowth(playback.model.asks.length, useCallback(() => play('blip'), []))
  const decided = Boolean(model.decision && landed)
  const overlay = useMemo(
    () => (decided && model.decision ? <ChosenTime decision={model.decision} timezone={model.timezone} /> : null),
    [decided, model.decision, model.timezone],
  )
  useScopeFeed({
    model, onLanded, overlay,
    stageName: decided ? (model.decision?.status === 'converged' ? 'Booked' : 'No time works') : undefined,
    legend: 'Each dot is someone’s agent, drifting toward the times they prefer. Crossed-out times are ones someone can’t make. Point at a time to read it.',
  })

  if (loadError || state === 'closed') {
    return panel ? createPortal(
      <div className="px-5 lg:px-6 py-8">
        <h1 className="font-display font-bold text-[2.4rem] leading-[0.95] text-strip">This meeting doesn’t exist</h1>
        <p className="mt-3 text-strip/80">{loadError ?? 'The link may be mistyped, or the meeting was removed.'}</p>
        <Link to="/" className="inline-block mt-6 font-mono text-sm text-amber hover:underline underline-offset-4">
          Schedule something new
        </Link>
      </div>, panel) : null
  }

  const rows = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-4">
      {model.phase === 'holding' && event && <HoldingPanel event={event} model={model} viewerId={viewerId} />}
      <StripBoard model={model} viewerId={viewerId} highlight={highlight} onHover={setHighlight} />
    </div>
  )

  const side = (
    <div className="px-5 lg:px-6 pb-6 flex flex-col gap-4 lg:h-full">
      <StatusBar title={event?.title ?? ' '} model={model} playback={playback} connection={state} />
      {decided ? (
        <DecisionBrief eventId={eventId} title={event?.title ?? 'Meeting'} model={model} viewerId={viewerId} />
      ) : model.phase === 'failed' ? (
        <section role="alert" className="border border-clearance/60 rounded-[2px] px-4 py-4">
          <p className="font-display text-2xl font-bold text-strip">The negotiation stopped</p>
          <p className="mt-1 text-sm text-strip/80">{model.error} Nothing was scheduled.</p>
        </section>
      ) : model.phase !== 'holding' ? (
        <FairnessMeter model={model} />
      ) : null}
      <RadioTicker model={model} />
      <div className="flex min-h-[16rem] flex-1">
        <TowerLog model={model} viewerId={viewerId} />
      </div>
    </div>
  )

  return (
    <>
      {bay && createPortal(rows, bay)}
      {panel && createPortal(side, panel)}
    </>
  )
}
