const STEPS = ['Create', 'Share', 'Calendar', 'Agent', 'Negotiate']

export default function StepHeader({ step }: { step: number }) {
  return (
    <div className="max-w-2xl mx-auto px-8 pt-8 pb-2">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-800'
              }`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">{STEPS[step]}</p>
    </div>
  )
}
