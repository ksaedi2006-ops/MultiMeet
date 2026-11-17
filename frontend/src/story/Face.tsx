import Avatar from '../components/Avatar'
import { MOOD_RING, mood } from '../lib/fairness'

/** A person's picture, ringed by how they feel about a time when a score is given. */
export default function Face({ avatar, score, size = 28, title, className = '' }: {
  avatar: number; score?: number; size?: number; title?: string; className?: string
}) {
  const ring = score === undefined ? 'var(--color-board-line)' : MOOD_RING[mood(score)]
  return (
    <span title={title} className={`relative inline-flex shrink-0 rounded-full ${className}`}
      style={{ boxShadow: `0 0 0 2px var(--color-console), 0 0 0 4px ${ring}` }}>
      <Avatar id={avatar} size={size} />
    </span>
  )
}

export function MoodKey({ className = '' }: { className?: string }) {
  const item = (c: string, t: string) => (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ boxShadow: `0 0 0 2px ${c}` }} />{t}
    </span>
  )
  return (
    <p className={`flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mist ${className}`}>
      {item(MOOD_RING.likes, 'Likes it (70+)')}
      {item(MOOD_RING.okay, 'Okay')}
      {item(MOOD_RING.dislikes, 'Dislikes it (under 40)')}
    </p>
  )
}
