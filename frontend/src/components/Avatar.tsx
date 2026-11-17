import { avatarUri } from '../lib/avatars'

/** A person's round picture. Decorative: their name always sits beside it. */
export default function Avatar({ id, size = 32, className = '' }: { id: number; size?: number; className?: string }) {
  return <img src={avatarUri(id)} width={size} height={size} alt="" draggable={false}
    className={`shrink-0 rounded-full ${className}`} />
}
