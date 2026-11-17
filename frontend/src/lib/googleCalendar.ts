/**
 * Read-only Google Calendar sign-in, entirely in the browser: Google Identity Services hands back a
 * short-lived access token for the calendar.readonly scope, we list the viewer's events, turn them into
 * an .ics document and send it through the same upload the file drop uses. The token is never stored
 * and never sent to our backend.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

export const googleConfigured = Boolean(CLIENT_ID)

interface TokenResponse { access_token?: string; error?: string }
interface TokenClient { requestAccessToken(opts?: { prompt?: string }): void }
interface GoogleWindow {
  google?: { accounts: { oauth2: { initTokenClient(c: {
    client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void
  }): TokenClient } } }
}

let loading: Promise<void> | null = null
function loadScript(): Promise<void> {
  if ((window as GoogleWindow).google?.accounts) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; reject(new Error('Couldn’t reach Google. Check your connection and try again.')) }
    document.head.appendChild(s)
  })
  return loading
}

function token(): Promise<string> {
  return new Promise((resolve, reject) => {
    const g = (window as GoogleWindow).google
    if (!g || !CLIENT_ID) return reject(new Error('Google sign-in isn’t set up here.'))
    g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error('Google didn’t grant access.'))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed'
        ? 'The Google window was closed before you finished.' : 'Couldn’t sign in with Google.')),
    }).requestAccessToken()
  })
}

interface GEvent {
  id: string
  status?: string
  summary?: string
  transparency?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

async function listEvents(accessToken: string): Promise<GEvent[]> {
  const from = new Date(Date.now() - 7 * 864e5)
  const to = new Date(Date.now() + 120 * 864e5)
  const out: GEvent[] = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({
      timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true',
      orderBy: 'startTime', maxResults: '250', ...(pageToken ? { pageToken } : {}),
    })
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(res.status === 403
      ? 'Google Calendar access is turned off for this app. Try again and allow calendar access.'
      : 'Couldn’t read your Google Calendar.')
    const body = await res.json() as { items?: GEvent[]; nextPageToken?: string }
    out.push(...(body.items ?? []))
    pageToken = body.nextPageToken ?? ''
  } while (pageToken && out.length < 1500)
  return out
}

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (d: string) => d.replace(/-/g, '')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Busy events only: not cancelled, not marked "free", not declined. */
export function toIcs(events: GEvent[]): { ics: string; count: number } {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MultiMeet//Google Calendar//EN']
  let count = 0
  for (const e of events) {
    if (e.status === 'cancelled' || e.transparency === 'transparent') continue
    if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue
    const { start, end } = e
    if (!start || !end) continue
    lines.push('BEGIN:VEVENT', `UID:${e.id}@google`)
    if (start.dateTime && end.dateTime) lines.push(`DTSTART:${utc(start.dateTime)}`, `DTEND:${utc(end.dateTime)}`)
    else if (start.date && end.date) lines.push(`DTSTART;VALUE=DATE:${day(start.date)}`, `DTEND;VALUE=DATE:${day(end.date)}`)
    else continue
    lines.push(`SUMMARY:${esc(e.summary?.trim() || 'Busy')}`, 'END:VEVENT')
    count++
  }
  lines.push('END:VCALENDAR')
  return { ics: lines.join('\r\n'), count }
}

/** Opens Google's own sign-in window, then returns the viewer's calendar as .ics text. */
export async function fetchGoogleCalendar(): Promise<{ ics: string; count: number }> {
  await loadScript()
  return toIcs(await listEvents(await token()))
}
