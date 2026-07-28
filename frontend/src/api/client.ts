import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:8000'

export const api = axios.create({ baseURL: API_BASE })

export interface User {
  id: string
  email: string
  name: string
}

export interface Event {
  event_id: string
  group_id: string
  title: string
  invite_code: string
  status: string
}

export interface Preference {
  id: string
  raw_text: string
  parsed_rules: { ack?: string; type?: string; [key: string]: unknown }
  strength: string
}

export interface MeetingDecision {
  chosen_datetime: string | null
  chosen_location: string | null
  explanation: string
  satisfaction_breakdown: Record<string, number>
  alternatives: { datetime: string; avg_satisfaction: number }[]
}

const USER_ID_KEY = 'meetmind_user_id'

export async function getOrCreateUserId(): Promise<string> {
  const existing = localStorage.getItem(USER_ID_KEY)
  if (existing) return existing
  const res = await api.post<User>('/users/anon')
  localStorage.setItem(USER_ID_KEY, res.data.id)
  return res.data.id
}

export async function createEvent(title: string, userId: string) {
  const res = await api.post<Event>(`/events?requested_by=${userId}`, { title })
  return res.data
}

export async function getEvent(eventId: string) {
  const res = await api.get<Event>(`/events/${eventId}`)
  return res.data
}

export async function joinEvent(inviteCode: string, userId: string) {
  const res = await api.post<Event>(`/events/join/${inviteCode}?user_id=${userId}`)
  return res.data
}

export async function uploadCalendar(userId: string, rawIcs: string) {
  const res = await api.post<{ events_parsed: number }>(`/users/${userId}/calendar`, { raw_ics: rawIcs })
  return res.data
}

export async function addPreference(userId: string, rawText: string) {
  const res = await api.post<Preference>(`/users/${userId}/preferences`, { raw_text: rawText })
  return res.data
}

export async function listPreferences(userId: string) {
  const res = await api.get<Preference[]>(`/users/${userId}/preferences`)
  return res.data
}

export async function startNegotiation(eventId: string) {
  const res = await api.post<MeetingDecision>(`/meetings/${eventId}/negotiate`)
  return res.data
}
