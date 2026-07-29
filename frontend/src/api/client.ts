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

export interface Member {
  user_id: string
  name: string | null
  role: string
  ready: boolean
}

export interface AgentResponseSummary {
  user_id: string
  user_name: string
  notes: string
  top_slot: { datetime: string; satisfaction: number } | null
}

export interface MeetingState {
  meeting_status: string
  negotiation_status: string | null
  responses: AgentResponseSummary[]
  decision: MeetingDecision | null
}

const USER_ID_KEY = 'meetmind_user_id'
const USER_NAME_KEY = 'meetmind_user_name'

export async function getOrCreateUserId(): Promise<string> {
  const existing = localStorage.getItem(USER_ID_KEY)
  if (existing) return existing
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

export async function createEvent(title: string, userId: string) {
  const res = await api.post<Event>(`/events?requested_by=${userId}`, { title })
  return res.data
}

export async function getEvent(eventId: string) {
  const res = await api.get<Event>(`/events/${eventId}`)
  return res.data
}

export async function getEventByInvite(inviteCode: string) {
  const res = await api.get<Event>(`/events/invite/${inviteCode}`)
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

export async function listEventMembers(eventId: string) {
  const res = await api.get<Member[]>(`/events/${eventId}/members`)
  return res.data
}

export async function markReady(eventId: string, userId: string) {
  const res = await api.post<{ ready_count: number; total_count: number; negotiation_started: boolean }>(
    `/events/${eventId}/ready?user_id=${userId}`,
  )
  return res.data
}

export async function getMeetingState(meetingId: string) {
  const res = await api.get<MeetingState>(`/meetings/${meetingId}/state`)
  return res.data
}
