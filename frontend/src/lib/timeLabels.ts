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
  return rule ? `${first}'s rule (${rule[1]})` : `${first}'s ${reason}`
}
