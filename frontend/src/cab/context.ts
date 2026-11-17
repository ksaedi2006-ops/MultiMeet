import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { TowerModel } from '../tower/model'
import type { RingMarker } from '../tower/scope/engine'

export interface ScopeFeed {
  model: TowerModel
  /** Read out to assistive tech in place of the default scope description. */
  label?: string
  onLanded?: () => void
  /** Drawn centred on the scope wherever the camera has put it (the stamp, for one). */
  overlay?: ReactNode
  /** One plain line under the scope saying what the marks mean. */
  legend?: string
  /** Replaces the step name in the top bar, e.g. "Booked" once the negotiation lands. */
  stageName?: string
  /** Labels pinned to times on the ring, e.g. where each decision rule would book. */
  markers?: RingMarker[]
}

export interface Cab {
  bay: HTMLElement | null
  panel: HTMLElement | null
  banner: HTMLElement | null // a full-width row under the top bar; empty unless a step fills it
  tools: HTMLElement | null // controls in the top bar, beside sound; empty unless a step fills it
  feed: (f: ScopeFeed) => void
  highlight: string | null
  setHighlight: (id: string | null) => void
  desktop: boolean
}

export const CabContext = createContext<Cab | null>(null)

export function useCab(): Cab {
  const cab = useContext(CabContext)
  if (!cab) throw new Error('useCab outside <TowerCab>')
  return cab
}

/** The DOM node of one of the cab's permanent fixtures, for a stage to portal into. */
export function useFixture(which: 'bay' | 'panel' | 'banner' | 'tools'): HTMLElement | null {
  return useCab()[which]
}

/** A stage hands the persistent scope what to show; the scope itself never remounts. */
export function useScopeFeed(f: ScopeFeed) {
  const { feed } = useCab()
  const { model, label, onLanded, overlay, legend, stageName, markers } = f
  useEffect(() => {
    feed({ model, label, onLanded, overlay, legend, stageName, markers })
  }, [feed, model, label, onLanded, overlay, legend, stageName, markers])
}
