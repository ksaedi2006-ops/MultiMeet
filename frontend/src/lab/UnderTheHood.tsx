import { createPortal } from 'react-dom'
import type { LabRun } from '../cab/LabStage'
import { useCab, useFixture, useScopeFeed } from '../cab/context'
import { stat, type LabRow } from '../lib/lab'
import { emptyModel } from '../tower/model'
import { GLOSSARY, type TermId } from './glossary'
import Term from './Term'
import { FAMILIES, THEORIES, type RuleId } from './theories'

const REPO = 'https://github.com/aperture71/MultiMeet/blob/main'
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/** The full tables, every formula and the published documents, for anyone checking the work. */
export default function UnderTheHood({ run, onOpen }: { run: LabRun; onOpen: (idx: number) => void }) {
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { desktop } = useCab()
  const { rows, params } = run
  const attacked = params.attack !== 'none'
  useScopeFeed({ model: emptyModel, label: 'Under the hood: tables and formulas.' })

  const cols: [TermId, (r: NonNullable<LabRow['results'][RuleId]>[]) => string][] = [
    ['oracle_ratio', (r) => pct(stat(r.map((x) => x.ratio)).mean)],
    ['min_utility', (r) => (stat(r.map((x) => x.min)).mean * 100).toFixed(1)],
    ['mean_utility', (r) => (stat(r.map((x) => x.util)).mean * 100).toFixed(1)],
    ['pareto', (r) => pct(r.filter((x) => x.pareto).length / (r.length || 1))],
    ...(attacked ? [['manip_gain', (r: NonNullable<LabRow['results'][RuleId]>[]) => {
      const s = stat(r.map((x) => x.gain ?? 0))
      return `${(s.mean * 100).toFixed(1)} [${(s.lo * 100).toFixed(1)}, ${(s.hi * 100).toFixed(1)}]`
    }] as [TermId, (r: NonNullable<LabRow['results'][RuleId]>[]) => string]] : []),
  ]

  const left = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-6">
      <section aria-label="Results of the last run">
        <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">
          LAST RUN · <Term id="n" /> = {params.n} · <Term id={params.attack as TermId} /> · {rows.length} MEETINGS
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-strip/75">Run some meetings under Many meetings first.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead className="text-mist text-left">
                <tr>
                  <th className="font-normal py-1 pr-2">Rule</th>
                  {cols.map(([t]) => <th key={t} className="font-normal py-1 px-2 text-right"><Term id={t} /></th>)}
                  <th className="font-normal py-1 pl-2 text-right">violations</th>
                </tr>
              </thead>
              <tbody className="text-strip">
                {params.rules.map((rule) => {
                  const res = rows.map((row) => row.results[rule]).filter(Boolean) as NonNullable<LabRow['results'][RuleId]>[]
                  return (
                    <tr key={rule} className="border-t border-board-line">
                      <td className="py-1.5 pr-2"><Term id={rule} /></td>
                      {cols.map(([t, f]) => <td key={t} className="py-1.5 px-2 text-right">{res.length ? f(res) : '–'}</td>)}
                      <td className="py-1.5 pl-2 text-right">{res.filter((x) => x.violation).length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-mist">
              Intervals are a normal approximation; the published results use a paired bootstrap. Utility columns are with
              everyone truthful; <Term id="manip_gain" /> compares the same meetings with the liar.
            </p>
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section aria-label="Every meeting">
          <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">EVERY MEETING · <Term id="oracle_ratio" /> OF {GLOSSARY[params.rules[0]].term.toUpperCase()}</h2>
          <div className="mt-2 flex items-end gap-px h-14 overflow-x-auto">
            {rows.map((row) => {
              const r = row.results[params.rules[0]]
              return (
                <button key={row.idx} type="button" onClick={() => onOpen(row.idx)}
                  title={`Meeting #${row.idx + 1}: ${r ? Math.round(r.ratio * 100) : '–'}% · open in One meeting`}
                  aria-label={`Open meeting ${row.idx + 1}`} className="shrink-0 w-[5px] h-full flex items-end">
                  <span className="w-full rounded-t-[1px] bg-amber/80 hover:bg-strip" style={{ height: `${Math.max(4, (r?.ratio ?? 0) * 100)}%` }} />
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section aria-label="Formulas">
        <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">EVERY RULE</h2>
        <dl className="mt-2 flex flex-col divide-y divide-board-line border-y border-board-line">
          {FAMILIES.flatMap((fam) => THEORIES.filter((t) => t.family === fam)).map((t) => {
            const e = GLOSSARY[t.id]
            return (
              <div key={t.id} className="py-2.5">
                <dt className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-strip">{e.term}</span>
                  <span className="text-[11.5px] text-mist">{t.family}</span>
                </dt>
                <dd className="mt-1 text-[13px] leading-snug text-strip/85">{e.what}</dd>
                {'formula' in e && e.formula && <dd className="mt-1 font-mono text-[12px] text-amber">{e.formula}</dd>}
                <dd className="mt-1 text-[11.5px] text-mist">{e.source}</dd>
              </div>
            )
          })}
        </dl>
      </section>
    </div>
  )

  const right = (
    <div className="px-5 lg:px-6 py-5 flex flex-col gap-4 text-[13.5px] leading-relaxed text-strip/85">
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">METHOD</p>
      <p>
        Meetings come from the same seeded generator as the published evaluation: 510 per group size, calendars 30–70%
        full, some across time zones. Each person has hidden true preferences; every rule sees only what their agent
        reports, and every pick is scored against the truth.
      </p>
      <p>
        The preregistered comparison covers <Term id="nash" />, <Term id="old" />, <Term id="utilitarian" />,{' '}
        <Term id="borda" />, <Term id="when2meet" /> and <Term id="random" />. The other rules were added for the Lab
        afterwards and aren’t part of those thresholds.
      </p>
      <p>
        Two baselines from the plan weren’t run: a single language model choosing the time (B2) and agents negotiating
        freely with no solver (B6). Both need live AI.
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <a href={`${REPO}/docs/eval/RESULTS.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Results</a>
        <a href={`${REPO}/docs/eval/preregistration.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Preregistration</a>
        <a href={`${REPO}/docs/research/negotiation-layer.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Research report</a>
        <a href={`${REPO}/backend/app/scheduling/selector.py`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Rule code</a>
      </p>
    </div>
  )

  return (
    <>
      {bay && desktop && createPortal(left, bay)}
      {panel && createPortal(desktop ? right : <>{left}<div className="border-t border-board-line">{right}</div></>, panel)}
    </>
  )
}
