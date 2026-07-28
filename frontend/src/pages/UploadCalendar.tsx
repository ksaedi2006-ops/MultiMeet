import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrCreateUserId, uploadCalendar } from '../api/client'
import StepHeader from '../components/StepHeader'

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
      const result = await uploadCalendar(userId, text)
      setFileName(file.name)
      setParsedCount(result.events_parsed)
    } catch {
      setError('Could not upload calendar. Make sure it is a valid .ics file.')
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
      <div className="max-w-md mx-auto px-8 py-12">
        <h1 className="text-3xl font-semibold mb-2">Upload your calendar</h1>
        <p className="text-gray-500 mb-8">
          Your agent uses this to know your hard blocks — classes, work, existing plans. Export an .ics
          file from Google/Outlook/Apple Calendar and drop it here.
        </p>

        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 transition"
          onClick={() => fileInput.current?.click()}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {loading ? (
            <p className="text-sm text-gray-500">Uploading…</p>
          ) : fileName ? (
            <p className="text-sm">
              {fileName} — {parsedCount} events parsed
            </p>
          ) : (
            <p className="text-sm text-gray-500">Click to choose an .ics file</p>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 mt-8">
          <button
            onClick={handleContinue}
            className="flex-1 bg-violet-600 text-white rounded-lg px-4 py-3 hover:bg-violet-700 transition"
          >
            Continue
          </button>
        </div>
        <button onClick={handleContinue} className="text-xs text-gray-500 mt-3 hover:text-violet-500">
          Skip for now
        </button>
      </div>
    </div>
  )
}
