import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? 'ws://localhost:8000'

export const api = axios.create({ baseURL: API_BASE })

export interface Group {
  id: string
  name: string
  type: string
  invite_code: string
}

export interface MeetingRequestInput {
  group_id: string
  title: string
  duration_minutes: number
  date_range_start: string
  date_range_end: string
  is_recurring?: boolean
  location_constraint?: string
  urgency?: 'low' | 'normal' | 'high'
}

export interface MeetingDecision {
  chosen_datetime: string | null
  chosen_location: string | null
  explanation: string
  satisfaction_breakdown: Record<string, number>
  alternatives: { datetime: string; avg_satisfaction: number }[]
}

export async function createGroup(name: string, adminUserId: string, type = 'custom') {
  const res = await api.post<Group>(`/groups?admin_user_id=${adminUserId}`, { name, type, default_duration: 60 })
  return res.data
}

export async function createMeetingRequest(input: MeetingRequestInput, requestedBy: string) {
  const res = await api.post<{ id: string; status: string }>(
    `/meetings?requested_by=${requestedBy}`,
    input
  )
  return res.data
}

export async function startNegotiation(meetingId: string) {
  const res = await api.post<MeetingDecision>(`/meetings/${meetingId}/negotiate`)
  return res.data
}
