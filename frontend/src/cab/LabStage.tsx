import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { streamLab, type Attack, type LabParams, type LabRow } from '../lib/lab'
import ManyMeetings from '../lab/ManyMeetings'
import OneMeeting from '../lab/OneMeeting'
import UnderTheHood from '../lab/UnderTheHood'
import Coach from '../lab/Coach'
import type { RuleId } from '../lab/theories'
import { useFixture } from './context'

type Tab = 'one' | 'many' | 'hood'
const TABS: { id: Tab; name: string }[] = [
  { id: 'one', name: 'ONE MEETING' },
  { id: 'many', name: 'MANY MEETINGS' },
  { id: 'hood', name: 'UNDER THE HOOD' },
]

export interface LabRun {
  rows: LabRow[]
  running: boolean
  error: string | null
  params: LabParams // the settings the rows on screen came from
  start: (p: LabParams) => void
  stop: () => void
}

/**
 * The Lab: decision rules from bargaining theory, welfare economics, social choice and
 * mechanism design, run on simulated meetings with hidden true preferences. One meeting first,
 * then many, then the full tables; the tabs live in the top bar.
 */
export default function LabStage() {
  const tools = useFixture('tools')
  const [search, setSearch] = useSearchParams()
  const tab = (TABS.some((t) => t.id === search.get('tab')) ? search.get('tab') : 'one') as Tab
  const setTab = (t: Tab) => setSearch((s) => { s.set('tab', t); return s }, { replace: true })

  // Shared across tabs: the group size and the manipulation being tested.
  const [n, setN] = useState<3 | 5 | 8>(5)
  const [attack, setAttack] = useState<Attack>('none')
  const [idx, setIdx] = useState(0)
  const [rules, setRules] = useState<RuleId[]>(['nash', 'utilitarian', 'old', 'borda', 'median'])

  // One run of many meetings, kept here so "Many meetings" and "Under the hood" share it.
  const [rows, setRows] = useState<LabRow[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<LabParams>({ rules, n, attack, count: 200 })
  const abort = useRef<AbortController | null>(null)
  const start = useCallback(async (p: LabParams) => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setParams(p)
    setRows([])
    setError(null)
    setRunning(true)
    const buf: LabRow[] = []
    let flush = 0
    try {
      await streamLab(p, (r) => {
        buf.push(r)
        if (!flush) flush = window.setTimeout(() => { flush = 0; setRows([...buf]) }, 120)
      }, ctl.signal)
    } catch (err) {
      if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : 'The run stopped.')
    } finally {
      window.clearTimeout(flush)
      setRows([...buf])
      if (abort.current === ctl) setRunning(false)
    }
  }, [])
  const stop = useCallback(() => abort.current?.abort(), [])
  useEffect(() => () => abort.current?.abort(), [])
  const run: LabRun = { rows, running, error, params, start: (p) => void start(p), stop }

  const tabs = (
    <div role="tablist" aria-label="Lab views" className="flex items-stretch border-l border-board-line">
      {TABS.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
          className={`px-2 sm:px-3 lg:px-4 whitespace-nowrap transition-colors ${tab === t.id ? 'text-amber bg-board-raised/60' : 'text-strip/75 hover:text-strip'}`}>
          <span className="hidden md:inline">{t.name}</span>
          <span className="md:hidden">{t.name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      {tools && createPortal(tabs, tools)}
      {tab === 'one' && <OneMeeting n={n} attack={attack} idx={idx} setN={setN} setAttack={setAttack} setIdx={setIdx} />}
      {tab === 'many' && <ManyMeetings n={n} attack={attack} setN={setN} setAttack={setAttack} rules={rules} setRules={setRules} run={run} />}
      {tab === 'hood' && <UnderTheHood run={run} onOpen={(i) => { setIdx(i); setN(run.params.n); setAttack(run.params.attack); setTab('one') }} />}
      {tab === 'one' && <Coach />}
    </>
  )
}
