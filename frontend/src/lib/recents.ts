export interface RecentEvent {
  id: string
  title: string
  at: number
}

const KEY = 'meetmind_recent_events'

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
