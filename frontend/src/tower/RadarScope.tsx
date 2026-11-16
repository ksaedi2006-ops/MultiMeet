import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { TowerModel } from './model'
import { ScopeEngine, type Frame } from './scope/engine'

interface Props {
  model: TowerModel
  highlight: string | null
  onHover: (id: string | null) => void
  onLanded: () => void
  /** Where the scope sits inside the canvas; omitted, it fills the canvas. */
  frame?: Frame | null
  label?: string
}

function describe(m: TowerModel): string {
  const open = m.slots.filter((s) => !s.closed).length
  const lead = m.shortlist[0] && m.slots.find((s) => s.id === m.shortlist[0].slot_id)
  const parts = [`Radar view of the negotiation: ${m.agents.length} agents`]
  if (m.slots.length) parts.push(`${open} of ${m.slots.length} times still open`)
  if (lead) parts.push(`leading ${lead.label}`)
  if (m.decision?.slot) parts.push(`cleared for ${m.decision.slot.label}`)
  return parts.join(', ') + '. The strip board and tower log below list the same details.'
}

export default function RadarScope({ model, highlight, onHover, onLanded, frame, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<ScopeEngine | null>(null)
  const reduced = useReducedMotion() ?? false
  const callbacks = useRef({ onHover, onLanded })
  callbacks.current = { onHover, onLanded }

  useEffect(() => {
    const e = new ScopeEngine(canvas.current!)
    engine.current = e
    e.start()
    return () => e.destroy()
  }, [])

  useEffect(() => {
    engine.current?.setOptions({
      reducedMotion: reduced,
      highlight,
      onHover: (id) => callbacks.current.onHover(id),
      onLanded: () => callbacks.current.onLanded(),
    })
  }, [reduced, highlight])

  useEffect(() => {
    engine.current?.setModel(model)
  }, [model])

  useEffect(() => {
    if (frame) engine.current?.setFrame(frame)
  }, [frame])

  return <canvas ref={canvas} role="img" aria-label={label ?? describe(model)} className="block w-full h-full touch-none" />
}
