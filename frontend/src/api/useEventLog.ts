import { useEffect, useRef, useState } from 'react'
import { WS_BASE } from './client'
import type { LogEvent } from './events'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed'

/**
 * The event's full log: replayed from the start, then streamed live. Reconnects with
 * backoff, resuming after the last sequence number it holds, and de-duplicates by seq.
 */
export function useEventLog(eventId: string | null, viewerId: string | null) {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [state, setState] = useState<ConnectionState>('connecting')
  const lastSeq = useRef(0)

  useEffect(() => {
    if (!eventId) return
    let socket: WebSocket | null = null
    let retry = 0
    let timer: number | undefined
    let disposed = false
    const buffer: LogEvent[] = []
    let flush: number | undefined

    lastSeq.current = 0
    setEvents([])

    const connect = () => {
      const params = new URLSearchParams({ after: String(lastSeq.current) })
      if (viewerId) params.set('viewer', viewerId)
      socket = new WebSocket(`${WS_BASE}/ws/events/${eventId}?${params}`)
      socket.onopen = () => {
        retry = 0
        setState('live')
      }
      socket.onmessage = (msg) => {
        let event: LogEvent
        try {
          event = JSON.parse(msg.data)
        } catch {
          return
        }
        if (event.seq <= lastSeq.current) return
        lastSeq.current = event.seq
        buffer.push(event)
        // Batch a replay burst into one render.
        if (flush === undefined) {
          flush = window.setTimeout(() => {
            flush = undefined
            const batch = buffer.splice(0)
            setEvents((prev) => [...prev, ...batch])
          }, 16)
        }
      }
      socket.onclose = (e) => {
        if (disposed) return
        if (e.code === 4404) {
          setState('closed')
          return
        }
        setState('reconnecting')
        timer = window.setTimeout(connect, Math.min(8000, 500 * 2 ** retry++))
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(timer)
      window.clearTimeout(flush)
      socket?.close()
    }
  }, [eventId, viewerId])

  return { events, state }
}
