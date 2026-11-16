import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogEvent } from '../api/events'
import { buildModel } from './model'

/**
 * How long each event stays on screen before the next one is released, in ms at 1x.
 * Tuned so a typical eight-person negotiation plays in roughly 30-45 seconds whether
 * the backend took two seconds (simulated) or ninety (Claude).
 */
function hold(e: LogEvent, next: LogEvent | undefined, agents: number): number {
  switch (e.type) {
    case 'negotiation_started':
      return 2200
    case 'slots_closed':
      return Math.min(4800, 1400 + e.closed.length * 55)
    case 'round_started':
      return 1000
    case 'agent_thinking':
      // A burst of agents starting to think, then a beat before the first answer lands.
      return next?.type === 'agent_thinking' ? 70 : 1300
    case 'agent_scored':
      return Math.max(260, Math.min(1150, 9000 / Math.max(1, agents)))
    case 'agent_failed':
      return 700
    case 'shortlist':
      return 2000
    case 'mediator_ask':
      return next?.type === 'mediator_ask' ? 1500 : 1800
    case 'agent_reply':
      return 1450
    default:
      return 0 // roster changes, decision, failure: no dwell
  }
}

export interface Playback {
  model: ReturnType<typeof buildModel>
  released: number
  total: number
  playing: boolean
  speed: 1 | 2
  /** Seconds of negotiation shown so far, measured on the paced timeline. */
  clock: number
  caughtUp: boolean
  started: boolean
  setPlaying: (p: boolean) => void
  setSpeed: (s: 1 | 2) => void
  replay: () => void
  skipToEnd: () => void
}

export function usePlayback(events: LogEvent[]): Playback {
  const [released, setReleased] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const timer = useRef<number | undefined>(undefined)

  const startIndex = useMemo(() => events.findIndex((e) => e.type === 'negotiation_started'), [events])
  const agents = useMemo(() => {
    const s = startIndex >= 0 ? events[startIndex] : undefined
    return s && s.type === 'negotiation_started' ? s.participants.length : 1
  }, [events, startIndex])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!playing || released >= events.length) return
    const dwell = released === 0 ? 0 : hold(events[released - 1], events[released], agents)
    if (dwell === 0) {
      // Release a run of events that need no dwell (roster changes) in one step.
      let i = released + 1
      while (i < events.length && hold(events[i - 1], events[i], agents) === 0) i++
      setReleased(i)
      return
    }
    timer.current = window.setTimeout(() => setReleased(released + 1), dwell / speed)
    return () => window.clearTimeout(timer.current)
  }, [events, released, playing, speed, agents])

  const model = useMemo(() => buildModel(events, released), [events, released])

  const clock = useMemo(() => {
    if (startIndex < 0 || released <= startIndex) return 0
    let ms = 0
    for (let i = startIndex; i < released - 1; i++) ms += hold(events[i], events[i + 1], agents)
    return ms / 1000
  }, [events, released, startIndex, agents])

  const replay = useCallback(() => {
    setReleased(startIndex >= 0 ? startIndex : 0)
    setPlaying(true)
  }, [startIndex])

  const skipToEnd = useCallback(() => setReleased(events.length), [events.length])

  return {
    model,
    released,
    total: events.length,
    playing,
    speed,
    clock,
    caughtUp: released >= events.length,
    started: startIndex >= 0 && released > startIndex,
    setPlaying,
    setSpeed,
    replay,
    skipToEnd,
  }
}
