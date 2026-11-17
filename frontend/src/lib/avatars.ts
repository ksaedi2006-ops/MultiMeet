/**
 * Thirty flat, round-framed characters drawn as SVG: twenty-two people (skin, hair colour and
 * style, a beard or glasses here and there) and eight creatures. They share one palette taken from
 * the console, so any mix of them sits well together. `avatarSvg` gives the markup; `avatarImage`
 * gives a cached bitmap for the scope's canvas.
 */

const INK = '#2a2015'
const SKIN = ['#f6dcc4', '#ebbf98', '#d29a6a', '#a8714a', '#7a4a30', '#4f2f1f']
const HAIR = {
  blonde: '#e8c45a', brown: '#6b4426', dark: '#2a1f17', black: '#14110e',
  red: '#b4502a', grey: '#cfcfc8', navy: '#2d3b57',
}
const BG = ['#4d6a80', '#8f6f33', '#a8532a', '#5d7d6a', '#6b5a82', '#3c5266', '#b0894a', '#7a4f5e']
const CLOTH = ['#2e4558', '#d4551c', '#e8a93a', '#ecdfc2', '#3f6b5a', '#5b4a7a']

type Style = 'short' | 'long' | 'curly' | 'bun' | 'bald' | 'buzz' | 'bob' | 'pony' | 'side' | 'spiky'

interface Person {
  kind: 'person'; name: string; skin: number; hair: keyof typeof HAIR; style: Style
  bg: number; cloth: number; glasses?: boolean; beard?: boolean; freckles?: boolean
}
interface Creature { kind: 'creature'; name: string; draw: () => string }
type Def = Person | Creature

/* ---------- people ---------- */

function hairParts(style: Style, c: string): { back: string; front: string } {
  const cap = `<path d="M19.5 30C18 12 46 12 44.5 30C42 23.500 37 21 32 21C27 21 22 23.500 19.500 30Z" fill="${c}"/>`
  switch (style) {
    case 'short': return { back: '', front: cap }
    case 'side': return { back: '', front: `<path d="M19.500 30C17 11 47 11 44.500 29C43 24 38 22.500 31 21.500C26 23 22 25.500 19.500 30Z" fill="${c}"/><path d="M31 21.500C37 19 42 21 44.500 26" fill="none" stroke="${c}" stroke-width="2"/>` }
    case 'buzz': return { back: '', front: `<path d="M20.500 28C20 15 44 15 43.500 28C41 22 37 20.500 32 20.500C27 20.500 23 22 20.500 28Z" fill="${c}" opacity=".85"/>` }
    case 'spiky': return { back: '', front: `<path d="M19.500 29L19 17L24 21L26 12L30 19L34 11L37 19L42 14L43 22L45 18L44.500 29C42 24 37 22 32 22C27 22 22 24 19.500 29Z" fill="${c}"/>` }
    case 'long': return {
      back: `<path d="M18 31C15 10 49 10 46 31L47.500 54L16.500 54Z" fill="${c}"/>`,
      front: `<path d="M19.500 31C17 12 47 12 44.500 31C42 23.500 37 21.500 32 21.500C27 21.500 22 23.500 19.500 31Z" fill="${c}"/>`,
    }
    case 'bob': return {
      back: `<path d="M18.500 32C16 11 48 11 45.500 32L45.500 42C42 44 22 44 18.500 42Z" fill="${c}"/>`,
      front: `<path d="M19.500 30C17 12 47 12 44.500 30C41 22 25 22 19.500 30Z" fill="${c}"/>`,
    }
    case 'curly': return {
      back: `<g fill="${c}"><circle cx="32" cy="25" r="17"/><circle cx="19" cy="33" r="6"/><circle cx="45" cy="33" r="6"/></g>`,
      front: `<path d="M20 28C21 19 43 19 44 28C40 24 24 24 20 28Z" fill="${c}"/>`,
    }
    case 'bun': return {
      back: `<circle cx="32" cy="12" r="6.500" fill="${c}"/>`,
      front: cap,
    }
    case 'pony': return {
      back: `<path d="M44 22C54 20 56 36 50 46C52 36 48 30 43 30Z" fill="${c}"/>`,
      front: cap,
    }
    default: return { back: '', front: '' }
  }
}

function person(p: Person): string {
  const skin = SKIN[p.skin]
  const shade = SKIN[Math.min(5, p.skin + 1)]
  const hair = HAIR[p.hair]
  const { back, front } = hairParts(p.style, hair)
  return `
  <circle cx="32" cy="32" r="32" fill="${BG[p.bg]}"/>
  <clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath>
  <g clip-path="url(#c)">
    ${back}
    <path d="M10 70C10 52 20 47 32 47C44 47 54 52 54 70Z" fill="${CLOTH[p.cloth]}"/>
    <rect x="27" y="40" width="10" height="10" rx="3" fill="${shade}"/>
    <ellipse cx="20" cy="32" rx="2.600" ry="3.600" fill="${skin}"/><ellipse cx="44" cy="32" rx="2.600" ry="3.600" fill="${skin}"/>
    <ellipse cx="32" cy="31" rx="12" ry="14" fill="${skin}"/>
    ${p.freckles ? `<g fill="${shade}" opacity=".7"><circle cx="26" cy="35" r=".9"/><circle cx="28.500" cy="36.500" r=".9"/><circle cx="38" cy="35" r=".9"/><circle cx="35.500" cy="36.500" r=".9"/></g>` : ''}
    ${p.beard ? `<path d="M20.500 33C20 47 44 47 43.500 33C41.500 39 38 40 32 40C26 40 22.500 39 20.500 33Z" fill="${hair}"/>` : ''}
    <circle cx="27" cy="31" r="1.500" fill="${INK}"/><circle cx="37" cy="31" r="1.500" fill="${INK}"/>
    <path d="M28.500 37.500Q32 40.200 35.500 37.500" fill="none" stroke="${p.beard ? '#fff' : INK}" stroke-width="1.400" stroke-linecap="round" opacity="${p.beard ? .8 : 1}"/>
    ${front}
    ${p.glasses ? `<g fill="none" stroke="${INK}" stroke-width="1.300"><circle cx="27" cy="31" r="4.200"/><circle cx="37" cy="31" r="4.200"/><path d="M31.200 30.500h1.600"/></g>` : ''}
  </g>`
}

/* ---------- creatures ---------- */

const frame = (bg: string, inner: string) => `
  <circle cx="32" cy="32" r="32" fill="${bg}"/>
  <clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath>
  <g clip-path="url(#c)">${inner}</g>`

const eyes = (y = 30, dx = 6, r = 1.600, c = INK) =>
  `<circle cx="${32 - dx}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${32 + dx}" cy="${y}" r="${r}" fill="${c}"/>`

const creatures: Creature[] = [
  { kind: 'creature', name: 'Dino', draw: () => frame('#8f6f33', `
    <path d="M10 70C10 52 20 48 32 48C44 48 54 52 54 70Z" fill="#5d8a52"/>
    <g fill="#e8a93a"><path d="M24 20L27 10L31 19Z"/><path d="M30 18L34 8L38 18Z"/><path d="M36 19L41 11L43 22Z"/></g>
    <ellipse cx="32" cy="32" rx="15" ry="14" fill="#7fae6b"/>
    <ellipse cx="32" cy="38" rx="9" ry="6.500" fill="#9cc58a"/>
    <circle cx="29" cy="37" r="1" fill="${INK}"/><circle cx="35" cy="37" r="1" fill="${INK}"/>
    ${eyes(28, 7, 2.200)}<circle cx="24.500" cy="27.300" r=".7" fill="#fff"/><circle cx="38.500" cy="27.300" r=".7" fill="#fff"/>
    <path d="M27 42Q32 45 37 42" fill="none" stroke="${INK}" stroke-width="1.300" stroke-linecap="round"/>
    <path d="M29.500 43.300L30.500 45.500L31.500 43.700Z" fill="#fff"/>`) },
  { kind: 'creature', name: 'Skeleton', draw: () => frame('#3c5266', `
    <g fill="none" stroke="#ecdfc2" stroke-width="2.200" stroke-linecap="round"><path d="M32 46V64"/><path d="M22 50Q32 53 42 50"/><path d="M20 56Q32 60 44 56"/></g>
    <path d="M18 31C18 15 46 15 46 31C46 36 43 38 42 40L42 45L22 45L22 40C21 38 18 36 18 31Z" fill="#ecdfc2"/>
    <ellipse cx="25.500" cy="31" rx="4.500" ry="5" fill="${INK}"/><ellipse cx="38.500" cy="31" rx="4.500" ry="5" fill="${INK}"/>
    <path d="M32 36L30 40H34Z" fill="${INK}"/>
    <path d="M25 44V41M29 44V41M33 44V41M37 44V41" stroke="${INK}" stroke-width="1.100"/>
    <path d="M23.500 41H40.500" stroke="${INK}" stroke-width="1.100"/>`) },
  { kind: 'creature', name: 'Robot', draw: () => frame('#a8532a', `
    <path d="M12 70C12 54 20 50 32 50C44 50 52 54 52 70Z" fill="#93aabd"/>
    <path d="M32 12V19" stroke="#ecdfc2" stroke-width="2"/><circle cx="32" cy="11" r="2.800" fill="#e8a93a"/>
    <rect x="17" y="19" width="30" height="26" rx="6" fill="#c9d4dd"/>
    <rect x="14" y="28" width="3.500" height="8" rx="1.500" fill="#93aabd"/><rect x="46.500" y="28" width="3.500" height="8" rx="1.500" fill="#93aabd"/>
    <rect x="21.500" y="26" width="8" height="8" rx="2" fill="#2a2015"/><rect x="34.500" y="26" width="8" height="8" rx="2" fill="#2a2015"/>
    <rect x="23.500" y="28" width="4" height="4" rx="1" fill="#e8a93a"/><rect x="36.500" y="28" width="4" height="4" rx="1" fill="#e8a93a"/>
    <rect x="23" y="38" width="18" height="3.800" rx="1.500" fill="#2a2015"/><path d="M27 38V41.800M32 38V41.800M37 38V41.800" stroke="#c9d4dd" stroke-width=".9"/>`) },
  { kind: 'creature', name: 'Cat', draw: () => frame('#6b5a82', `
    <path d="M10 70C10 52 20 48 32 48C44 48 54 52 54 70Z" fill="#e8a93a"/>
    <path d="M17 26L19 10L29 19Z" fill="#d98a2a"/><path d="M47 26L45 10L35 19Z" fill="#d98a2a"/>
    <path d="M19.500 21L20.500 14.500L25 19Z" fill="#f4b9a6"/><path d="M44.500 21L43.500 14.500L39 19Z" fill="#f4b9a6"/>
    <ellipse cx="32" cy="32" rx="15.500" ry="14" fill="#e8a93a"/>
    <g fill="#d98a2a"><path d="M32 18V24"/><rect x="29.500" y="18" width="1.400" height="6" rx=".7"/><rect x="33.100" y="18" width="1.400" height="6" rx=".7"/></g>
    ${eyes(31, 7, 2.200, '#2a2015')}<ellipse cx="25" cy="31" rx=".6" ry="2" fill="#e8a93a"/><ellipse cx="39" cy="31" rx=".6" ry="2" fill="#e8a93a"/>
    <path d="M30.300 36H33.700L32 38Z" fill="#c9604a"/><path d="M32 38V40M32 40Q29.500 42 27.500 40.500M32 40Q34.500 42 36.500 40.500" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>
    <g stroke="#fff" stroke-width=".8" opacity=".8"><path d="M14 36L23 37M14 40L23 39M50 36L41 37M50 40L41 39"/></g>`) },
  { kind: 'creature', name: 'Alien', draw: () => frame('#5d7d6a', `
    <path d="M14 70C14 56 22 52 32 52C42 52 50 56 50 70Z" fill="#2e4558"/>
    <path d="M32 12C47 12 50 28 44 38C41 43 37 46 32 46C27 46 23 43 20 38C14 28 17 12 32 12Z" fill="#a6d18a"/>
    <path d="M20.500 25C24 24 28 28 29 32C25 34 20 31 20.500 25Z" fill="${INK}"/><path d="M43.500 25C40 24 36 28 35 32C39 34 44 31 43.500 25Z" fill="${INK}"/>
    <circle cx="24" cy="28.500" r=".9" fill="#fff" opacity=".8"/><circle cx="40" cy="28.500" r=".9" fill="#fff" opacity=".8"/>
    <path d="M29 40Q32 42 35 40" fill="none" stroke="${INK}" stroke-width="1.200" stroke-linecap="round"/>`) },
  { kind: 'creature', name: 'Ghost', draw: () => frame('#3c5266', `
    <path d="M16 56V30C16 18 24 12 32 12C40 12 48 18 48 30V56L43 51L38 56L32 51L26 56L21 51Z" fill="#f3ecd8"/>
    <path d="M16 56V48L21 51L26 56L32 51L38 56L43 51L48 56V70H16Z" fill="#3c5266"/>
    ${eyes(30, 6, 2.800)}<ellipse cx="32" cy="38.500" rx="2.800" ry="3.200" fill="${INK}"/>
    <ellipse cx="22.500" cy="36" rx="2.600" ry="1.600" fill="#f4b9a6" opacity=".7"/><ellipse cx="41.500" cy="36" rx="2.600" ry="1.600" fill="#f4b9a6" opacity=".7"/>`) },
  { kind: 'creature', name: 'Frog', draw: () => frame('#8f6f33', `
    <path d="M10 70C10 54 20 50 32 50C44 50 54 54 54 70Z" fill="#4f7d45"/>
    <ellipse cx="32" cy="35" rx="17" ry="12.500" fill="#7bb25f"/>
    <circle cx="23" cy="22" r="7" fill="#7bb25f"/><circle cx="41" cy="22" r="7" fill="#7bb25f"/>
    <circle cx="23" cy="22" r="4.400" fill="#fff"/><circle cx="41" cy="22" r="4.400" fill="#fff"/>
    <circle cx="23.500" cy="22.500" r="2.300" fill="${INK}"/><circle cx="40.500" cy="22.500" r="2.300" fill="${INK}"/>
    <path d="M22 38Q32 46 42 38" fill="none" stroke="${INK}" stroke-width="1.500" stroke-linecap="round"/>
    <circle cx="29.500" cy="32" r=".9" fill="${INK}"/><circle cx="34.500" cy="32" r=".9" fill="${INK}"/>
    <ellipse cx="22" cy="38" rx="2.600" ry="1.600" fill="#f4b9a6" opacity=".6"/><ellipse cx="42" cy="38" rx="2.600" ry="1.600" fill="#f4b9a6" opacity=".6"/>`) },
  { kind: 'creature', name: 'Fox', draw: () => frame('#3c5266', `
    <path d="M10 70C10 54 20 50 32 50C44 50 54 54 54 70Z" fill="#d4551c"/>
    <path d="M15 28L17 9L29 19Z" fill="#d4551c"/><path d="M49 28L47 9L35 19Z" fill="#d4551c"/>
    <path d="M19 21L19.500 14L25 19Z" fill="${INK}"/><path d="M45 21L44.500 14L39 19Z" fill="${INK}"/>
    <path d="M32 17C42 17 50 24 50 31C50 38 42 46 32 46C22 46 14 38 14 31C14 24 22 17 32 17Z" fill="#e8742c"/>
    <path d="M14 31C18 40 25 40 32 36C39 40 46 40 50 31C50 38 42 46 32 46C22 46 14 38 14 31Z" fill="#f6ead2"/>
    ${eyes(29, 7, 1.700)}<path d="M30 38.500H34L32 41Z" fill="${INK}"/>`) },
]

/* ---------- the roster ---------- */

const P = (name: string, skin: number, hair: Person['hair'], style: Style, bg: number, cloth: number,
  extra: Partial<Person> = {}): Person => ({ kind: 'person', name, skin, hair, style, bg, cloth, ...extra })

const DEFS: Def[] = [
  P('Blonde, short', 0, 'blonde', 'short', 0, 0),
  P('Dark hair, side part', 0, 'dark', 'side', 1, 3),
  P('Brown hair, long', 1, 'brown', 'long', 2, 4),
  P('Black hair, bun', 1, 'black', 'bun', 4, 2),
  P('Red hair, freckles', 0, 'red', 'bob', 5, 0, { freckles: true }),
  P('Curly, dark', 4, 'black', 'curly', 3, 1),
  P('Bald, beard', 3, 'dark', 'bald', 0, 5, { beard: true }),
  P('Blonde, long', 0, 'blonde', 'long', 6, 4),
  P('Brown, glasses', 1, 'brown', 'short', 7, 0, { glasses: true }),
  P('Black, ponytail', 2, 'black', 'pony', 2, 3),
  P('Grey hair, glasses', 0, 'grey', 'side', 5, 5, { glasses: true }),
  P('Spiky, dark', 1, 'dark', 'spiky', 3, 2),
  P('Curly, brown', 3, 'brown', 'curly', 1, 0),
  P('Buzz cut', 4, 'black', 'buzz', 4, 1),
  P('Bob, black', 2, 'black', 'bob', 0, 2),
  P('Dark, beard', 2, 'dark', 'short', 6, 4, { beard: true }),
  P('Red, short', 0, 'red', 'short', 7, 3, { freckles: true }),
  P('Navy, long', 1, 'navy', 'long', 3, 1),
  P('Bun, glasses', 3, 'brown', 'bun', 2, 5, { glasses: true }),
  P('Curly, red', 2, 'red', 'curly', 5, 4),
  P('Bald', 5, 'dark', 'bald', 6, 0),
  P('Blonde, bob', 0, 'blonde', 'bob', 4, 3, { glasses: true }),
  ...creatures,
]

export const AVATAR_COUNT = DEFS.length
export const avatarName = (id: number) => DEFS[mod(id)].name

const mod = (id: number) => ((Math.trunc(id) % DEFS.length) + DEFS.length) % DEFS.length

export function avatarSvg(id: number): string {
  const d = DEFS[mod(id)]
  const inner = d.kind === 'person' ? person(d) : d.draw()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`
}

export function avatarUri(id: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(id))}`
}

const images = new Map<number, HTMLImageElement>()
/** A cached bitmap for canvas drawing; `.complete` is false until the first load finishes. */
export function avatarImage(id: number): HTMLImageElement {
  const k = mod(id)
  let img = images.get(k)
  if (!img) {
    img = new Image(128, 128)
    img.src = avatarUri(k)
    images.set(k, img)
  }
  return img
}

/** A stable avatar for an id, stepping past ones already taken so a meeting's people all differ. */
export function pickAvatar(key: string, taken: Set<number>): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let id = (h >>> 0) % AVATAR_COUNT
  for (let n = 0; n < AVATAR_COUNT && taken.has(id); n++) id = (id + 1) % AVATAR_COUNT
  return id
}

/** The avatar for each person in join order: the same answer on every screen and for every viewer. */
export function avatarsFor(ids: string[]): Map<string, number> {
  const taken = new Set<number>()
  const out = new Map<string, number>()
  for (const id of ids) {
    const a = pickAvatar(id, taken)
    taken.add(a)
    out.set(id, a)
  }
  return out
}
