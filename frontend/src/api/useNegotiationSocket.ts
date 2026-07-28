import { useEffect, useRef, useState } from 'react'
import { WS_BASE } from './client'

export type NegotiationEvent =
  | { type: 'negotiation_started'; participants: number; slots: number }
  | { type: 'agent_response'; user_id: string; user_name: string; notes: string; top_slot: { datetime: string; satisfaction: number } | null }
  | { type: 'mediator_decision'; decision: Record<string, unknown> }

export function useNegotiationSocket(meetingId: string | null) {
  const [events, setEvents] = useState<NegotiationEvent[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!meetingId) return
    const ws = new WebSocket(`${WS_BASE}/ws/negotiation/${meetingId}`)
    socketRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data) as NegotiationEvent
      setEvents((prev) => [...prev, data])
    }

    return () => ws.close()
  }, [meetingId])

  return { events, connected }
}
