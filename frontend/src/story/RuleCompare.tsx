import type { RuleId } from '../api/events'
import { RULE, USED_RULE } from '../lib/rules'
import { dayAndClock } from '../lib/timeLabels'
import type { TowerModel } from '../tower/model'

const first = (name: string) => name.trim().split(/\s+/)[0] || name

/** A chosen rule against the one that booked: what changes, who pays, and the rule's known flaw. */
export default function RuleCompare({ model, rule }: { model: TowerModel; rule: RuleId }) {
  const d = model.decision
  const rules = new Map((d?.rules ?? []).map((r) => [r.rule, r]))
  const mine = rules.get(rule)
  const used = rules.get(USED_RULE)
  if (!mine?.slot_id || !used?.slot_id) return null
  const info = RULE[rule]
  const label = (id: string) => dayAndClock(model.slots.find((s) => s.id === id)?.label ?? id)
  const same = mine.slot_id === used.slot_id
  const loser = mine.scores && used.scores
    ? Object.keys(mine.scores).reduce((a, b) => ((mine.scores![b] - used.scores![b]) < (mine.scores![a] - used.scores![a]) ? b : a))
    : null
  const drop = loser && mine.scores && used.scores ? used.scores[loser] - mine.scores[loser] : 0
  const name = (id: string) => first(model.agents.find((a) => a.id === id)?.name ?? 'someone')
  const metric = (title: string, a: number, b: number, unit = '', better: 'high' | 'low' = 'high') => {
    const diff = a - b
    const good = better === 'high' ? diff > 0 : diff < 0
    return (
      <div>
        <dt className="font-mono text-[10px] tracking-[0.14em] text-mist">{title}</dt>
        <dd className="mt-0.5 text-[20px] font-semibold text-strip tabular-nums leading-none">
          {a}{unit}
          {diff !== 0 && (
            <span className={`ml-1.5 text-[12px] font-normal ${good ? 'text-amber' : 'text-signal'}`}>
              {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10}
            </span>
          )}
        </dd>
      </div>
    )
  }

  return (
    <section aria-label={`What ${info.name} would do`} className="border-l-2 border-signal pl-4">
      <p className="font-mono text-[11px] tracking-[0.14em] text-signal">WHAT IF · {info.name.toUpperCase()}</p>
      <h3 className="mt-1 font-display font-bold text-[1.5rem] leading-tight text-strip">
        {same ? `Same time: ${label(mine.slot_id)}` : `${label(mine.slot_id)} instead of ${label(used.slot_id)}`}
      </h3>
      <p className="mt-1.5 text-[14px] leading-snug text-strip/80">{info.idea}</p>
      {!same && (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {metric('LEAST HAPPY', mine.min_score ?? 0, used.min_score ?? 0)}
          {metric('AVERAGE', Math.round(mine.avg_score ?? 0), Math.round(used.avg_score ?? 0))}
          {metric('PEOPLE FREE', mine.available ?? 0, used.available ?? 0)}
        </dl>
      )}
      <ul className="mt-3 space-y-1.5 text-[14px] leading-snug text-strip/90">
        {!same && loser && drop > 0 && <li>{name(loser)} pays most: {drop} points lower than under Nash.</li>}
        {mine.pareto_dominated_by && (
          <li className="text-signal">
            Wasteful: {label(mine.pareto_dominated_by)} is better for someone and worse for nobody.
          </li>
        )}
        <li className="text-strip/75">The catch: {info.catch}</li>
      </ul>
      <p className="mt-2 text-[12px] text-mist">{info.source}. Scores are on the same common scale for every rule.</p>
    </section>
  )
}
