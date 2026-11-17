import type { ConnectionState } from '../api/useEventLog'
import type { TowerModel } from './model'
import type { Playback } from './usePlayback'

const PHASE: Record<TowerModel['phase'], string> = {
  holding: 'WAITING FOR PEOPLE',
  filtering: 'CROSSING OUT TIMES PEOPLE CAN’T MAKE',
  scoring: 'ROUND 1 · RATING TIMES',
  asking: 'ASKING PEOPLE TO MOVE',
  decided: 'BOOKED',
  escalated: 'NO TIME WORKS',
  failed: 'NEGOTIATION STOPPED',
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  play: 'M5 3.5v9l7-4.5z',
  pause: 'M5.5 3.5v9M10.5 3.5v9',
  replay: 'M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8',
  skip: 'M3.5 3.5 8 8l-4.5 4.5M8.5 3.5 13 8l-4.5 4.5',
}

function mmss(sec: number) {
  const s = Math.floor(sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  title: string
  model: TowerModel
  playback: Playback
  connection: ConnectionState
  /** Run the same size of group again with freshly drawn simulated people. */
  onNewGroup?: () => void
  starting?: boolean
}

export default function StatusBar({ title, model, playback, connection, onNewGroup, starting }: Props) {
  const phase = model.phase === 'asking' ? `ROUND ${model.round} · ASKING PEOPLE TO MOVE` : PHASE[model.phase]
  const live = connection === 'live'
  const btn =
    'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[2px] font-mono text-[11px] tracking-wider text-strip/80 border border-board-line hover:border-amber hover:text-amber transition-colors disabled:opacity-35 disabled:pointer-events-none'

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 border-b border-board-line">
      <h1 className="font-display font-bold text-3xl sm:text-4xl leading-none tracking-tight text-strip min-w-0 truncate">
        {title}
      </h1>
      <div className="flex items-center gap-4 font-mono text-xs tracking-wider">
        <span className={model.phase === 'decided' || model.phase === 'failed' || model.phase === 'escalated' ? 'text-signal' : 'text-amber'}>
          {phase}
        </span>
        {playback.started && <span className="text-mist tabular-nums font-sans text-[13px] tracking-normal">{mmss(playback.clock)} in</span>}
        {model.backend === 'simulated' && (
          <span className="px-2 py-0.5 border border-mist/40 text-mist rounded-[2px] font-sans text-[12px] tracking-normal">Simulated agents, not live AI</span>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {playback.started && (
          <>
            <button type="button" className={btn} onClick={() => playback.setPlaying(!playback.playing)}
              aria-label={playback.playing ? 'Pause playback' : 'Resume playback'}>
              <Icon d={playback.playing ? ICONS.pause : ICONS.play} />
              <span className="hidden sm:inline">{playback.playing ? 'PAUSE' : 'PLAY'}</span>
            </button>
            {!model.decision && <button type="button" className={btn} onClick={() => playback.setSpeed(playback.speed === 1 ? 2 : 1)}
              aria-label={`Playback speed ${playback.speed}x, switch to ${playback.speed === 1 ? 2 : 1}x`}>
              {playback.speed}×
            </button>}
            <button type="button" className={btn} onClick={playback.replay} aria-label="Replay from the start">
              <Icon d={ICONS.replay} />
              <span className="hidden sm:inline">REPLAY</span>
            </button>
            {onNewGroup && model.decision && (
              <button type="button" className={btn} onClick={onNewGroup} disabled={starting}
                title="Draw a fresh group of simulated people and negotiate again">
                <Icon d={ICONS.skip} />
                <span>{starting ? 'STARTING…' : 'NEW AGENTS'}</span>
              </button>
            )}
            {!model.decision && (
              <button type="button" className={btn} onClick={playback.skipToEnd} disabled={playback.caughtUp}
                aria-label="Skip to the latest state">
                <Icon d={ICONS.skip} />
                <span className="hidden sm:inline">SKIP</span>
              </button>
            )}
          </>
        )}
        {/* Only say something about the connection when it isn't fine. */}
        <span className="flex items-center gap-2 text-[13px] text-mist pl-2 whitespace-nowrap" role="status">
          {!live && <span className="w-1.5 h-1.5 rounded-full bg-mist/50" />}
          {live ? '' : connection === 'closed' ? 'Meeting not found' : connection === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
        </span>
      </div>
    </div>
  )
}
