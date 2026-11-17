import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useCab, useFixture, useScopeFeed } from '../cab/context'
import { avatarsFor } from '../lib/avatars'
import { EASE } from '../lib/motion'
import { ATTACK_IDS, decideLab, getLabMeeting, instanceEvents, type Attack, type Edit, type LabMeeting, type LabResult } from '../lib/lab'
import { dayAndClock } from '../lib/timeLabels'
import Face from '../story/Face'
import { buildModel, emptyModel } from '../tower/model'
import { revealDuration, type Reveal, type RingMarker } from '../tower/scope/engine'
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
  onNext: () => void
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name

/** How each rule's own score reads beside a time on the radar. */
const FORMAT: Partial<Record<RuleId, (v: number) => string>> = {
  nash: (v) => `Σlog ${v.toFixed(2)}`,
  egalitarian: (v) => `min ${Math.round(v * 100)}`,
  ks: (v) => `share ${v.toFixed(2)}`,
  utilitarian: (v) => `Σ ${v.toFixed(2)}`,
  budget: (v) => `Σ ${v.toFixed(2)}`,
  vcg: (v) => `Σ ${v.toFixed(2)}`,
  borda: (v) => `${v.toFixed(1)} pts`,
  when2meet: (v) => `${Math.round(v)} free`,
  plurality: (v) => `${Math.round(v)} vote${Math.round(v) === 1 ? '' : 's'}`,
  condorcet: (v) => `Copeland ${Math.round(v) > 0 ? '+' : ''}${Math.round(v)}`,
  median: (v) => (Math.round(v) === 0 ? 'median' : `${Math.round(-v)} min off`),
}
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
export default function OneMeeting({ n, attack, idx, setN, setAttack, setIdx, onNext }: Props) {
  const bay = useFixture('bay')
  const panel = useFixture('panel')
  const { desktop, highlight, setHighlight } = useCab()
  const [data, setData] = useState<LabMeeting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rule, setRule] = useState<RuleId>('nash')
  // The sandbox: people whose preferences the viewer has redrawn, and who is being edited now.
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => { setEdits({}); setEditing(null) }, [idx, n])
  const editKey = JSON.stringify(edits)

  useEffect(() => {
    let live = true
    setError(null)
    const t = window.setTimeout(() => {
      const req = Object.keys(edits).length ? decideLab(idx, n, attack, edits) : getLabMeeting(idx, n, attack)
      req.then((d) => live && setData(d), (e) => {
        if (!live) return
        // The generator drops a few seeds; step to the next one.
        if (String(e.message).includes('dropped')) setIdx(idx + 1)
        else setError(e.message)
      })
    }, Object.keys(edits).length ? 200 : 0)
    return () => { live = false; window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, n, attack, setIdx, editKey])

  const edit = (uid: string, patch: Partial<Edit>) => setEdits((all) => {
    const person = data?.people.find((p) => p.user_id === uid)
    const fav = person ? Object.entries(person.scores).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined
    const cur = all[uid] ?? { peak: fav ?? '', avoid: [] }
    return { ...all, [uid]: { ...cur, ...patch } }
  })

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
  // The selected rule's mechanism, played on the radar; its pick is marked once the animation lands.
  const [replay, setReplay] = useState(0)
  const reveal = useMemo<Reveal | undefined>(() => {
    if (!data || !selected) return undefined
    const ex = (attack !== 'none' ? selected.attack_extra : selected.extra) ?? {}
    const fmt = FORMAT[rule]
    // Times with no votes aren't part of a vote count's story.
    const top = (ex.top ?? []).filter((x) => !(rule === 'plurality' && x.value <= 0))
    const i = top.findIndex((x) => x.slot === selPick)
    if (i > 0) top.unshift(...top.splice(i, 1)) // the pick leads, even when a tie went by time order
    return {
      key: `${data.idx}:${n}:${attack}:${rule}:${editKey}:${replay}`,
      lines: ex.votes && !ex.dictator ? Object.entries(ex.votes).map(([from, slotId]) => ({ from, slotId })) : undefined,
      labels: fmt ? top.map((x) => ({ slotId: x.slot, text: fmt(x.value), value: x.value, format: fmt })) : undefined,
      dictator: ex.dictator && selPick ? { agentId: ex.dictator, slotId: selPick } : undefined,
      asks: attack === 'none' && selected.rounds
        ? selected.rounds.map((rd) => ({ agentId: rd.user_id, slotId: rd.target, verdict: rd.move.toUpperCase() }))
        : undefined,
    }
  }, [data, selected, selPick, rule, attack, n, editKey, replay])
  const [landedKey, setLandedKey] = useState('')
  useEffect(() => {
    if (!reveal) return
    const t = window.setTimeout(() => setLandedKey(reveal.key), revealDuration(reveal))
    return () => window.clearTimeout(t)
  }, [reveal])
  const landed = reveal ? landedKey === reveal.key : true
  const markers = useMemo<RingMarker[] | undefined>(() => {
    if (!data) return undefined
    const out: RingMarker[] = []
    if (data.oracle && data.oracle !== selPick) out.push({ slotId: data.oracle, text: 'ORACLE', active: false })
    if (selPick && landed) out.push({ slotId: selPick, text: GLOSSARY[rule].term.toUpperCase(), active: true })
    return out
  }, [data, selPick, rule, landed])
  const onSlotPick = useCallback((slot: string) => { if (editing) edit(editing, { peak: slot }) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, data])
  useScopeFeed({
    model, markers, reveal, onSlotPick: editing ? onSlotPick : undefined,
    label: data ? `Meeting ${data.idx + 1}: ${data.n} people, ${data.feasible} feasible times.` : 'Loading a meeting.',
    legend: data ? `Meeting #${data.idx + 1} · ${data.feasible} feasible times. Dots: people, pulled toward the times they truly prefer.` : undefined,
  })

  const meetingControls = (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <Segmented label={<Term id="n" />} value={n} onChange={setN}
        options={[3, 5, 8].map((v) => ({ id: v as 3 | 5 | 8, node: String(v) }))} />
      <button type="button" onClick={() => setIdx(idx + 1)}
        className="h-8 px-3 rounded-[2px] border border-board-line text-[12.5px] text-strip hover:border-amber hover:text-amber transition-colors">
        Another meeting →
      </button>
    </div>
  )

  const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const people = data && (
    <section aria-label="The people">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-mist">PEOPLE · TRUE PREFERENCES</h2>
        {Object.keys(edits).length > 0 && (
          <button type="button" onClick={() => { setEdits({}); setEditing(null) }} className="text-[12px] text-amber hover:underline underline-offset-4">Reset edits</button>
        )}
      </div>
      <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
        {data.people.map((p) => {
          const e = edits[p.user_id]
          const open = editing === p.user_id
          return (
            <li key={p.user_id} className={`flex flex-col gap-2 ${open ? 'sm:col-span-2 rounded-[2px] border border-amber/50 p-2.5' : ''}`}
              onPointerEnter={() => setHighlight(p.user_id)} onPointerLeave={() => setHighlight(null)}>
              <div className="flex items-start gap-2.5">
                <Face avatar={faces.get(p.user_id) ?? 0} size={30} score={selPick ? p.scores[selPick] : undefined} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] leading-tight ${highlight === p.user_id ? 'text-amber' : 'text-strip'}`}>
                    {p.name}
                    {p.liar && <span className="ml-1.5 font-mono text-[10px] tracking-[0.12em] text-signal"><Term id={attack}>{GLOSSARY[attack].term.toUpperCase()}</Term></span>}
                    {p.edited && <span className="ml-1.5 font-mono text-[10px] tracking-[0.12em] text-amber">EDITED</span>}
                  </p>
                  <p className="text-[12.5px] text-strip/65 leading-snug">{p.said.map((x) => `“${x}”`).join(' ')}</p>
                </div>
                <button type="button" onClick={() => setEditing(open ? null : p.user_id)} aria-expanded={open}
                  className="shrink-0 font-mono text-[10.5px] tracking-[0.12em] text-mist hover:text-amber">{open ? 'DONE' : 'EDIT'}</button>
              </div>
              {open && (
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pl-10">
                  <label className="flex flex-col gap-1 text-[11.5px] text-mist">
                    Favourite time (or press one on the radar)
                    <select value={e?.peak ?? ''} onChange={(ev) => edit(p.user_id, { peak: ev.target.value })}
                      className="h-8 bg-console border border-board-line rounded-[2px] px-2 text-[13px] text-strip">
                      {!e && <option value="">Keep their own</option>}
                      {data.slots.map((s) => <option key={s.id} value={s.id}>{dayAndClock(s.label)}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1 text-[11.5px] text-mist">
                    Avoid
                    <div className="flex gap-1">
                      {DAY.map((d, i) => {
                        const on = e?.avoid.includes(i) ?? false
                        return (
                          <button key={d} type="button" aria-pressed={on}
                            onClick={() => edit(p.user_id, { avoid: on ? e!.avoid.filter((x) => x !== i) : [...(e?.avoid ?? []), i] })}
                            className={`h-8 w-10 rounded-[2px] border text-[12px] ${on ? 'border-signal text-signal' : 'border-board-line text-strip/75 hover:border-strip/50'}`}>{d}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )

  const shelf = data && (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem_2.5rem_3rem] gap-x-2 px-2.5 text-[11px] text-mist">
        <span />
        <span>pick</span>
        <span className="text-right"><Term id="min_utility">min</Term></span>
        <span className="text-right"><Term id="mean_utility">mean</Term></span>
        <span className="text-right">{attack === 'none' ? <Term id="oracle_ratio">NW</Term> : <Term id="manip_gain">gain</Term>}</span>
      </div>
      {FAMILIES.map((fam) => (
        <div key={fam}>
          <h3 className="px-2.5 font-mono text-[10px] tracking-[0.14em] text-mist/80">{fam.toUpperCase()}</h3>
          <ul className="mt-1 flex flex-col">
            {THEORIES.filter((t) => t.family === fam).map((t) => {
              const r = res(t.id)
              const pick = pickOf(r)
              const st = stats(pick)
              const on = rule === t.id
              const gain = r?.gain
              return (
                <li key={t.id}>
                  <button type="button" aria-pressed={on} onClick={() => { setRule(t.id); setReplay((x) => x + 1) }}
                    className={`w-full grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem_2.5rem_3rem] items-center gap-x-2 px-2.5 py-1.5 rounded-[2px] text-left text-[13px] tabular-nums transition-colors ${on ? 'bg-amber/[0.12] ring-1 ring-amber' : 'hover:bg-board-raised/60'}`}>
                    <span className={`truncate ${on ? 'text-strip font-semibold' : 'text-strip/90'}`}><Term id={t.id} passive /></span>
                    <span className="text-strip/85 truncate">{label(pick)}</span>
                    <span className={`text-right ${st && st.min < 40 ? 'text-signal' : 'text-strip/85'}`}>{st?.min ?? '–'}</span>
                    <span className="text-right text-strip/85">{st ? Math.round(st.mean) : '–'}</span>
                    <span className={`text-right ${attack !== 'none' && gain !== undefined && gain > 1e-9 ? 'text-signal' : 'text-strip/85'}`}>
                      {attack === 'none' ? (r ? `${Math.round(r.ratio * 100)}%` : '–') : (gain !== undefined ? fmtGain(gain) : '–')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )

  const st = stats(selPick)
  const detail = data && selected && (
    <motion.section key={`${rule}-${data.idx}-${attack}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }} aria-label="Selected rule">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-amber">SELECTED RULE</p>
        <button type="button" onClick={() => setReplay((x) => x + 1)}
          className="font-mono text-[10.5px] tracking-[0.12em] text-mist hover:text-amber">↻ REPLAY ON RADAR</button>
      </div>
      <h2 className="mt-1 font-display font-bold text-[1.8rem] leading-none text-strip"><Term id={rule} /></h2>
      <p className="mt-2 flex flex-wrap gap-1">
        {THEORIES.find((t) => t.id === rule)?.badges.map((b) => (
          <span key={b} className="px-1.5 py-0.5 rounded-[2px] text-[11px] border border-strip/30 text-strip/85"><Term id={b} /></span>
        ))}
      </p>
      <p className="mt-3 font-display font-bold text-[2rem] leading-none text-amber">{label(selPick)}</p>
      {st && (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[['oracle_ratio', `${Math.round(selected.ratio * 100)}%`], ['util_ratio', `${Math.round(selected.util_ratio * 100)}%`], ['min_ratio', `${Math.round(selected.min_ratio * 100)}%`]].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] text-mist"><Term id={k as 'oracle_ratio'} /></dt>
              <dd className="text-[20px] font-semibold text-strip tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[13px] text-strip/85 tabular-nums">
        <Term id="min_utility" /> {st?.min} · <Term id="mean_utility" /> {st ? Math.round(st.mean) : '–'}
      </p>
      <p className="mt-1 text-[13px] text-strip/85">
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

      <h3 className="mt-5 font-mono text-[10.5px] tracking-[0.14em] text-mist">
        <Term id="utility">UTILITY</Term> AT THE PICK · TICK = <Term id="disagreement">d</Term>
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {at(selPick).sort((a, b) => a.u - b.u).map(({ p, u }) => (
          <li key={p.user_id} className="flex items-center gap-2.5">
            <Face avatar={faces.get(p.user_id) ?? 0} score={u} size={26} />
            <span className="flex-1 min-w-0 truncate text-[13.5px] text-strip">{p.name}</span>
            {selected.payments?.[p.user_id] !== undefined && (
              <span className="text-[11.5px] text-mist tabular-nums"><Term id="payment">pays</Term> {Math.round(selected.payments[p.user_id] * 100)}</span>
            )}
            <span className="relative w-20 h-1.5 rounded-full bg-board-line" title={`d = ${p.d}`}>
              <span className="block h-full rounded-full" style={{ width: `${u}%`, background: u < p.d ? 'var(--color-clearance)' : 'var(--color-amber)' }} />
              <span aria-hidden className="absolute -top-1 -bottom-1 w-px bg-strip" style={{ left: `${p.d}%` }} />
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
                  <p className="text-strip/85 pl-3">
                    <span className="text-mist">{first(who?.name ?? '')}’s agent:</span> {rd.move}
                    {rd.move === 'flex' && rd.from_weight !== null && rd.to_weight !== null && (
                      <span className="text-mist tabular-nums"> · weight {rd.from_weight.toFixed(2)} → {rd.to_weight.toFixed(2)} (floor {rd.floor.toFixed(2)})</span>
                    )}
                    {rd.pick_after ? ` · draft now ${label(rd.pick_after)}` : ''}
                  </p>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </motion.section>
  )

  const step = (num: number, title: React.ReactNode, body: React.ReactNode, aside?: React.ReactNode) => (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] text-amber tabular-nums">{num}</span>
        <h2 className="font-display font-bold text-[1.45rem] leading-none text-strip">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {body}
    </section>
  )
  const left = (
    <div className="px-4 lg:px-5 py-5 flex flex-col gap-7">
      {error && <p role="alert" className="text-sm text-signal">{error}</p>}
      {step(1, `Meeting #${(data?.idx ?? idx) + 1}`, <>{meetingControls}{people}</>)}
      {step(2, 'Choose a decision rule', shelf)}
      {step(3, 'Stress-test it', (
        <div className="flex flex-col gap-2">
          <Segmented label={<Term id="manip_gain">MANIPULATION</Term>} value={attack} onChange={setAttack}
            options={ATTACK_IDS.map((a) => ({ id: a, node: <Term id={a} passive /> }))} />
          <p className="text-[12.5px] text-mist">Or EDIT a person in step 1 and watch every rule re-decide.</p>
        </div>
      ))}
      <button type="button" onClick={onNext}
        className="self-start inline-flex items-center gap-2 h-10 px-4 rounded-[2px] bg-clearance text-strip font-mono text-[12px] tracking-[0.14em] hover:bg-clearance-dim transition-colors">
        IS THIS MEETING TYPICAL? RUN MANY →
      </button>
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
