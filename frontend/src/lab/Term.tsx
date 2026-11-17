import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY, type TermId } from './glossary'

/**
 * A formal term with its definition one hover, tap or focus away. The screen keeps the
 * field's vocabulary; the explanation lives in this dropdown, never inline.
 */
/**
 * `passive`: for a term inside a control (a radio, a card). Hover still explains it, but a click
 * goes to the control and the term isn't a separate tab stop.
 */
export default function Term({ id, children, className = '', passive = false }: {
  id: TermId; children?: ReactNode; className?: string; passive?: boolean
}) {
  const e = GLOSSARY[id]
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, above: false })
  const anchor = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const tip = useId()
  const show = open || pinned

  useLayoutEffect(() => {
    if (!show || !anchor.current) return
    const r = anchor.current.getBoundingClientRect()
    const w = Math.min(320, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    const above = r.bottom + 220 > window.innerHeight && r.top > 240
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above })
  }, [show])

  useEffect(() => {
    if (!show) return
    const close = () => { setOpen(false); setPinned(false) }
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && close()
    const onDown = (ev: PointerEvent) => {
      if (!anchor.current?.contains(ev.target as Node) && !pop.current?.contains(ev.target as Node)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', close, true)
    }
  }, [show])

  return (
    <>
      <span ref={anchor} tabIndex={passive ? undefined : 0} role={passive ? undefined : 'button'}
        aria-describedby={show ? tip : undefined} aria-expanded={passive ? undefined : show}
        onPointerEnter={(ev) => ev.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(ev) => ev.pointerType === 'mouse' && setOpen(false)}
        onFocus={passive ? undefined : () => setOpen(true)} onBlur={passive ? undefined : () => setOpen(false)}
        onClick={passive ? undefined : (ev) => { ev.stopPropagation(); setPinned((p) => !p) }}
        onKeyDown={passive ? undefined : (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPinned((p) => !p) } }}
        className={`cursor-help underline decoration-dotted decoration-mist/60 underline-offset-[3px] hover:decoration-amber focus-visible:decoration-amber outline-none ${className}`}>
        {children ?? e.term}
      </span>
      {show && createPortal(
        <div ref={pop} id={tip} role="tooltip"
          style={{ left: pos.left, top: pos.top, transform: pos.above ? 'translateY(-100%)' : undefined }}
          className="fixed z-[60] w-[min(320px,calc(100vw-16px))] rounded-[2px] border border-board-line bg-console px-3.5 py-3 text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]">
          <p className="text-[13.5px] font-semibold text-strip">{e.term}</p>
          <p className="mt-1 text-[13px] leading-snug text-strip/85">{e.what}</p>
          {'formula' in e && e.formula && <p className="mt-2 font-mono text-[11.5px] text-amber break-words">{e.formula}</p>}
          <p className="mt-2 text-[11.5px] text-mist">{e.source}</p>
        </div>,
        document.body,
      )}
    </>
  )
}
