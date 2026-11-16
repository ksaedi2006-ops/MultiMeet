export interface RecentEvent {
  id: string
  title: string
  at: number
}

const KEY = 'multimeet_recent_events'
const OLD_KEY = 'meetmind_recent_events' // before the MeetMind -> MultiMeet rename

try {
  const old = localStorage.getItem(OLD_KEY)
  if (old !== null && localStorage.getItem(KEY) === null) localStorage.setItem(KEY, old)
  localStorage.removeItem(OLD_KEY)
} catch {
  /* storage unavailable: recents are a convenience */
}

export function getRecents(): RecentEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function rememberEvent(id: string, title: string) {
  try {
    const next = [{ id, title, at: Date.now() }, ...getRecents().filter((e) => e.id !== id)].slice(0, 5)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the list is a convenience, not state */
  }
}

export function forgetEvent(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getRecents().filter((e) => e.id !== id)))
  } catch {
    /* ignore */
  }
}
