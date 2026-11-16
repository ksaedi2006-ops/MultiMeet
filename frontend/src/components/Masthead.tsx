import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const formatLocal = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function Masthead() {
  const [time, setTime] = useState(() => formatLocal(new Date()))

  useEffect(() => {
    const id = setInterval(() => setTime(formatLocal(new Date())), 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="border-b border-board-line px-5 sm:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <span className="w-2.5 h-2.5 rounded-full bg-clearance group-hover:bg-amber transition-colors" aria-hidden />
        <span className="font-display font-bold tracking-[0.08em] text-lg leading-none">
          MEET<span className="text-signal group-hover:text-amber transition-colors">MIND</span>
        </span>
      </Link>
      <span className="font-mono text-xs text-mist tracking-wider tabular-nums hidden sm:inline">
        {time}
      </span>
    </header>
  )
}
