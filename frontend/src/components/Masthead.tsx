import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function formatUTC(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function Masthead() {
  const [time, setTime] = useState(() => formatUTC(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTime(formatUTC(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="border-b border-ink-line px-5 sm:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <span className="w-2 h-2 rounded-full bg-seal group-hover:bg-brass transition-colors" />
        <span className="font-mono tracking-[0.2em] text-sm font-medium">MEETMIND</span>
      </Link>
      <span className="font-mono text-xs text-mist tracking-wider tabular-nums hidden sm:inline">
        {time} UTC
      </span>
    </header>
  )
}
