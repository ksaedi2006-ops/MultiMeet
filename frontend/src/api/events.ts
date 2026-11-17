/** Every event the backend appends to an event's log (see backend/app/negotiation.py). */

interface Base {
  seq: number
  at: string | null
}

export interface SlotInfo {
  id: string
  start: string
  end: string
  label: string
}

export interface RankedInfo {
  slot_id: string
  min_score: number
  avg_score: number
  scores: Record<string, number>
  unhappy: string[]
}

export interface Binding {
  pick: string
  runner_up: string | null
  decisive: string | null
  decisive_label: string | null
  bottleneck: string | null
  tied: string[]
}

export interface MemberPayload {
  user_id: string
  name: string
  role: 'admin' | 'member'
  ready: boolean
  calendar_events: number
  rules: number
}

export type LogEvent = Base &
  (
    | ({ type: 'member_joined' | 'member_updated' } & MemberPayload)
    | {
        type: 'negotiation_started'
        participants: { user_id: string; name: string; carrier: string }[]
        slots: SlotInfo[]
        timezone: string
        agent_backend: string
      }
    | {
        type: 'slots_closed'
        closed: { slot_id: string; blockers: { user_id: string; name: string; reason: string }[] }[]
        open: string[]
      }
    | { type: 'round_started'; round: number; kind: 'score' | 'asks'; slot_ids?: string[] }
    | { type: 'agent_thinking'; user_id: string; round: number }
    | {
        type: 'agent_scored'
        user_id: string
        round: number
        scores: Record<string, number>
        summary: string
        fallback: boolean
        private?: { reasons: Record<string, string> }
      }
    | { type: 'agent_failed'; user_id: string; round: number; error: string; fallback: string }
    | { type: 'shortlist'; round: number; ranked: RankedInfo[] }
    | { type: 'mediator_ask'; round: number; ask_id: string; slot_id: string; to_user_id: string; to_name: string; text: string; rule_label?: string }
    | {
        type: 'agent_reply'
        round: number
        ask_id: string
        user_id: string
        slot_id: string
        response: 'accept' | 'flex' | 'hold'
        old_score: number
        new_score: number
        text: string
      }
    | {
        type: 'decision'
        status: 'converged' | 'escalated'
        slot: SlotInfo | null
        scores: Record<string, number>
        min_score: number | null
        avg_score: number | null
        compromises: { user_id: string; name: string; gave_up: string; score: number }[]
        alternatives: { slot_id: string; label: string; min_score: number; avg_score: number }[]
        explanation: string
        question: string | null
        /** Additive (negotiation layer): the solver's real reason for its pick. */
        binding?: Binding | null
        normalization?: string
        faithful?: boolean
      }
    | { type: 'negotiation_failed'; error: string }
    | { type: 'rsvp'; user_id: string; name: string; response: 'accepted' | 'declined' }
  )

export type EventType = LogEvent['type']
