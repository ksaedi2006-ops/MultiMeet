import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LabRun } from '../cab/LabStage'
import { useCab, useFixture, useScopeFeed } from '../cab/context'
import { ATTACK_IDS, getLabInstance, instanceEvents, stat, type Attack, type LabInstance, type LabRow } from '../lib/lab'
import BarChart from '../story/lab/BarChart'
import LineChart, { type Series } from '../story/lab/LineChart'
import { buildModel, emptyModel } from '../tower/model'
import type { RingMarker } from '../tower/scope/engine'
import { GLOSSARY, type TermId } from './glossary'
import { Segmented } from './OneMeeting'
import Term from './Term'
import { SERIES, THEORIES, type RuleId } from './theories'

const MAX = SERIES.length
const pct = (v: number) => `${Math.round(v * 100)}%`
const pts = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`

interface Props {
  n: 3 | 5 | 8
  attack: Attack
  setN: (n: 3 | 5 | 8) => void
  setAttack: (a: Attack) => void
  rules: RuleId[]
  setRules: (r: RuleId[]) => void
  run: LabRun
  onBack: () => void
  onNext: () => void
}

/** Colour follows the rule: a rule keeps its slot while it stays selected; a new one takes the first free slot. */
function useSlots(rules: RuleId[]) {
  const map = useRef(new Map<RuleId, number>())
  for (const r of [...map.current.keys()]) if (!rules.includes(r)) map.current.delete(r)
  for (const r of rules) {
    if (map.current.has(r)) continue
    const used = new Set(map.current.values())
    map.current.set(r, [...Array(MAX).keys()].find((i) => !used.has(i)) ?? 0)
  }
  return (r: RuleId) => SERIES[map.current.get(r) ?? 0]
}

/** Is this one meeting typical? The same rules on hundreds of seeded meetings, live. */
export default function ManyMeetings({ n, attack, setN, setAttack, rules, setRules, run, onBack, onNext }: Props) {
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { desktop } = useCab()
  const [focus, setFocus] = useState<RuleId>('nash')
  const [count, setCount] = useState(200)
  const { rows, running, params } = run
  const color = useSlots(params.rules)
  const attacked = params.attack !== 'none'
  const settings = { rules, n, attack, count }
  const dirty = JSON.stringify(settings) !== JSON.stringify(params) || (!rows.length && !running)

  // Start a run the first time the tab opens.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || rows.length || running) return
    started.current = true
    run.start(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The radar follows the latest meeting.
  const latest = useRef<number | null>(null)
  latest.current = rows[rows.length - 1]?.idx ?? null
  const [showing, setShowing] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setShowing(latest.current)
    tick()
    const id = window.setInterval(tick, 2200)
    return () => window.clearInterval(id)
  }, [running])
  const [inst, setInst] = useState<LabInstance | null>(null)
  useEffect(() => {
    if (showing === null) return
    let live = true
    getLabInstance(showing, params).then((d) => live && setInst(d), () => {})
    return () => { live = false }
  }, [showing, params])
  const model = useMemo(() => (inst ? buildModel(instanceEvents(inst)) : emptyModel), [inst])
  const markers = useMemo<RingMarker[] | undefined>(() => {
    if (!inst) return undefined
    const bySlot = new Map<string, RuleId[]>()
    for (const [rule, r] of Object.entries(inst.results) as [RuleId, NonNullable<LabInstance['results'][RuleId]>][]) {
      const s = attacked ? r.attack_pick : r.pick
      if (s) bySlot.set(s, [...(bySlot.get(s) ?? []), rule])
    }
    return [...bySlot.entries()].map(([slotId, ids]) => ({
      slotId, text: ids.map((id) => GLOSSARY[id].term.split(/[ (,]/)[0].toUpperCase()).join(' · '), active: ids.includes(focus),
    }))
  }, [inst, focus, attacked])
  useScopeFeed({
    model, markers,
    label: inst ? `Simulated meeting ${inst.idx + 1}` : 'Running meetings.',
    legend: inst ? `Meeting #${inst.idx + 1}${running ? ' (following the latest)' : ''}. Labels: where each selected rule books.` : undefined,
  })

  const series = (key: 'ratio' | 'min'): Series[] => params.rules.map((rule) => {
    const xs: number[] = []
    const out: Series['points'] = []
    const every = Math.max(1, Math.ceil(rows.length / 160))
    rows.forEach((row, i) => {
      const r = row.results[rule]
      if (!r) return
      xs.push(r[key])
      if (i % every === 0 || i === rows.length - 1) {
        const s = stat(xs)
        out.push({ x: i + 1, y: s.mean, lo: s.lo, hi: s.hi })
      }
    })
    return { id: rule, label: GLOSSARY[rule].term, color: color(rule), points: out }
  })
  const final = (f: (r: NonNullable<LabRow['results'][RuleId]>) => number) => (rule: RuleId) =>
    stat(rows.map((row) => row.results[rule]).filter(Boolean).map((r) => f(r!)))

  const toggle = (id: RuleId) => {
    const has = rules.includes(id)
    if (has && rules.length === 1) return
    if (!has && rules.length >= MAX) return
    setRules(has ? rules.filter((r) => r !== id) : [...rules, id])
  }

  const left = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-6">
      <div>
        <button type="button" onClick={onBack} className="font-mono text-[11px] tracking-[0.12em] text-mist hover:text-amber">← ONE MEETING</button>
        <h2 className="mt-2 font-display font-bold text-[1.8rem] leading-none text-strip">Is one meeting typical?</h2>
        <p className="mt-1.5 text-[13.5px] text-strip/75">
          The same rules on {params.count} seeded meetings, scored against the truth as they arrive.
        </p>
      </div>
      <section aria-label="Run settings" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-mist">RULES · UP TO {MAX}</span>
          <div className="flex flex-wrap gap-1">
            {THEORIES.map((t) => {
              const on = rules.includes(t.id)
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)} disabled={!on && rules.length >= MAX}
                  className={`h-8 px-2.5 rounded-[2px] border text-[12.5px] transition-colors disabled:opacity-40 ${on
                    ? 'border-amber bg-amber/10 text-strip' : 'border-board-line text-strip/65 hover:text-strip'}`}>
                  <Term id={t.id} passive />
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Segmented label={<Term id="n" />} value={n} onChange={setN} options={[3, 5, 8].map((v) => ({ id: v as 3 | 5 | 8, node: String(v) }))} />
          <Segmented label="MEETINGS" value={count} onChange={setCount} options={[100, 200, 510].map((v) => ({ id: v, node: String(v) }))} />
          <Segmented label="MANIPULATION" value={attack} onChange={setAttack} options={ATTACK_IDS.map((a) => ({ id: a, node: <Term id={a} passive /> }))} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => (running && !dirty ? run.stop() : run.start(settings))}
            className="h-10 px-4 rounded-[2px] bg-clearance text-strip font-mono text-[12px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
            {running && !dirty ? 'STOP' : 'RUN'}
          </button>
          <span className="text-[13px] text-mist tabular-nums" aria-live="polite">{rows.length} / {params.count} meetings{running ? '…' : ''}</span>
        </div>
        {run.error && <p role="alert" className="text-sm text-signal">{run.error}</p>}
      </section>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Legend">
        {params.rules.map((r) => (
          <button key={r} type="button" onClick={() => setFocus(r)} aria-pressed={focus === r}
            className={`inline-flex items-center gap-1.5 text-[12.5px] ${focus === r ? 'text-strip font-semibold' : 'text-strip/70 hover:text-strip'}`}>
            <span aria-hidden className="w-3 h-[3px] rounded-full" style={{ background: color(r) }} />{GLOSSARY[r].term}
          </button>
        ))}
      </div>

      <LineChart title={<Term id="oracle_ratio" />} subtitle="Running mean, 95% band on the highlighted rule."
        series={series('ratio')} focus={focus} domain={[0.4, 1]} format={pct}
        threshold={{ y: 0.95, label: 'Preregistered target (Q1): 95%' }} />
      <LineChart title={<Term id="min_utility" />} subtitle="Running mean of the worst-off person’s gain, ×100."
        series={series('min')} focus={focus} domain={[0, 0.8]} format={(v) => (v * 100).toFixed(0)} />
      <BarChart title={<Term id="pareto" />} subtitle="Share of meetings whose pick is Pareto optimal on true preferences."
        bars={params.rules.map((r) => ({ id: r, label: GLOSSARY[r].term, color: color(r), stat: final((x) => (x.pareto ? 1 : 0))(r) }))}
        domain={[0, 1]} format={pct} />
      {attacked && (
        <BarChart title={<Term id="manip_gain" />} subtitle={<>Mean change in the liar’s true utility, ×100, under <Term id={params.attack as TermId} />. Below zero, the lie backfired.</>}
          bars={params.rules.map((r) => ({ id: r, label: GLOSSARY[r].term, color: color(r), stat: final((x) => x.gain ?? 0)(r) }))}
          domain={[-0.3, 0.3]} format={pts} />
      )}
      <button type="button" onClick={onNext}
        className="self-start font-mono text-[12px] tracking-[0.12em] text-amber hover:underline underline-offset-4">
        FULL TABLE AND FORMULAS · UNDER THE HOOD →
      </button>
    </div>
  )

  const best = (f: (r: NonNullable<LabRow['results'][RuleId]>) => number) => {
    if (!rows.length) return null
    return [...params.rules].sort((a, b) => final(f)(b).mean - final(f)(a).mean)[0]
  }
  const leaders: [TermId, RuleId | null][] = [
    ['oracle_ratio', best((x) => x.ratio)],
    ['util_ratio', best((x) => x.util_ratio)],
    ['min_ratio', best((x) => x.min_ratio)],
  ]
  // A lie that backfires is no better than one that gains nothing: zero or below passes.
  const resisted = attacked && rows.length ? params.rules.filter((r) => final((x) => x.gain ?? 0)(r).mean <= 1e-9) : []
  const nashTrails = rows.length > 20 && params.rules.includes('nash') && leaders[0][1] !== 'nash'
  const right = (
    <div className="px-5 lg:px-6 py-5 flex flex-col gap-4">
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">LEADS ON EACH METRIC</p>
      <dl className="flex flex-col divide-y divide-board-line border-y border-board-line">
        {leaders.map(([m, r]) => (
          <div key={m} className="flex justify-between gap-3 py-2 text-[13.5px]">
            <dt className="text-strip/80"><Term id={m} /></dt>
            <dd className="text-strip font-semibold">{r ? <Term id={r} /> : '–'}</dd>
          </div>
        ))}
      </dl>
      {rows.length > 20 && new Set(leaders.map(([, r]) => r)).size > 1 && (
        <p className="text-[13px] text-strip/80">No rule leads on every welfare criterion in this run.</p>
      )}
      {attacked && rows.length > 0 && (
        <div className="text-[13px] text-strip/85">
          <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber"><Term id="manip_gain">MANIPULATION GAIN</Term> ≤ 0</p>
          <p className="mt-1">{resisted.length ? resisted.map((r, i) => <span key={r}>{i ? ', ' : ''}<Term id={r} /></span>) : 'None of the selected rules'}</p>
          <p className="mt-1 text-[12px] text-mist">Scripted attacker <Term id={params.attack as TermId} />; not a best-response search.</p>
        </div>
      )}
      {nashTrails && (
        <div className="border-l-2 border-amber pl-3 text-[13px] leading-snug text-strip/85">
          <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">WHY <Term id="nash">NASH</Term> TRAILS HERE</p>
          <p className="mt-1">
            MultiMeet runs Nash on top-k normalized reports, chosen for manipulation resistance (Amendment 3). Ranking
            throws away some intensity, which costs Nash welfare: 0.962 of the oracle pooled. With range normalization
            the same rule reached 0.988, but a colluding pair then gained +0.119 (Amendment 2); under top-k a pair
            loses 0.117 (Amendment 3). The gap is that trade-off.
          </p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {bay && desktop && createPortal(left, bay)}
      {panel && createPortal(desktop ? right : <>{left}<div className="border-t border-board-line">{right}</div></>, panel)}
    </>
  )
}
