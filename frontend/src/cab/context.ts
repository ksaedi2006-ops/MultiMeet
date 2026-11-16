import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { TowerModel } from '../tower/model'

export interface ScopeFeed {
  model: TowerModel
  /** Read out to assistive tech in place of the default scope description. */
  label?: string
  onLanded?: () => void
  /** Drawn centred on the scope wherever the camera has put it (the stamp, for one). */
  overlay?: ReactNode
}

export interface Cab {
  bay: HTMLElement | null
  panel: HTMLElement | null
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
export function useFixture(which: 'bay' | 'panel'): HTMLElement | null {
  return useCab()[which]
}

/** A stage hands the persistent scope what to show; the scope itself never remounts. */
export function useScopeFeed(f: ScopeFeed) {
  const { feed } = useCab()
  const { model, label, onLanded, overlay } = f
  useEffect(() => {
    feed({ model, label, onLanded, overlay })
  }, [feed, model, label, onLanded, overlay])
}
