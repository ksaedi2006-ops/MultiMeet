import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { emptyModel } from '../tower/model'
import RadarScope from '../tower/RadarScope'
import CabBar from './CabBar'
import { CabContext, type Cab, type ScopeFeed } from './context'
import { fixtureWidths, scopeFrame, stageFor, type Rect } from './stages'

const DESKTOP = '(min-width: 1024px)'

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

/**
 * The console: one layout that stays mounted for the whole visit. The scope, the left
 * panel and the right panel are permanent fixtures; routes only change the stage, which moves
 * the camera and swaps what the bay and panel hold.
 */
export default function TowerCab() {
  const { pathname } = useLocation()
  const stage = stageFor(pathname)
  const desktop = useMedia(DESKTOP)
  const [bay, setBay] = useState<HTMLElement | null>(null)
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [scope, setScope] = useState<ScopeFeed>({ model: emptyModel })
  const [highlight, setHighlight] = useState<string | null>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = layer.current!
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const frame: Rect | null = useMemo(
    () => (size.w ? scopeFrame(stage, size.w, size.h, desktop) : null),
    [stage, size.w, size.h, desktop],
  )

  const widths = fixtureWidths(stage, size.w || window.innerWidth)
  const feed = useCallback((f: ScopeFeed) => setScope(f), [])
  const cab: Cab = useMemo(() => ({ bay, panel, feed, highlight, setHighlight, desktop }), [bay, panel, feed, highlight, desktop])
  const landed = useRef(scope.onLanded)
  landed.current = scope.onLanded
  const onLanded = useCallback(() => landed.current?.(), [])

  return (
    <CabContext.Provider value={cab}>
      <div className="cab-floor min-h-svh lg:h-svh lg:overflow-hidden flex flex-col">
        <CabBar stage={scope.stageName ? { ...stage, name: scope.stageName } : stage} />
        <div className="relative flex-1 min-h-0 flex flex-col lg:block">
          <div ref={layer} className="relative h-[max(52svh,min(100vw,88svh))] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
            <RadarScope model={scope.model} label={scope.label} frame={frame}
              highlight={highlight} onHover={setHighlight} onLanded={onLanded} />
            {frame && scope.legend && (
              <p className="absolute text-center text-[13px] leading-snug text-mist px-2"
                style={{ left: frame.x, width: frame.w, top: frame.y + frame.h + 6 }}>
                {scope.legend}
              </p>
            )}
            {frame && scope.overlay && (
              <div className="absolute pointer-events-none flex items-center justify-center"
                style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}>
                {scope.overlay}
              </div>
            )}
          </div>

          <aside ref={setBay} aria-label={stage.id === 'plan' ? 'New meeting form' : stage.id === 'invite' ? 'People' : stage.id === 'join' ? 'Already in' : stage.id === 'calendar' ? 'Your week' : stage.id === 'preferences' ? 'Your card' : stage.id === 'negotiate' ? 'Everyone' : 'Get started'}
            style={{ ['--bay-w' as string]: `${widths.bay}px` }}
            className="console relative order-2 lg:order-none lg:absolute lg:left-0 lg:top-0 lg:bottom-0 lg:w-[var(--bay-w)] border-t lg:border-t-0 lg:border-r border-board-line transition-[width] duration-700 ease-out-expo lg:overflow-y-auto lg:overflow-x-hidden" />

          <aside ref={setPanel} aria-label="About MultiMeet"
            style={{ ['--panel-w' as string]: `${widths.panel || 400}px` }}
            className={`console relative order-1 lg:order-none lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[var(--panel-w)] border-t lg:border-t-0 lg:border-l border-board-line lg:overflow-y-auto transition-[transform,opacity] duration-700 ease-out-expo ${
              stage.panel === 0 ? 'hidden lg:block lg:translate-x-full lg:opacity-0 lg:pointer-events-none' : ''}`} />
        </div>
      </div>
      <Outlet />
    </CabContext.Provider>
  )
}
