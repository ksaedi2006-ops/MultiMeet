/**
 * Short, plain renderings of a slot label like "Tue Nov 18, 3:00 PM" (from the backend)
 * or "Tue, Nov 18, 3:00 PM" (from the browser preview).
 */
const RE = /^(\w{3}),? (\w{3}) (\d+), (\d+):(\d+) ?(AM|PM)/

function parts(label: string) {
  const m = RE.exec(label)
  if (!m) return null
  const [, wd, mon, day, h, mm, ap] = m
  return { wd, mon, day, h, mm, ap }
}

/** "3 PM", "3:30 PM" */
export function clockOnly(label: string): string {
  const p = parts(label)
  if (!p) return label
  return `${p.h}${p.mm === '00' ? '' : `:${p.mm}`} ${p.ap}`
}

/** "Tue 3 PM" */
export function dayAndClock(label: string): string {
  const p = parts(label)
  return p ? `${p.wd} ${clockOnly(label)}` : label
}

/** "Tue Nov 18, 3:00 PM" */
export function fullTime(label: string): string {
  const p = parts(label)
  return p ? `${p.wd} ${p.mon} ${p.day}, ${p.h}:${p.mm} ${p.ap}` : label
}

/** "Nora's bookstore shift" / "Nora's rule: done by 5 PM" from a backend blocker. */
export function blockerPhrase(name: string, reason: string): string {
  const first = name.trim().split(/\s+/)[0] || name
  const rule = /^Rule: ?(.*)$/i.exec(reason)
  return plainTimes(rule ? `${first}'s rule (${rule[1]})` : `${first}'s ${reason}`)
}

/** "Done by 17:00" -> "Done by 5 PM": 24-hour times inside free text, as the rest of the app reads them. */
export function plainTimes(text: string): string {
  return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?(?:AM|PM|am|pm))/g, (_, h: string, m: string) => {
    const hour = Number(h)
    const ap = hour < 12 ? 'AM' : 'PM'
    const h12 = hour % 12 || 12
    return m === '00' ? `${h12} ${ap}` : `${h12}:${m} ${ap}`
  })
}

/** "Tap" on a touch screen, "Point at" with a mouse: the verb a legend should use. */
export function pointVerb(): 'Tap' | 'Point at' {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Point at'
  } catch {
    return 'Point at'
  }
}
