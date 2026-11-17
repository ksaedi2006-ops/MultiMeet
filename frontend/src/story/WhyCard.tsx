import { useMemo } from 'react'
import { mostPopular, rankTimes } from '../lib/fairness'
import { dayAndClock, plainTimes } from '../lib/timeLabels'
import type { TowerModel } from '../tower/model'

const first = (name: string) => name.trim().split(/\s+/)[0] || name

/**
 * The research idea in three lines: why the booked time beat the time a simple vote would pick,
 * and the solver's own reason for passing over the runner-up.
 */
export default function WhyCard({ model }: { model: TowerModel }) {
  const d = model.decision
  const times = useMemo(() => rankTimes(model), [model])
  if (!d || d.status !== 'converged' || !d.slot) return null
  const pick = d.slot
  const name = (id: string | null | undefined) => first(model.agents.find((a) => a.id === id)?.name ?? 'someone')
  const pickLow = d.minScore ?? 0
  const popular = mostPopular(times)
  const label = (id: string) => dayAndClock(model.slots.find((s) => s.id === id)?.label ?? id)
  const b = d.binding
  const runnerUp = b?.runner_up && b.decisive && b.runner_up !== popular?.slot.id ? b : null

  return (
    <section aria-label="Why this time" className="border-l-2 border-amber pl-4">
      {popular && popular.slot.id !== pick.id && popular.min < pickLow ? (
        <>
          <h3 className="font-display font-bold text-[1.5rem] leading-tight text-strip">
            Why {dayAndClock(pick.label)}, not {dayAndClock(popular.slot.label)}?
          </h3>
          <ul className="mt-2 space-y-1.5 text-[15px] leading-snug text-strip/90">
            <li>
              {dayAndClock(popular.slot.label)} has the higher average ({Math.round(popular.avg)} vs {Math.round(d.avgScore ?? 0)}),
              but {name(popular.lowest)} would rate it {popular.min}/100.
            </li>
            <li>{dayAndClock(pick.label)} leaves nobody below {pickLow}/100.</li>
          </ul>
        </>
      ) : (
        <>
          <h3 className="font-display font-bold text-[1.5rem] leading-tight text-strip">Why {dayAndClock(pick.label)}?</h3>
          <p className="mt-2 text-[15px] leading-snug text-strip/90">
            It’s also the most popular time, and it leaves nobody below {pickLow}/100. Fair and popular agreed.
          </p>
        </>
      )}
      {runnerUp && (
        <p className="mt-2 text-[14px] leading-snug text-strip/75">
          Next best was {label(runnerUp.runner_up!)}, but it would have cost {name(runnerUp.decisive)} the most
          {runnerUp.decisive_label ? ` (${plainTimes(runnerUp.decisive_label.replace(/^Rule: ?/i, ''))})` : ''}.
        </p>
      )}
      <p className="mt-3 text-[13px] text-mist">
        The rule: pick the time where nobody is left far behind, not the one with the most votes.
      </p>
    </section>
  )
}
