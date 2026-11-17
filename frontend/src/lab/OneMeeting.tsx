import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useCab, useFixture, useScopeFeed } from '../cab/context'
import { avatarsFor } from '../lib/avatars'
import { EASE } from '../lib/motion'
import { ATTACK_IDS, getLabMeeting, instanceEvents, type Attack, type LabMeeting, type LabResult } from '../lib/lab'
import { dayAndClock } from '../lib/timeLabels'
import Face from '../story/Face'
import { buildModel, emptyModel } from '../tower/model'
import type { RingMarker } from '../tower/scope/engine'
import { GLOSSARY } from './glossary'
import Term from './Term'
import { FAMILIES, THEORIES, type RuleId } from './theories'

interface Props {
  n: 3 | 5 | 8
  attack: Attack
  idx: number
  setN: (n: 3 | 5 | 8) => void
  setAttack: (a: Attack) => void
  setIdx: (i: number) => void
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name
const fmtGain = (g: number) => `${g > 0 ? '+' : ''}${Math.round(g * 100)}`

export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: React.ReactNode; value: T; options: { id: T; node: React.ReactNode }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-mist">{label}</span>
      <div role="radiogroup" className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-8 px-2.5 inline-flex items-center rounded-[2px] border text-[12.5px] transition-colors ${value === o.id
              ? 'border-amber bg-amber/10 text-strip' : 'border-board-line text-strip/75 hover:border-strip/50'}`}>
            {o.node}
          </button>
        ))}
      </div>
    </div>
  )
}

/** One simulated meeting, every rule: the playground's first view. */
export default function OneMeeting({ n, attack, idx, setN, setAttack, setIdx }: Props) {
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { desktop, highlight, setHighlight } = useCab()
  const [data, setData] = useState<LabMeeting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rule, setRule] = useState<RuleId>('nash')

  useEffect(() => {
    let live = true
    setError(null)
    getLabMeeting(idx, n, attack).then((d) => live && setData(d), (e) => {
      if (!live) return
      // The generator drops a few seeds; step to the next one.
      if (String(e.message).includes('dropped')) setIdx(idx + 1)
      else setError(e.message)
    })
    return () => { live = false }
  }, [idx, n, attack, setIdx])

  const faces = useMemo(() => avatarsFor(data?.people.map((p) => p.user_id) ?? []), [data])
  const model = useMemo(() => {
    if (!data) return emptyModel
    const m = buildModel(instanceEvents(data))
    return { ...m, agents: m.agents.map((a) => ({ ...a, avatar: faces.get(a.id) ?? a.avatar })) }
  }, [data, faces])

  const res = (r: RuleId) => data?.results[r]
  const pickOf = (r: LabResult | undefined) => (attack !== 'none' ? r?.attack_pick : r?.pick) ?? null
  const label = (id: string | null | undefined) => (id ? dayAndClock(data?.slots.find((s) => s.id === id)?.label ?? id) : 'No meeting')
  const at = (slot: string | null) => (data && slot ? data.people.map((p) => ({ p, u: p.scores[slot] ?? 0 })) : [])
  const stats = (slot: string | null) => {
    const xs = at(slot)
    if (!xs.length) return null
    const low = xs.reduce((a, b) => (b.u < a.u ? b : a))
    return { min: low.u, who: low.p, mean: xs.reduce((a, b) => a + b.u, 0) / xs.length }
  }

  const selected = res(rule)
  const selPick = pickOf(selected)
  const markers = useMemo<RingMarker[] | undefined>(() => {
    if (!data) return undefined
    const out: RingMarker[] = []
    if (data.oracle && data.oracle !== selPick) out.push({ slotId: data.oracle, text: 'ORACLE', active: false })
    if (selPick) out.push({ slotId: selPick, text: GLOSSARY[rule].term.toUpperCase(), active: true })
    return out
  }, [data, selPick, rule])
  useScopeFeed({
    model, markers,
    label: data ? `Meeting ${data.idx + 1}: ${data.n} people, ${data.feasible} feasible times.` : 'Loading a meeting.',
    legend: data ? `Meeting #${data.idx + 1} · ${data.feasible} feasible times. Dots: people, pulled toward the times they truly prefer.` : undefined,
  })

  const controls = (
    <section aria-label="Meeting settings" className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <Segmented label={<Term id="n" />} value={n} onChange={setN}
        options={[3, 5, 8].map((v) => ({ id: v as 3 | 5 | 8, node: String(v) }))} />
      <Segmented label="MANIPULATION" value={attack} onChange={setAttack}
        options={ATTACK_IDS.map((a) => ({ id: a, node: <Term id={a} passive /> }))} />
      <button type="button" onClick={() => setIdx(idx + 1)}
        className="h-8 px-3 rounded-[2px] border border-board-line text-[12.5px] text-strip hover:border-amber hover:text-amber transition-colors">
        Next meeting →
      </button>
    </section>
  )

  const people = data && (
    <section aria-label="The people">
      <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">PEOPLE · TRUE PREFERENCES</h2>
      <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
        {data.people.map((p) => (
          <li key={p.user_id} className="flex items-start gap-2.5"
            onPointerEnter={() => setHighlight(p.user_id)} onPointerLeave={() => setHighlight(null)}>
            <Face avatar={faces.get(p.user_id) ?? 0} size={30}
              score={selPick ? p.scores[selPick] : undefined} />
            <div className="min-w-0">
              <p className={`text-[14px] leading-tight ${highlight === p.user_id ? 'text-amber' : 'text-strip'}`}>
                {p.name}
                {p.liar && <span className="ml-1.5 font-mono text-[10px] tracking-[0.12em] text-signal"><Term id={attack}>{GLOSSARY[attack].term.toUpperCase()}</Term></span>}
              </p>
              <p className="text-[12.5px] text-strip/65 leading-snug">{p.said.map((s) => `“${s}”`).join(' ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )

  const shelf = data && (
    <section aria-label="Decision rules" className="flex flex-col gap-4">
      {FAMILIES.map((fam) => (
        <div key={fam}>
          <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">{fam.toUpperCase()}</h2>
          <div className="mt-2 grid sm:grid-cols-2 gap-2">
            {THEORIES.filter((t) => t.family === fam).map((t) => {
              const r = res(t.id)
              const pick = pickOf(r)
              const st = stats(pick)
              const on = rule === t.id
              return (
                <div key={t.id} role="button" tabIndex={0} aria-pressed={on}
                  onClick={() => setRule(t.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setRule(t.id))}
                  className={`text-left rounded-[2px] border px-3 py-2.5 cursor-pointer transition-colors ${on ? 'border-amber bg-amber/[0.07]' : 'border-board-line hover:border-strip/40'}`}>
                  <p className="text-[14px] font-semibold text-strip leading-tight"><Term id={t.id} passive /></p>
                  <p className="mt-1 text-[13px] text-strip tabular-nums">{label(pick)}</p>
                  {st && r && (
                    <p className="mt-0.5 text-[11.5px] text-mist tabular-nums">
                      <Term id="min_utility" passive>min</Term> {st.min} · <Term id="mean_utility" passive>mean</Term> {Math.round(st.mean)} · <Term id="oracle_ratio" passive>{Math.round(r.ratio * 100)}%</Term>
                    </p>
                  )}
                  {attack !== 'none' && r?.gain !== undefined && (
                    <p className={`mt-0.5 text-[11.5px] tabular-nums ${r.gain > 1e-9 ? 'text-signal' : 'text-amber'}`}>
                      <Term id="manip_gain" passive /> {fmtGain(r.gain)}
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {t.badges.map((b) => (
                      <span key={b} className={`px-1.5 py-0.5 rounded-[2px] text-[10.5px] border ${b === 'manipulable' ? 'border-board-line text-mist' : 'border-strip/30 text-strip/85'}`}>
                        <Term id={b} passive />
                      </span>
                    ))}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )

  const st = stats(selPick)
  const detail = data && selected && (
    <motion.section key={`${rule}-${data.idx}-${attack}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }} aria-label="Selected rule">
      <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">SELECTED RULE</p>
      <h2 className="mt-1 font-display font-bold text-[1.8rem] leading-none text-strip"><Term id={rule} /></h2>
      <p className="mt-3 font-display font-bold text-[2rem] leading-none text-amber">{label(selPick)}</p>
      {st && (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[['min_utility', `${st.min}`], ['mean_utility', `${Math.round(st.mean)}`], ['oracle_ratio', `${Math.round(selected.ratio * 100)}%`]].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] text-mist"><Term id={k as 'min_utility'} /></dt>
              <dd className="text-[20px] font-semibold text-strip tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[13px] text-strip/85">
        {selected.pareto ? <Term id="pareto" /> : <span className="text-signal">Not <Term id="pareto">Pareto optimal</Term></span>}
        {' · '}<Term id="oracle" />: {label(data.oracle)}
        {selected.extra?.condorcet !== undefined && <> · <Term id="condorcet_winner" />: {selected.extra.condorcet ? 'exists' : 'none (majorities cycle)'}</>}
        {selected.extra?.dictator && <> · <Term id="dictator" />: {data.people.find((p) => p.user_id === selected.extra!.dictator)?.name}</>}
      </p>
      {attack !== 'none' && selected.gain !== undefined && (
        <p className="mt-2 text-[13px] text-strip/85">
          <Term id="manip_gain" />: <span className={selected.gain > 1e-9 ? 'text-signal font-semibold' : 'text-amber font-semibold'}>{fmtGain(selected.gain)}</span>
          {' · '}honest pick {label(selected.pick)} → with the lie {label(selected.attack_pick)}
        </p>
      )}

      <h3 className="mt-5 font-mono text-[10.5px] tracking-[0.14em] text-mist"><Term id="utility" /> AT THE PICK</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {at(selPick).sort((a, b) => a.u - b.u).map(({ p, u }) => (
          <li key={p.user_id} className="flex items-center gap-2.5">
            <Face avatar={faces.get(p.user_id) ?? 0} score={u} size={26} />
            <span className="flex-1 min-w-0 truncate text-[13.5px] text-strip">{p.name}</span>
            {selected.payments?.[p.user_id] !== undefined && (
              <span className="text-[11.5px] text-mist tabular-nums"><Term id="payment">pays</Term> {Math.round(selected.payments[p.user_id] * 100)}</span>
            )}
            <span className="w-20 h-1.5 rounded-full bg-board-line overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${u}%`, background: u < 40 ? 'var(--color-clearance)' : 'var(--color-amber)' }} />
            </span>
            <span className="w-8 text-right font-mono text-[12px] text-mist tabular-nums">{u}</span>
          </li>
        ))}
      </ul>

      {selected.rounds && selected.rounds.length > 0 && (
        <>
          <h3 className="mt-5 font-mono text-[10.5px] tracking-[0.14em] text-mist"><Term id="mediated" /></h3>
          <ol className="mt-2 flex flex-col gap-2">
            {selected.rounds.map((rd, i) => {
              const who = data.people.find((p) => p.user_id === rd.user_id)
              return (
                <li key={i} className="text-[13px] leading-snug">
                  <p className="text-strip/85"><span className="text-amber">Mediator → {first(who?.name ?? '')}:</span> flex “{rd.rule}” for {label(rd.target)}?</p>
                  <p className="text-strip/85 pl-3"><span className="text-mist">{first(who?.name ?? '')}’s agent:</span> {rd.move}{rd.pick_after ? ` · draft now ${label(rd.pick_after)}` : ''}</p>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </motion.section>
  )

  const left = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-6">
      {controls}
      {error && <p role="alert" className="text-sm text-signal">{error}</p>}
      {people}
      {shelf}
    </div>
  )
  const right = <div className="px-5 lg:px-6 py-5 flex flex-col gap-5">{detail}</div>

  return (
    <>
      {bay && desktop && createPortal(left, bay)}
      {panel && createPortal(desktop ? right : <>{left}<div className="border-t border-board-line">{right}</div></>, panel)}
    </>
  )
}
