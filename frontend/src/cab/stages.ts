/**
 * The cab never reloads; a route only picks a stage. Each stage says how the console is
 * arranged around the scope, and the camera follows from that.
 */
export type StageId = 'attract' | 'plan'

export interface StageSpec {
  id: StageId
  /** Read on the status bar, in tower terms. */
  name: string
  /** Width of the strip bay on desktop. A wide bay is a strip pulled out to work on. */
  bay: number
  /** Width of the comms panel on desktop; 0 slides it away. */
  panel: number
}

export const STAGES: Record<StageId, StageSpec> = {
  attract: { id: 'attract', name: 'ATIS · INFORMATION ALPHA', bay: 360, panel: 400 },
  plan: { id: 'plan', name: 'FLIGHT PLAN · FILING', bay: 660, panel: 0 },
}

export function stageFor(pathname: string): StageSpec {
  if (pathname === '/new') return STAGES.plan
  return STAGES.attract
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const GUTTER = 28

/** Where the scope goes: the largest square in the space the bay and panel leave free. */
export function scopeFrame(stage: StageSpec, w: number, h: number, desktop: boolean): Rect {
  if (!desktop) {
    const s = Math.min(w, h) - 16
    return { x: (w - s) / 2, y: (h - s) / 2, w: s, h: s }
  }
  const left = stage.bay + GUTTER
  const right = w - stage.panel - GUTTER
  const room = Math.max(200, right - left)
  const s = Math.min(room, h - GUTTER * 2)
  return { x: left + (room - s) / 2, y: (h - s) / 2, w: s, h: s }
}
