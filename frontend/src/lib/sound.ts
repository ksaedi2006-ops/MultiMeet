import { useEffect, useRef, useState } from 'react'

/**
 * Optional sound, synthesized with Web Audio (no audio files). Off unless the viewer turns it
 * on, and remembered per browser. Turning it on is the user gesture browsers require before
 * a page may make sound.
 */

const KEY = 'multimeet_sound'
const EVENT = 'multimeet-sound'
let ctx: AudioContext | null = null

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* a convenience only */
  }
  if (on) audio()?.resume()
  window.dispatchEvent(new Event(EVENT))
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
  } catch {
    ctx = null
  }
  return ctx
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.05, at = 0, to }: {
  type?: OscillatorType; gain?: number; at?: number; to?: number
} = {}) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sounds = {
  /** Times being crossed out: a short rattle, one tick per time, at most eight. */
  cross(count: number) {
    for (let i = 0; i < Math.min(8, count); i++) tone(1700, 0.03, { type: 'triangle', gain: 0.025, at: i * 0.045 })
  },
  /** Someone joined, or the mediator asked someone something. */
  blip() {
    tone(620, 0.09, { gain: 0.04, to: 880 })
  },
  /** A time is booked. */
  chime() {
    tone(523.25, 0.5, { gain: 0.05 })
    tone(783.99, 0.6, { gain: 0.045, at: 0.12 })
  },
}

export function play(name: 'blip' | 'chime'): void
export function play(name: 'cross', count: number): void
export function play(name: keyof typeof sounds, count = 1) {
  if (!soundOn() || !audio() || ctx?.state !== 'running') return
  if (name === 'cross') sounds.cross(count)
  else sounds[name]()
}

/** The current setting, kept in sync across the page. */
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(soundOn)
  useEffect(() => {
    const sync = () => setOn(soundOn())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return [on, setSound]
}

/** Play `fire(delta)` whenever `value` grows, but not for what was already there on load. */
export function useGrowth(value: number, fire: (delta: number) => void) {
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (last.current !== null && value > last.current) fire(value - last.current)
    last.current = value
  }, [value, fire])
}
