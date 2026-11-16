import type { TowerModel } from './model'

/** Where the leading time stands: the least-happy person against the group average. */
export default function FairnessMeter({ model }: { model: TowerModel }) {
  const lead = model.shortlist[0]
  const decided = model.decision?.status === 'converged' ? model.decision : null
  const min = decided?.minScore ?? lead?.min_score ?? null
  const avg = decided?.avgScore ?? lead?.avg_score ?? null
  const slotId = decided?.slot?.id ?? lead?.slot_id
  const label = slotId ? model.slots.find((s) => s.id === slotId)?.label : null
  const unhappy = lead?.unhappy.map((id) => model.agents.find((a) => a.id === id)?.name.split(' ')[0]).filter(Boolean) ?? []

  return (
    <section aria-label="Fairness of the leading time" className="border border-board-line rounded-[2px] px-4 py-3 bg-board-raised/60">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] tracking-[0.18em] text-mist">FAIRNESS</h2>
        <span className="font-mono text-[11px] text-strip/80 truncate">
          {label ? `${decided ? 'Booked' : 'In the lead'}: ${label}` : 'Waiting for ratings'}
        </span>
      </div>
      <div className="relative h-7 mt-3" aria-hidden>
        <div className="absolute inset-x-0 top-3 h-px bg-board-line" />
        <div className="absolute top-1 bottom-1 w-px bg-mist/60" style={{ left: '50%' }} />
        <span className="absolute -bottom-3 font-mono text-[9px] text-mist -translate-x-1/2" style={{ left: '50%' }}>
          50 = OK
        </span>
        {min !== null && avg !== null && (
          <>
            <div
              className="absolute top-3 h-px bg-amber transition-[left,right] duration-700 ease-out"
              style={{ left: `${min}%`, right: `${100 - avg}%` }}
            />
            <div
              className="absolute top-0.5 h-5 w-[3px] bg-clearance transition-[left] duration-700 ease-out"
              style={{ left: `calc(${min}% - 1px)` }}
            />
            <div
              className="absolute top-1.5 h-3 w-3 rounded-full border-2 border-amber bg-board transition-[left] duration-700 ease-out"
              style={{ left: `calc(${avg}% - 6px)` }}
            />
          </>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 mt-5 font-mono">
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-signal">LEAST HAPPY</dt>
          <dd className="text-2xl font-semibold text-strip tabular-nums leading-tight">{min ?? '–'}{min !== null && <span className="text-[13px] font-normal opacity-60">/100</span>}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-[0.14em] text-amber">AVERAGE</dt>
          <dd className="text-2xl font-semibold text-strip tabular-nums leading-tight">{avg === null ? '–' : Math.round(avg)}{avg !== null && <span className="text-[13px] font-normal opacity-60">/100</span>}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[13px] text-mist">Scores are out of 100: how much each person likes the time.</p>
      {!decided && unhappy.length > 0 && (
        <p className="mt-2 text-xs text-strip/70">Unhappy with it: {unhappy.join(', ')}</p>
      )}
    </section>
  )
}
