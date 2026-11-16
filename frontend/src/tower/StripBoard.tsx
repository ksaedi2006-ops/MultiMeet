import { motion } from 'framer-motion'
import { blockerPhrase } from '../lib/timeLabels'
import type { Agent, SlotModel, TowerModel } from './model'

interface Props {
  model: TowerModel
  viewerId: string | null
  highlight: string | null
  onHover: (id: string | null) => void
}

const CLOSED_PX = 1.5

/**
 * Score to ink density: barely-there for unwanted times, amber in the middle, deep
 * amber-brown for favourites. Safety orange stays reserved for crossed-out and chosen times.
 */
function ink(score: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [220, 209, 182]],
    [50, [226, 172, 78]],
    [100, [104, 70, 22]],
  ]
  const i = score <= 50 ? 0 : 1
  const [a, ca] = stops[i]
  const [b, cb] = stops[i + 1]
  const t = (score - a) / (b - a)
  const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function statusLabel(agent: Agent, model: TowerModel): string {
  if (model.decision?.status === 'converged') return 'Booked'
  if (model.decision?.status === 'escalated') return 'No time works'
  if (agent.reply) return agent.reply.response === 'flex' ? 'Can move' : agent.reply.response === 'hold' ? 'Won’t move' : 'Agrees'
  return {
    holding: 'Setting up', ready: 'Ready', thinking: 'Thinking…', scored: 'Rated', asked: 'Asked to move',
    replied: 'Replied', failed: 'Agent error',
  }[agent.status]
}

interface Day {
  key: string
  label: string
  slots: SlotModel[]
  open: number
  closed: number
}

function groupDays(slots: SlotModel[]): Day[] {
  const days: Day[] = []
  for (const s of slots) {
    let day = days[days.length - 1]
    if (!day || day.key !== s.dayKey) {
      day = { key: s.dayKey, label: s.dayLabel, slots: [], open: 0, closed: 0 }
      days.push(day)
    }
    day.slots.push(s)
    if (s.closed) day.closed++
    else day.open++
  }
  return days
}

/** A day's share of the track: its open times grow, its closed times are thin fixed lines. */
function dayFlex(day: Day): string {
  return `${day.open} 1 ${day.closed * (CLOSED_PX + 1)}px`
}

function cellFlex(s: SlotModel): string {
  return s.closed ? `0 0 ${CLOSED_PX}px` : '1 1 0'
}

export default function StripBoard({ model, viewerId, highlight, onHover }: Props) {
  const winner = model.decision?.status === 'converged' ? model.decision.slot?.id : null
  const days = groupDays(model.slots)
  const hasSlots = days.length > 0
  const ease = 'transition-[flex] duration-700 ease-out'

  return (
    <div className="flex flex-col gap-1.5">
      {hasSlots && (
        <p className="text-[13px] leading-snug text-mist mb-1">
          Each row is a person, each bar a possible time. Darker means they like it more. Thin lines are times
          someone can’t make.
        </p>
      )}
      {hasSlots && (
        <div className="flex flex-col gap-0.5 pl-[10.5rem] pr-3" aria-hidden>
          <div className="flex gap-[3px] h-4">
            {days.map((day) => (
              <div key={day.key} className={`@container min-w-0 ${ease}`} style={{ flex: dayFlex(day) }}>
                <span className="block font-mono text-[11px] leading-4 tracking-wider text-mist whitespace-nowrap overflow-hidden">
                  <span className="hidden @[3.25rem]:inline">{day.label}</span>
                  <span className="@[3.25rem]:hidden">{Number(day.key.slice(8))}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {model.agents.map((agent) => {
        const scores = model.scores[agent.id]
        const mine = agent.id === viewerId
        const lit = highlight === agent.id
        return (
          <motion.div
            key={agent.id}
            layout="position"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onPointerEnter={() => onHover(agent.id)}
            onPointerLeave={() => onHover(null)}
            className={`flex items-stretch h-12 bg-strip text-strip-ink rounded-[2px] overflow-hidden shadow-[0_6px_14px_-8px_rgba(0,0,0,0.7)] outline outline-2 transition-[outline-color] ${
              // The mediator is asking this person: ring the row so it's easy to spot.
              lit ? 'outline-amber' : agent.status === 'asked' ? 'outline-clearance' : 'outline-transparent'
            }`}
          >
            <div className="w-[10.5rem] shrink-0 flex flex-col justify-center px-2.5 border-r border-strip-ink/15">
              <span className="text-[14px] font-semibold leading-none truncate">
                {agent.name}
                {mine && <span className="font-normal text-strip-ink/65"> (you)</span>}
              </span>
              <div className="mt-1.5">
                <span className={`text-[12px] leading-none ${
                  model.decision?.status === 'converged' ? 'text-clearance-dim font-semibold'
                    : agent.status === 'asked' ? 'text-strip-ink font-semibold' : 'text-strip-ink/65'}`}>
                  {statusLabel(agent, model)}
                </span>
              </div>
            </div>
            {hasSlots ? (
              <div className="flex-1 flex items-stretch gap-[3px] py-1 pl-0 pr-3 min-w-0">
                {days.map((day) => (
                  <div key={day.key} className={`flex gap-px min-w-0 ${ease}`} style={{ flex: dayFlex(day) }}>
                    {day.slots.map((s) => {
                      const score = scores?.[s.id]
                      const reason = mine ? agent.reasons?.[s.id] : undefined
                      return (
                        <div
                          key={s.id}
                          title={
                            s.closed
                              ? `${s.label}: can't (${s.blockers.map((b) => blockerPhrase(b.name, b.reason)).join('; ')})`
                              : `${s.label}${score !== undefined ? `: ${score}` : ''}${reason ? ` · ${reason}` : ''}`
                          }
                          className={`rounded-[1px] transition-[flex,background-color,opacity] duration-700 ease-out ${
                            s.id === winner ? 'ring-2 ring-clearance ring-inset' : ''
                          }`}
                          style={{
                            flex: cellFlex(s),
                            minWidth: 0,
                            background: s.closed
                              ? 'rgba(42,32,21,0.28)'
                              : score === undefined
                                ? 'rgba(42,32,21,0.08)'
                                : ink(score),
                            opacity: winner && s.id !== winner && !s.closed ? 0.4 : 1,
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <span className="self-center px-3 font-mono text-[11px] tracking-wider text-strip-ink/65">
                {agent.ready ? 'READY' : 'STILL SETTING UP'}
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
