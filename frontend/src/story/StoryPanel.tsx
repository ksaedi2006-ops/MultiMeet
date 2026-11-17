import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '../lib/motion'
import { favourites, rankTimes, type TimeStanding } from '../lib/fairness'
import { blockerPhrase, dayAndClock, fullTime, plainTimes } from '../lib/timeLabels'
import StripBoard from '../tower/StripBoard'
import type { Agent, TowerModel } from '../tower/model'
import Face, { MoodKey } from './Face'

interface Props {
  model: TowerModel
  viewerId: string | null
  highlight: string | null
  onHover: (id: string | null) => void
  /** A decision rule other than the one that booked, whose pick the outcome is showing. */
  whatIf?: string | null
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-display font-bold text-[1.7rem] leading-none text-strip">{title}</h2>
      <p className="mt-2 text-[15px] leading-snug text-strip/80 max-w-[34rem]">{sub}</p>
    </div>
  )
}

/** Before the start: who is in. */
function WhoIsIn({ model, viewerId }: { model: TowerModel; viewerId: string | null }) {
  const ready = model.agents.filter((a) => a.ready).length
  return (
    <>
      <Heading title="Who’s in" sub={`${model.agents.length} people, ${ready} ready. Each one gets an agent that negotiates for them.`} />
      <ul className="mt-5 flex flex-col gap-2.5">
        {model.agents.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <Face avatar={a.avatar} size={30} />
            <span className="flex-1 min-w-0 truncate text-[15px] text-strip">
              {a.name}{a.id === viewerId && <span className="text-mist"> (you)</span>}
            </span>
            <span className={`text-[13px] ${a.ready ? 'text-amber' : 'text-mist'}`}>{a.ready ? 'Ready' : 'Setting up'}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Step 1: calendars cross times out. */
function RulingOut({ model }: { model: TowerModel }) {
  const open = model.slots.filter((s) => !s.closed).length
  const causes = useMemo(() => {
    const byCause = new Map<string, { who: string; text: string; count: number }>()
    for (const s of model.slots) {
      for (const b of s.blockers) {
        const text = blockerPhrase(b.name, b.reason)
        const c = byCause.get(text) ?? { who: b.user_id, text, count: 0 }
        c.count++
        byCause.set(text, c)
      }
    }
    return [...byCause.values()].sort((a, b) => b.count - a.count).slice(0, 6)
  }, [model.slots])
  const avatarOf = (id: string) => model.agents.find((a) => a.id === id)?.avatar ?? 0
  const scored = Object.keys(model.scores).length
  return (
    <>
      <Heading title="Step 1 · Rule out times"
        sub="Times anyone can’t make are crossed out first. No negotiating over those." />
      <p className="mt-5 font-display font-bold text-strip leading-none">
        <span className="text-[3.4rem] text-amber tabular-nums">{open}</span>
        <span className="text-[1.6rem] text-strip/70"> of {model.slots.length} times still possible</span>
      </p>
      {causes.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2.5">
          {causes.map((c) => (
            <li key={c.text} className="flex items-center gap-3">
              <Face avatar={avatarOf(c.who)} size={26} />
              <span className="flex-1 min-w-0 text-[15px] text-strip leading-snug">{c.text}</span>
              <span className="text-[13px] text-mist tabular-nums whitespace-nowrap">rules out {c.count}</span>
            </li>
          ))}
        </ul>
      )}
      {model.phase === 'scoring' && (
        <p className="mt-5 text-[14px] text-mist" aria-live="polite">
          Agents rating the {open} times left: {scored} of {model.agents.length} done…
        </p>
      )}
    </>
  )
}

/** Step 2: the best times so far, each with everyone's face. */
function Leaderboard({ model, times, onHover }: { model: TowerModel; times: TimeStanding[]; onHover: Props['onHover'] }) {
  const byId = new Map(model.agents.map((a) => [a.id, a]))
  const asking = [...model.asks].reverse().find((a) => !a.reply)
  return (
    <>
      <Heading title="Step 2 · Find the fairest time"
        sub="A time only ranks high if nobody is left far behind. One person who hates it costs more than one who loves it earns." />
      <MoodKey className="mt-3" />
      <ol className="mt-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {times.slice(0, 5).map((t, i) => {
            const people = Object.entries(t.scores).sort((a, b) => a[1] - b[1])
            const low = t.lowest ? byId.get(t.lowest) : undefined
            const asked = asking?.slotId === t.slot.id ? byId.get(asking.toId) : undefined
            return (
              <motion.li key={t.slot.id} layout="position" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}
                className={`rounded-[2px] border px-3.5 py-3 ${i === 0 ? 'border-amber bg-amber/[0.07]' : 'border-board-line'}`}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[13px] text-mist tabular-nums w-4">{i + 1}</span>
                  <span className="font-display font-bold text-[1.35rem] leading-none text-strip">{fullTime(t.slot.label)}</span>
                  {i === 0 && <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-amber">LEADING</span>}
                </div>
                <div className="mt-2.5 pl-7 flex flex-wrap gap-x-1.5 gap-y-2">
                  {people.map(([uid, score]) => {
                    const a = byId.get(uid)
                    return a ? (
                      <span key={uid} onPointerEnter={() => onHover(uid)} onPointerLeave={() => onHover(null)}>
                        <Face avatar={a.avatar} score={score} size={24} title={`${a.name}: ${score}/100`} />
                      </span>
                    ) : null
                  })}
                </div>
                <p className="mt-2 pl-7 text-[13px] text-strip/75">
                  {low && <>Least happy: {first(low.name)} at {t.min}/100 · </>}Average {Math.round(t.avg)}/100
                </p>
                {asked && (
                  <p className="mt-1.5 pl-7 text-[13px] text-signal">The mediator is asking {first(asked.name)} to flex for this time.</p>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </>
  )
}

/** Step 3: the booking, person by person, least happy first. */
function Outcome({ model, viewerId, whatIf }: { model: TowerModel; viewerId: string | null; whatIf?: string | null }) {
  const d = model.decision!
  const fav = favourites(model)
  if (d.status !== 'converged' || !d.slot) {
    return (
      <Heading title="No time works"
        sub={d.question ?? 'Every possible time leaves someone with a conflict they can’t move. Nothing was booked.'} />
    )
  }
  const pick = d.slot
  const gave = new Map(d.compromises.map((c) => [c.user_id, c.gave_up]))
  const rows = model.agents
    .map((a) => ({ a, score: d.scores[a.id] ?? 0 }))
    .sort((x, y) => Number(gave.has(y.a.id)) - Number(gave.has(x.a.id)) || x.score - y.score)
  const line = (a: Agent) => {
    const g = gave.get(a.id)
    if (g) return { text: `Gave up: ${plainTimes(g)}`, tone: 'text-signal' }
    const f = fav.get(a.id)
    if (!f || f.id === pick.id) return { text: 'Their favourite time', tone: 'text-amber' }
    return { text: `Would have liked ${dayAndClock(f.label)} best`, tone: 'text-strip/70' }
  }
  return (
    <>
      {whatIf ? (
        <Heading title={`What if · ${whatIf}`} sub="The time this rule would book, and how it lands for each person. The real booking is unchanged." />
      ) : (
        <Heading title="Step 3 · Booked" sub="How the chosen time lands for each person, starting with anyone who gave something up." />
      )}
      <p className={`mt-4 font-display font-bold text-[2.2rem] leading-none ${whatIf ? 'text-signal' : 'text-amber'}`}>{fullTime(pick.label)}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {rows.map(({ a, score }) => {
          const l = line(a)
          return (
            <li key={a.id} className="flex items-center gap-3">
              <Face avatar={a.avatar} score={score} size={30} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-strip truncate">
                  {a.name}{a.id === viewerId && <span className="text-mist"> (you)</span>}
                </p>
                <p className={`text-[13px] ${l.tone} truncate`}>{l.text}</p>
              </div>
              <div className="w-24 shrink-0" title={`${score}/100`}>
                <div className="h-1.5 rounded-full bg-board-line overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${score}%`, background: score < 40 ? 'var(--color-clearance)' : 'var(--color-amber)' }} />
                </div>
                <p className="mt-1 text-right font-mono text-[12px] text-mist tabular-nums">{score}/100</p>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/**
 * The left panel follows the negotiation: who is in, what got ruled out, the race between the
 * best times, then the booking. Every score is still one tap away.
 */
export default function StoryPanel({ model, viewerId, highlight, onHover, whatIf }: Props) {
  const [evidence, setEvidence] = useState(false)
  const times = useMemo(() => rankTimes(model), [model])
  const view = model.decision ? 'outcome'
    : model.phase === 'holding' ? 'who'
      : times.length && model.phase !== 'filtering' && Object.keys(model.scores).length === model.agents.length ? 'race'
        : 'ruling'

  return (
    <div className="px-4 lg:px-5 py-5 flex flex-col">
      {/* Keyed so each step fades in; no exit animation, which can stall when steps change fast (skip, scrub). */}
      <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}>
          {view === 'who' && <WhoIsIn model={model} viewerId={viewerId} />}
          {view === 'ruling' && <RulingOut model={model} />}
          {view === 'race' && <Leaderboard model={model} times={times} onHover={onHover} />}
          {view === 'outcome' && <Outcome model={model} viewerId={viewerId} whatIf={whatIf} />}
      </motion.div>

      {Object.keys(model.scores).length > 0 && (
        <div className="mt-6 border-t border-board-line pt-4">
          <button type="button" onClick={() => setEvidence((v) => !v)} aria-expanded={evidence}
            className="font-mono text-[12px] tracking-[0.12em] text-amber hover:underline underline-offset-4">
            {evidence ? 'HIDE EVERY SCORE' : 'SEE EVERY SCORE'}
          </button>
          {evidence && (
            <div className="mt-3">
              <p className="mb-3 text-[13px] text-mist leading-snug">
                One row per person, one bar per possible time. Darker means they like it more. Thin lines are
                times someone can’t make; the orange outline is the booked time.
              </p>
              <StripBoard model={model} viewerId={viewerId} highlight={highlight} onHover={onHover} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
