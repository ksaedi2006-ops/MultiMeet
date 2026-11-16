import { useEffect, useState } from 'react'
import { currentUserId, getEvent, type EventInfo } from './client'

/** The event, and whether the viewer organises it (which decides which steps they see). */
export function useEventInfo(eventId: string) {
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getEvent(eventId).then(setEvent, () => setFailed(true))
  }, [eventId])

  return { event, failed, organiser: event ? event.organizer_id === currentUserId() : true }
}
