import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrCreateUserId, uploadCalendar } from '../api/client'
import StepHeader from '../components/StepHeader'
import Strip from '../components/Strip'
import Button from '../components/Button'

export default function UploadCalendar() {
  const { eventId = '' } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedCount, setParsedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)
    try {
      const text = await file.text()
      const userId = await getOrCreateUserId()
      const result = await uploadCalendar(userId, text, file.name, eventId)
      setFileName(file.name)
      setParsedCount(result.events.length)
    } catch {
      setError('Could not read that file. Make sure it is a valid .ics export.')
    } finally {
      setLoading(false)
    }
  }

  function handleContinue() {
    navigate(`/event/${eventId}/agent`)
  }

  return (
    <div>
      <StepHeader step={2} />
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10">
        <Strip className="p-8 sm:p-10">
          <p className="font-mono text-[11px] tracking-[0.25em] text-clearance mb-4">MANIFEST</p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight mb-3 tracking-tight">
            Upload your calendar
          </h1>
          <p className="text-strip-ink/70 mb-8 leading-relaxed">
            Your agent uses this to know your hard blocks — classes, work, plans already made. Export an
            .ics file from Google, Outlook, or Apple Calendar and drop it here.
          </p>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
            className="border-2 border-dashed border-strip-ink/25 rounded-sm p-10 text-center cursor-pointer hover:border-clearance transition-colors"
          >
            <input
              ref={fileInput}
              type="file"
              accept=".ics"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {loading ? (
              <p className="font-mono text-sm text-mist">READING FILE…</p>
            ) : fileName ? (
              <p className="font-mono text-sm">
                <span className="text-amber">✓</span> {fileName} — {parsedCount} events parsed
              </p>
            ) : (
              <p className="font-mono text-sm text-strip-ink/50">CLICK TO CHOOSE AN .ICS FILE</p>
            )}
          </div>
          {error && <p className="mt-3 font-mono text-sm text-clearance">{error}</p>}

          <div className="flex items-center gap-6 mt-8">
            <Button onClick={handleContinue} className="flex-1">
              CONTINUE →
            </Button>
            <Button variant="quiet" onClick={handleContinue}>
              SKIP FOR NOW
            </Button>
          </div>
        </Strip>
      </div>
    </div>
  )
}
