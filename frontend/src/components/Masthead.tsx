import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function formatZulu(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function Masthead() {
  const [time, setTime] = useState(() => formatZulu(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTime(formatZulu(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="border-b border-board-line px-5 sm:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <span className="w-2.5 h-2.5 rounded-full bg-clearance group-hover:bg-amber transition-colors" />
        <span className="font-display font-bold tracking-[0.08em] text-lg leading-none">
          MEET<span className="text-clearance group-hover:text-amber transition-colors">MIND</span>
        </span>
      </Link>
      <span className="font-mono text-xs text-mist tracking-wider tabular-nums hidden sm:inline">
        {time}Z
      </span>
    </header>
  )
}
