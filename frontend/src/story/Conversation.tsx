import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'
import TowerLog from '../tower/TowerLog'
import type { TowerModel } from '../tower/model'
import Face from './Face'

const TAG_TONE = { 'Can move': 'text-amber', 'Won’t move': 'text-signal', Agrees: 'text-amber' } as const

/**
 * The negotiation as a group chat: the mediator's requests, each agent's answer and a few short
 * updates. The full technical log stays one tap away.
 */
export default function Conversation({ model, viewerId }: { model: TowerModel; viewerId: string | null }) {
  const [everything, setEverything] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const byId = new Map(model.agents.map((a) => [a.id, a]))
  const joined = model.agents.length

  useEffect(() => {
    const box = end.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [model.chat.length])

  return (
    <section aria-label="The conversation" className="flex flex-col border border-board-line rounded-[2px] bg-console/60">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-board-line">
        <h2 className="font-mono text-[11px] tracking-[0.16em] text-mist">THE CONVERSATION</h2>
        <button type="button" onClick={() => setEverything((v) => !v)} aria-pressed={everything}
          className="font-mono text-[11px] tracking-[0.12em] text-amber hover:underline underline-offset-4">
          {everything ? 'JUST THE CONVERSATION' : 'SHOW EVERYTHING'}
        </button>
      </div>
      {everything ? (
        <div className="flex h-[30rem]"><TowerLog model={model} viewerId={viewerId} /></div>
      ) : (
        <div className="min-h-[14rem] max-h-[30rem] overflow-y-auto px-4 py-4 flex flex-col gap-3" aria-live="polite">
          {joined > 0 && (
            <p className="text-center text-[12px] text-mist">
              {joined} {joined === 1 ? 'person' : 'people'} in · {model.phase === 'holding' ? 'waiting for the organiser to start' : 'each has an agent'}
            </p>
          )}
          <AnimatePresence initial={false}>
            {model.chat.map((c) => {
              const who = c.who ? byId.get(c.who) : undefined
              if (c.kind === 'update') {
                return (
                  <motion.p key={c.seq} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center text-[12px] text-mist">{c.text}</motion.p>
                )
              }
              const agent = c.kind === 'agent'
              return (
                <motion.div key={c.seq} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`flex items-end gap-2.5 ${agent ? 'flex-row-reverse' : ''}`}>
                  {agent && who ? <Face avatar={who.avatar} size={28} />
                    : <span aria-hidden className="w-7 h-7 shrink-0 rounded-full border border-amber/70 flex items-center justify-center font-mono text-[11px] text-amber">M</span>}
                  <div className={`max-w-[85%] rounded-[10px] px-3.5 py-2.5 ${agent
                    ? 'bg-strip text-strip-ink rounded-br-[2px]'
                    : 'bg-board-raised text-strip rounded-bl-[2px]'}`}>
                    <p className={`text-[12px] font-semibold ${agent ? 'text-strip-ink/70' : 'text-amber'}`}>
                      {agent ? `${who?.name.split(' ')[0] ?? 'Someone'}’s agent` : who ? `Mediator → ${who.name.split(' ')[0]}` : 'Mediator'}
                      {c.tag && <span className={`ml-2 ${agent ? 'text-clearance-dim' : TAG_TONE[c.tag]}`}>{c.tag}</span>}
                    </p>
                    <p className="mt-0.5 text-[14.5px] leading-snug">{c.text}</p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={end} />
        </div>
      )}
    </section>
  )
}
