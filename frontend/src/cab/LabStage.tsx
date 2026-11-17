import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildModel, emptyModel } from '../tower/model'
import type { RingMarker } from '../tower/scope/engine'
import {
  ATTACKS, LAB_RULE, LAB_RULES, getLabInstance, instanceEvents, stat, streamLab,
  type Attack, type LabInstance, type LabParams, type LabRow, type LabRule,
} from '../lib/lab'
import { dayAndClock } from '../lib/timeLabels'
import LineChart, { type Series } from '../story/lab/LineChart'
import BarChart from '../story/lab/BarChart'
import { useCab, useFixture, useScopeFeed } from './context'

const REPO = 'https://github.com/aperture71/MultiMeet/blob/main'
const DEFAULT: LabParams = { rules: ['old', 'nash', 'utilitarian', 'borda', 'when2meet'], n: 5, attack: 'none', count: 200 }
const pct = (v: number) => `${Math.round(v * 100)}%`
const signed = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`

function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void; disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-mist">{label.toUpperCase()}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`h-8 px-2.5 rounded-[2px] border text-[12.5px] transition-colors disabled:opacity-50 ${value === o.id
              ? 'border-amber bg-amber/10 text-strip' : 'border-board-line text-strip/75 hover:border-strip/50'}`}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The Lab: the preregistered evaluation run live. Pick rules, a group size and a liar; simulated
 * meetings with hidden true preferences stream in, every rule is scored against the truth, and
 * the charts settle as the evidence piles up. Any meeting opens on the radar.
 */
export default function LabStage() {
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { desktop } = useCab()
  const [params, setParams] = useState<LabParams>(DEFAULT)
  const [rows, setRows] = useState<LabRow[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<LabRule>('nash')
  const [picked, setPicked] = useState<number | null>(null) // a meeting the viewer chose; else follow the latest
  const [inst, setInst] = useState<LabInstance | null>(null)
  const abort = useRef<AbortController | null>(null)
  const ran = useRef<LabParams>(DEFAULT) // the settings the rows on screen came from

  const start = useCallback(async (p: LabParams) => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    ran.current = p
    setRows([])
    setPicked(null)
    setError(null)
    setRunning(true)
    const buf: LabRow[] = []
    let flush = 0
    try {
      await streamLab(p, (r) => {
        buf.push(r)
        // Batch updates so a fast stream doesn't re-render every row.
        if (!flush) flush = window.setTimeout(() => { flush = 0; setRows([...buf]) }, 120)
      }, ctl.signal)
    } catch (err) {
      if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : 'The Lab stopped.')
    } finally {
      window.clearTimeout(flush)
      setRows([...buf])
      if (abort.current === ctl) setRunning(false)
    }
  }, [])

  useEffect(() => {
    void start(DEFAULT)
    return () => abort.current?.abort()
  }, [start])

  // The meeting on the radar: the one the viewer chose, or the latest every couple of seconds.
  const latest = useRef<number | null>(null)
  latest.current = rows[rows.length - 1]?.idx ?? null
  const [follow, setFollow] = useState<number | null>(null)
  useEffect(() => {
    if (picked !== null) return
    const tick = () => setFollow(latest.current)
    tick()
    const id = window.setInterval(tick, 2200)
    return () => window.clearInterval(id)
  }, [picked, running])
  const showing = picked ?? follow
  useEffect(() => {
    if (showing === null) return
    let live = true
    getLabInstance(showing, ran.current).then((d) => live && setInst(d), () => {})
    return () => { live = false }
  }, [showing])

  const model = useMemo(() => (inst ? buildModel(instanceEvents(inst)) : emptyModel), [inst])
  const markers = useMemo<RingMarker[] | undefined>(() => {
    if (!inst) return undefined
    const bySlot = new Map<string, LabRule[]>()
    for (const [rule, r] of Object.entries(inst.results) as [LabRule, NonNullable<LabInstance['results'][LabRule]>][]) {
      const s = params.attack !== 'none' ? r.attack_pick : r.pick
      if (s) bySlot.set(s, [...(bySlot.get(s) ?? []), rule])
    }
    return [...bySlot.entries()].map(([slotId, ids]) => ({
      slotId, text: ids.map((id) => LAB_RULE[id].short).join(' · '), active: ids.includes(focus),
    }))
  }, [inst, focus, params.attack])
  useScopeFeed({
    model, markers,
    label: inst ? `Simulated meeting ${inst.idx + 1}: ${inst.n} people, ${inst.feasible} possible times.` : 'The Lab is starting.',
    legend: inst
      ? `Meeting #${inst.idx + 1}${picked === null && running ? ' (following the latest)' : ''}. Dots are simulated people, pulled toward the times they truly prefer; labels show where each rule books.`
      : undefined,
  })

  // ---- statistics ----
  const rules = ran.current.rules
  const attacked = ran.current.attack !== 'none'
  const series = (key: 'ratio' | 'min'): Series[] => rules.map((rule) => {
    const xs: number[] = []
    const pts: Series['points'] = []
    const every = Math.max(1, Math.ceil(rows.length / 160))
    rows.forEach((row, i) => {
      const r = row.results[rule]
      if (!r) return
      xs.push(r[key])
      if (i % every === 0 || i === rows.length - 1) {
        const s = stat(xs)
        pts.push({ x: i + 1, y: s.mean, lo: s.lo, hi: s.hi })
      }
    })
    return { id: rule, label: LAB_RULE[rule].name, color: LAB_RULE[rule].color, points: pts }
  })
  const finalStat = (f: (r: NonNullable<LabRow['results'][LabRule]>) => number) => (rule: LabRule) =>
    stat(rows.map((row) => row.results[rule]).filter(Boolean).map((r) => f(r!)))
  const gainStat = finalStat((r) => r.gain ?? 0)
  const oldGain = rules.includes('old') ? gainStat('old').mean : null

  const set = <K extends keyof LabParams>(k: K, v: LabParams[K]) => setParams((p) => ({ ...p, [k]: v }))
  const toggleRule = (id: LabRule) => setParams((p) => {
    const has = p.rules.includes(id)
    if (has && p.rules.length === 1) return p
    return { ...p, rules: LAB_RULES.map((r) => r.id).filter((r) => (r === id ? !has : p.rules.includes(r))) }
  })
  const dirty = JSON.stringify(params) !== JSON.stringify(ran.current)

  const charts = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-[2.2rem] leading-[0.95] tracking-tight text-strip">The Lab</h1>
        <p className="mt-2 text-[14.5px] leading-snug text-strip/80 max-w-[40rem]">
          Simulated meetings where we know everyone’s true preferences. Each rule picks a time from what people
          report, and we score that pick against the truth. The same seeded meetings the published results use.
        </p>
      </div>

      {/* Filters in one row above the charts. */}
      <section aria-label="Experiment settings" className="flex flex-col gap-4 border border-board-line rounded-[2px] p-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-mist">RULES TO RACE</span>
          <div className="flex flex-wrap gap-1">
            {LAB_RULES.map((r) => {
              const on = params.rules.includes(r.id)
              return (
                <button key={r.id} type="button" aria-pressed={on} onClick={() => toggleRule(r.id)} title={r.note}
                  className={`h-8 pl-2 pr-2.5 rounded-[2px] border text-[12.5px] inline-flex items-center gap-1.5 transition-colors ${on
                    ? 'border-strip/40 text-strip' : 'border-board-line text-strip/50 hover:text-strip/80'}`}>
                  <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: on ? r.color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${r.color}` }} />
                  {r.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Segmented label="People per meeting" value={params.n} onChange={(v) => set('n', v)}
            options={[{ id: 3, name: '3' }, { id: 5, name: '5' }, { id: 8, name: '8' }]} />
          <Segmented label="Meetings" value={params.count} onChange={(v) => set('count', v)}
            options={[{ id: 100, name: '100' }, { id: 200, name: '200' }, { id: 510, name: 'All 510' }]} />
        </div>
        <Segmented<Attack> label="Someone lies" value={params.attack} onChange={(v) => set('attack', v)}
          options={ATTACKS.map((a) => ({ id: a.id, name: a.name }))} />
        {params.attack !== 'none' && (
          <p className="-mt-2 text-[12.5px] text-mist">{ATTACKS.find((a) => a.id === params.attack)?.note}</p>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => (running && !dirty ? abort.current?.abort() : void start(params))}
            className="h-10 px-4 rounded-[2px] bg-clearance text-strip font-mono text-[12px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
            {running && !dirty ? 'STOP' : dirty ? 'RUN WITH THESE SETTINGS' : 'RUN AGAIN'}
          </button>
          <span className="text-[13px] text-mist tabular-nums" aria-live="polite">
            {rows.length} of {ran.current.count} meetings scored{running ? '…' : ''}
          </span>
        </div>
        {error && <p role="alert" className="text-sm text-signal">{error}</p>}
      </section>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Legend">
        {rules.map((r) => (
          <button key={r} type="button" onClick={() => setFocus(r)} aria-pressed={focus === r}
            className={`inline-flex items-center gap-1.5 text-[12.5px] ${focus === r ? 'text-strip font-semibold' : 'text-strip/70 hover:text-strip'}`}>
            <span aria-hidden className="w-3 h-[3px] rounded-full" style={{ background: LAB_RULE[r].color }} />
            {LAB_RULE[r].name}
          </button>
        ))}
        <span className="text-[12px] text-mist">· click one to highlight it and show its 95% band</span>
      </div>

      <LineChart title="How close to the best possible time"
        subtitle="Running average of each pick’s Nash welfare against the best time on true preferences (100% = the best)."
        series={series('ratio')} focus={focus} domain={[0.4, 1]} format={pct}
        threshold={{ y: 0.95, label: 'Target set before the run: 95%' }} />

      <LineChart title="The least happy person"
        subtitle="Running average of how much the worst-off person gains from the meeting, on their true preferences."
        series={series('min')} focus={focus} domain={[0, 0.8]} format={(v) => (v * 100).toFixed(0)} />

      {attacked && (
        <BarChart title="What lying won"
          subtitle="Average change in the liar’s true happiness from lying, in points out of 100. Below zero, lying backfired."
          bars={rules.map((r) => ({ id: r, label: LAB_RULE[r].name, color: LAB_RULE[r].color, stat: gainStat(r) }))}
          domain={[-0.3, 0.3]} format={signed}
          threshold={oldGain !== null && oldGain > 0 ? { v: oldGain / 2, label: 'half of what lying wins under the old rule (the target set before the run)' } : undefined} />
      )}

      <section aria-label="Every meeting">
        <h3 className="text-[15px] font-semibold text-strip leading-tight">Every meeting</h3>
        <p className="mt-0.5 text-[12.5px] text-mist">Bar height: how close {LAB_RULE[focus].name} got to the best time. Pick one to open it on the radar.</p>
        <div className="mt-2 flex items-end gap-px h-14 overflow-x-auto">
          {rows.map((row) => {
            const r = row.results[focus]
            const sel = row.idx === showing
            return (
              <button key={row.idx} type="button" onClick={() => setPicked(row.idx)}
                title={`Meeting #${row.idx + 1}: ${r ? pct(r.ratio) : '–'} of the best`}
                aria-label={`Open meeting ${row.idx + 1}`}
                className="shrink-0 w-[5px] h-full flex items-end">
                <span className="w-full rounded-t-[1px]" style={{
                  height: `${Math.max(4, (r?.ratio ?? 0) * 100)}%`,
                  background: sel ? 'var(--color-strip)' : LAB_RULE[focus].color,
                  opacity: sel ? 1 : 0.75,
                }} />
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Results table">
        <h3 className="text-[15px] font-semibold text-strip leading-tight">The numbers</h3>
        {attacked && <p className="mt-0.5 text-[12.5px] text-mist">Quality columns are with everyone honest; the last column is the same meetings with the liar.</p>}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12.5px] tabular-nums">
            <thead className="text-mist text-left">
              <tr>
                <th className="font-normal py-1 pr-2">Rule</th>
                <th className="font-normal py-1 px-2 text-right">vs best</th>
                <th className="font-normal py-1 px-2 text-right">least happy</th>
                <th className="font-normal py-1 px-2 text-right">Pareto-optimal</th>
                <th className="font-normal py-1 px-2 text-right">violations</th>
                {attacked && <th className="font-normal py-1 pl-2 text-right">lying won</th>}
              </tr>
            </thead>
            <tbody className="text-strip">
              {rules.map((r) => {
                const res = rows.map((row) => row.results[r]).filter(Boolean) as NonNullable<LabRow['results'][LabRule]>[]
                const n = res.length || 1
                return (
                  <tr key={r} className="border-t border-board-line">
                    <td className="py-1.5 pr-2 flex items-center gap-1.5">
                      <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: LAB_RULE[r].color }} />{LAB_RULE[r].name}
                    </td>
                    <td className="py-1.5 px-2 text-right">{res.length ? pct(stat(res.map((x) => x.ratio)).mean) : '–'}</td>
                    <td className="py-1.5 px-2 text-right">{res.length ? (stat(res.map((x) => x.min)).mean * 100).toFixed(0) : '–'}</td>
                    <td className="py-1.5 px-2 text-right">{res.length ? pct(res.filter((x) => x.pareto).length / n) : '–'}</td>
                    <td className="py-1.5 px-2 text-right">{res.filter((x) => x.violation).length}</td>
                    {attacked && <td className="py-1.5 pl-2 text-right">{res.length ? signed(gainStat(r).mean) : '–'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const label = (id: string | null | undefined) => (id ? dayAndClock(inst?.slots.find((s) => s.id === id)?.label ?? id) : 'no meeting')
  const side = (
    <div className="px-5 lg:px-6 py-5 flex flex-col gap-5">
      {inst && (
        <section aria-label="This meeting">
          <p className="font-mono text-[11px] tracking-[0.14em] text-amber">ON THE RADAR</p>
          <h2 className="mt-1 font-display font-bold text-[1.7rem] leading-none text-strip">Meeting #{inst.idx + 1}</h2>
          <p className="mt-1.5 text-[13.5px] text-strip/75">
            {inst.n} people · {inst.feasible} times everyone can make · calendars {Math.round(inst.density * 100)}% full
            {inst.multi_tz ? ' · several time zones' : ''}
          </p>
          <p className="mt-1 text-[13.5px] text-strip/75">Best possible time on the truth: <span className="text-strip">{label(inst.oracle)}</span></p>
          {picked !== null && (
            <button type="button" onClick={() => setPicked(null)} className="mt-2 font-mono text-[11px] tracking-[0.12em] text-amber hover:underline underline-offset-4">
              FOLLOW THE LATEST
            </button>
          )}
          <ul className="mt-3 flex flex-col divide-y divide-board-line border-y border-board-line">
            {(Object.entries(inst.results) as [LabRule, NonNullable<LabInstance['results'][LabRule]>][]).map(([rule, r]) => (
              <li key={rule}>
                <button type="button" onClick={() => setFocus(rule)} className={`w-full text-left py-2 flex items-start gap-2.5 ${focus === rule ? '' : 'opacity-80 hover:opacity-100'}`}>
                  <span aria-hidden className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: LAB_RULE[rule].color }} />
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2 text-[14px]">
                      <span className={focus === rule ? 'font-semibold text-strip' : 'text-strip'}>{LAB_RULE[rule].name}</span>
                      <span className="text-strip tabular-nums">{label(attacked ? r.attack_pick : r.pick)}</span>
                    </span>
                    <span className="block text-[12.5px] text-mist tabular-nums">
                      {pct(r.ratio)} of best · least happy {(r.min * 100).toFixed(0)}{r.pareto ? '' : ' · wasteful'}
                      {attacked && r.gain !== undefined && ` · liar ${signed(r.gain)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {attacked && (
            <p className="mt-2 text-[12.5px] text-mist">With a liar, the radar shows the honest preferences and each rule’s pick after the lie.</p>
          )}
        </section>
      )}

      <section aria-label="How to read the Lab" className="text-[13.5px] leading-relaxed text-strip/85 flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.14em] text-amber">HOW TO READ IT</p>
        <p><span className="text-strip font-semibold">Nash (ours)</span> should sit near the top of the first chart and stay above the dashed 95% line. That target was written down before any results.</p>
        <p>Try <span className="text-strip font-semibold">Fake “I can’t”</span>: lying still pays a little under every rule, ours included. It’s the one attack we haven’t closed.</p>
        <p>With honest people, Nash ties the old rule rather than beating it. The Lab will show you that too.</p>
        <p className="text-[12.5px] text-mist">
          The live intervals are a normal approximation; the published results use a paired bootstrap.{' '}
          <a href={`${REPO}/docs/eval/RESULTS.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Full results</a>
          {' · '}
          <a href={`${REPO}/docs/eval/preregistration.md`} target="_blank" rel="noreferrer" className="text-amber hover:underline underline-offset-4">Preregistration</a>
        </p>
      </section>
    </div>
  )

  return (
    <>
      {/* On a phone the experiment comes first, then the meeting on the radar. */}
      {bay && desktop && createPortal(charts, bay)}
      {panel && createPortal(desktop ? side : <>{charts}<div className="border-t border-board-line">{side}</div></>, panel)}
    </>
  )
}
