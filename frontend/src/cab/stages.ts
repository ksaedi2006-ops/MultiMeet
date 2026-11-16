/**
 * The cab never reloads; a route only picks a stage. Each stage says how the console is
 * arranged around the scope, and the camera follows from that.
 */
export type StageId = 'attract' | 'plan' | 'invite' | 'join' | 'calendar' | 'preferences' | 'negotiate'

export interface StageSpec {
  id: StageId
  /** Read on the status bar, in plain words. */
  name: string
  /** Width of the strip bay on desktop. A wide bay is a strip pulled out to work on. */
  bay: number
  /** Width of the comms panel on desktop; 0 slides it away. */
  panel: number
}

export const STAGES: Record<StageId, StageSpec> = {
  attract: { id: 'attract', name: 'How it works', bay: 360, panel: 400 },
  plan: { id: 'plan', name: 'New meeting', bay: 660, panel: 0 },
  invite: { id: 'invite', name: 'Invite people', bay: 360, panel: 420 },
  join: { id: 'join', name: 'You’re invited', bay: 340, panel: 440 },
  calendar: { id: 'calendar', name: 'Your calendar', bay: 440, panel: 420 },
  preferences: { id: 'preferences', name: 'Your preferences', bay: 380, panel: 440 },
  negotiate: { id: 'negotiate', name: 'Negotiating', bay: 520, panel: 440 },
}

export function stageFor(pathname: string): StageSpec {
  if (pathname === '/new') return STAGES.plan
  if (/^\/event\/[^/]+\/share\/?$/.test(pathname)) return STAGES.invite
  if (/^\/join\/[^/]+\/?$/.test(pathname)) return STAGES.join
  if (/^\/event\/[^/]+\/upload\/?$/.test(pathname)) return STAGES.calendar
  if (/^\/event\/[^/]+\/agent\/?$/.test(pathname)) return STAGES.preferences
  if (/^\/event\/[^/]+\/negotiate\/?$/.test(pathname)) return STAGES.negotiate
  return STAGES.attract
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const GUTTER = 28
/** Room kept under the scope for its one-line legend. */
const LEGEND = 30
const LEGEND_PHONE = 64

/**
 * Bay and panel widths for the actual viewport. On a narrow desktop they give way so the
 * scope always keeps at least ~44% of the width.
 */
export function fixtureWidths(stage: StageSpec, w: number): { bay: number; panel: number } {
  const share = (px: number, frac: number) => (px === 0 ? 0 : Math.round(Math.min(px, Math.max(280, w * frac))))
  return {
    bay: share(stage.bay, stage.bay > 500 ? 0.5 : 0.27),
    panel: share(stage.panel, 0.29),
  }
}

/** Where the scope goes: the largest square in the space the bay and panel leave free. */
export function scopeFrame(stage: StageSpec, w: number, h: number, desktop: boolean): Rect {
  if (!desktop) {
    const s = Math.min(w - 16, h - LEGEND_PHONE - 12)  // the legend wraps to two lines on a phone
    return { x: (w - s) / 2, y: 6, w: s, h: s }
  }
  const fx = fixtureWidths(stage, w)
  const left = fx.bay + GUTTER
  const right = w - fx.panel - GUTTER
  const room = Math.max(200, right - left)
  const s = Math.min(room, h - GUTTER * 2 - LEGEND)
  return { x: left + (room - s) / 2, y: (h - LEGEND - s) / 2, w: s, h: s }
}
