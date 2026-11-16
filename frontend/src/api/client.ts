import axios, { AxiosError } from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE ?? `${location.protocol}//${location.hostname}:8000`
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? API_BASE.replace(/^http/, 'ws')

export const api = axios.create({ baseURL: API_BASE })

/** The backend's own explanation when it gave one, otherwise the fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as AxiosError<{ detail?: unknown }>)?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export interface User {
  id: string
  name: string
}

export interface EventInfo {
  event_id: string
  title: string
  invite_code: string
  status: 'open' | 'negotiating' | 'scheduled' | 'escalated' | 'failed'
  organizer_id: string
  duration_minutes: number
  start_date: string
  end_date: string
  timezone: string
  earliest_hour: number
  latest_hour: number
  weekdays: number[]
}

export interface EventSettings {
  title: string
  duration_minutes: number
  start_date: string
  end_date: string
  timezone: string
  earliest_hour: number
  latest_hour: number
  weekdays: number[]
}

export interface Member {
  user_id: string
  name: string
  role: 'admin' | 'member'
  ready: boolean
  calendar_events: number
  rules: number
}

export interface Rule {
  kind: 'not_before' | 'not_after' | 'avoid_weekdays' | 'buffer_minutes' | 'free_text'
  strength: 'hard' | 'soft'
  summary: string
  time?: string
  weekdays?: number[]
  minutes?: number
}

export interface Preference {
  id: string
  raw_text: string
  rules: Rule[]
  ack: string | null
}

export interface BusyEvent {
  start: string
  end: string
  title: string
  kind: 'hard' | 'soft'
  all_day: boolean
}

export interface CalendarInfo {
  filename: string | null
  uploaded_at: string | null
  events: BusyEvent[]
}

export interface Decision {
  status: 'converged' | 'escalated'
  slot_id: string | null
  label: string | null
  start: string | null
  end: string | null
  explanation: string | null
  question: string | null
  scores: Record<string, number>
  compromises: { user_id: string; name: string; gave_up: string; score: number }[]
  alternatives: { slot_id: string; label: string; min_score: number; avg_score: number }[]
  rsvps: Record<string, 'accepted' | 'declined'>
}

const USER_ID_KEY = 'meetmind_user_id'
const USER_NAME_KEY = 'meetmind_user_name'

export function currentUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY)
}

export async function getOrCreateUserId(): Promise<string> {
  const existing = localStorage.getItem(USER_ID_KEY)
  if (existing) {
    try {
      await api.get(`/users/${existing}`)
      return existing
    } catch (err) {
      // The local database was reset since this browser last visited; start fresh.
      if ((err as AxiosError).response?.status !== 404) throw err
    }
  }
  const res = await api.post<User>('/users/anon')
  localStorage.setItem(USER_ID_KEY, res.data.id)
  return res.data.id
}

export function getSavedName(): string {
  return localStorage.getItem(USER_NAME_KEY) ?? ''
}

export async function setUserName(userId: string, name: string) {
  localStorage.setItem(USER_NAME_KEY, name)
  await api.patch<User>(`/users/${userId}`, { name })
}

export async function createEvent(settings: EventSettings, userId: string) {
  return (await api.post<EventInfo>('/events', settings, { params: { requested_by: userId } })).data
}

export async function createSampleEvent(userId: string, count: number, title?: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    await api.post<EventInfo>('/events/sample', null, { params: { user_id: userId, count, timezone, ...(title ? { title } : {}) } })
  ).data
}

export async function addSamplePeople(eventId: string, userId: string, count: number) {
  await api.post(`/events/${eventId}/sample`, null, { params: { user_id: userId, count } })
}

export async function fillSampleCalendar(userId: string, eventId?: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    await api.post<CalendarInfo>(`/users/${userId}/calendar/sample`, null, {
      params: { timezone, ...(eventId ? { event_id: eventId } : {}) },
    })
  ).data
}

export async function getEvent(eventId: string) {
  return (await api.get<EventInfo>(`/events/${eventId}`)).data
}

export async function getEventByInvite(inviteCode: string) {
  return (await api.get<EventInfo>(`/events/invite/${inviteCode}`)).data
}

export async function joinEvent(inviteCode: string, userId: string) {
  return (await api.post<EventInfo>(`/events/join/${inviteCode}`, null, { params: { user_id: userId } })).data
}

export async function listMembers(eventId: string) {
  return (await api.get<Member[]>(`/events/${eventId}/members`)).data
}

export async function setReady(eventId: string, userId: string, ready = true) {
  return (await api.post<Member>(`/events/${eventId}/ready`, { ready }, { params: { user_id: userId } })).data
}

export async function startNegotiation(eventId: string, userId: string) {
  return (
    await api.post<{ started: boolean; participants: number; left_out: string[]; agent_backend: string }>(
      `/events/${eventId}/start`,
      null,
      { params: { user_id: userId } },
    )
  ).data
}

export async function getDecision(eventId: string) {
  return (await api.get<Decision>(`/events/${eventId}/decision`)).data
}

export async function sendRsvp(eventId: string, userId: string, response: 'accepted' | 'declined') {
  await api.post(`/events/${eventId}/rsvp`, { response }, { params: { user_id: userId } })
}

export function icsUrl(eventId: string) {
  return `${API_BASE}/events/${eventId}/calendar.ics`
}

export async function getCalendar(userId: string) {
  return (await api.get<CalendarInfo>(`/users/${userId}/calendar`)).data
}

export async function uploadCalendar(userId: string, rawIcs: string, filename: string, eventId?: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    await api.post<CalendarInfo>(
      `/users/${userId}/calendar`,
      { raw_ics: rawIcs, filename, timezone },
      { params: eventId ? { event_id: eventId } : {} },
    )
  ).data
}

export async function setEventKind(userId: string, title: string, kind: 'hard' | 'soft') {
  return (await api.patch<CalendarInfo>(`/users/${userId}/calendar/override`, { title, kind })).data
}

export async function listPreferences(userId: string) {
  return (await api.get<Preference[]>(`/users/${userId}/preferences`)).data
}

export async function addPreference(userId: string, rawText: string, eventId?: string) {
  return (
    await api.post<Preference>(
      `/users/${userId}/preferences`,
      { raw_text: rawText },
      { params: eventId ? { event_id: eventId } : {} },
    )
  ).data
}

export async function deletePreference(userId: string, id: string, eventId?: string) {
  await api.delete(`/users/${userId}/preferences/${id}`, { params: eventId ? { event_id: eventId } : {} })
}
