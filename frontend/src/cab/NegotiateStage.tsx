import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createSampleEvent, currentUserId, errorMessage, getEvent, getOrCreateUserId, type EventInfo } from '../api/client'
import { rememberEvent } from '../lib/recents'
import { useEventLog } from '../api/useEventLog'
import ChosenTime from '../tower/ChosenTime'
import DecisionBrief from '../tower/DecisionBrief'
import HoldingPanel from '../tower/HoldingPanel'
import StatusBar from '../tower/StatusBar'
import Conversation from '../story/Conversation'
import MethodDrawer from '../story/MethodDrawer'
import StoryPanel from '../story/StoryPanel'
import WhyCard from '../story/WhyCard'
import RuleCompare from '../story/RuleCompare'
import RulePicker from '../story/RulePicker'
import type { RuleId } from '../api/events'
import { RULE, USED_RULE } from '../lib/rules'
import type { TowerModel } from '../tower/model'
import type { RingMarker } from '../tower/scope/engine'
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
  const banner = useFixture('banner')
  const tools = useFixture('tools')
  const { highlight, setHighlight, desktop } = useCab()
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
  const [method, setMethod] = useState(false)
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  // Replay only re-plays the recorded log. This draws a fresh group of the same size, so the
  // people, calendars and every rule's comparison can come out differently.
  const newGroup = useCallback(async () => {
    setStarting(true)
    try {
      const uid = await getOrCreateUserId()
      const next = await createSampleEvent(uid, Math.max(3, playback.model.agents.length - 1))
      rememberEvent(next.event_id, next.title)
      navigate(`/event/${next.event_id}/negotiate`)
    } catch {
      setStarting(false)
    }
  }, [navigate, playback.model.agents.length])
  const [rule, setRule] = useState<RuleId>(USED_RULE)

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
  const closeMethod = useCallback(() => setMethod(false), [])
  const overlay = useMemo(
    () => (decided && model.decision ? <ChosenTime decision={model.decision} timezone={model.timezone} /> : null),
    [decided, model.decision, model.timezone],
  )
  // A rule other than the one that booked: the left panel shows what it would have booked.
  const lens = useMemo<TowerModel>(() => {
    const d = model.decision
    const o = d?.rules.find((r) => r.rule === rule)
    if (!d || rule === USED_RULE || !o?.slot_id) return model
    const slot = model.slots.find((s) => s.id === o.slot_id)
    if (!slot) return model
    return {
      ...model,
      decision: {
        ...d, slot: { id: slot.id, start: slot.start, end: slot.end, label: slot.label },
        scores: o.scores ?? {}, minScore: o.min_score ?? null, avgScore: o.avg_score ?? null, compromises: [],
      },
    }
  }, [model, rule])
  // Where every rule would book, as labels on the ring; times several rules agree on share one.
  const markers = useMemo<RingMarker[] | undefined>(() => {
    const outcomes = decided ? model.decision?.rules ?? [] : []
    if (!outcomes.length) return undefined
    const bySlot = new Map<string, RuleId[]>()
    for (const o of outcomes) if (o.slot_id) bySlot.set(o.slot_id, [...(bySlot.get(o.slot_id) ?? []), o.rule])
    return [...bySlot.entries()].map(([slotId, ids]) => ({
      slotId, text: ids.map((id) => RULE[id].short).join(' · '), active: ids.includes(rule),
    }))
  }, [decided, model.decision, rule])
  useScopeFeed({
    model, onLanded, overlay, markers,
    stageName: decided ? (model.decision?.status === 'converged' ? 'Booked' : 'No time works') : undefined,
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
    <div>
      <StoryPanel model={decided ? lens : model} viewerId={viewerId} highlight={highlight} onHover={setHighlight}
        whatIf={decided && rule !== USED_RULE ? RULE[rule].name : null} />
    </div>
  )

  const side = (
    <div className="px-5 lg:px-6 py-5 flex flex-col gap-4">
      <button type="button" onClick={() => setMethod(true)}
        className="self-start inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.12em] text-amber hover:underline underline-offset-4">
        HOW DOES IT DECIDE? <span aria-hidden>→</span>
      </button>
      {/* The one thing to do before it starts: first in the panel, so first on a phone too. */}
      {model.phase === 'holding' && event && <HoldingPanel event={event} model={model} viewerId={viewerId} />}
      {/* On a phone the story comes before the booking and the chat, not after them. */}
      {!desktop && <div className="-mx-5 -mt-5">{rows}</div>}
      {/* Nobody attends a meeting that simulated agents booked, so the calendar buttons, RSVP and fall-backs are for live agents only. */}
      {decided && !(model.backend === 'simulated' && model.decision?.status === 'converged') && (
        <DecisionBrief eventId={eventId} title={event?.title ?? 'Meeting'} model={model} viewerId={viewerId} />
      )}
      {decided && (rule === USED_RULE ? <WhyCard model={model} /> : <RuleCompare model={model} rule={rule} />)}
      {model.phase === 'failed' && (
        <section role="alert" className="border border-clearance/60 rounded-[2px] px-4 py-4">
          <p className="font-display text-2xl font-bold text-strip">The negotiation stopped</p>
          <p className="mt-1 text-sm text-strip/80">{model.error} Nothing was scheduled.</p>
        </section>
      )}
      <Conversation model={model} viewerId={viewerId} />
      <MethodDrawer open={method} onClose={closeMethod} />
    </div>
  )

  return (
    <>
      {bay && desktop && createPortal(rows, bay)}
      {panel && createPortal(side, panel)}
      {tools && model.slots.length > 0 && createPortal(
        <RulePicker rule={rule} onChange={setRule} outcomes={decided ? model.decision?.rules ?? [] : []} />, tools)}
      {banner && createPortal(<StatusBar title={event?.title ?? ' '} model={model} playback={playback} connection={state}
        onNewGroup={model.backend === 'simulated' ? newGroup : undefined} starting={starting} />, banner)}
    </>
  )
}
