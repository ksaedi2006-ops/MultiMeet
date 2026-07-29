const STEPS = ['Create', 'Share', 'Calendar', 'Agent', 'Negotiate']

export default function StepHeader({ step }: { step: number }) {
  return (
    <div className="max-w-xl mx-auto px-5 sm:px-8 pt-8 pb-1">
      <div className="flex items-center flex-wrap gap-x-1 gap-y-2 font-mono text-[11px] tracking-wider">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className={
                i === step
                  ? 'text-seal font-semibold'
                  : i < step
                    ? 'text-brass'
                    : 'text-mist/50'
              }
            >
              {i < step ? '✓ ' : ''}
              {label.toUpperCase()}
            </span>
            {i < STEPS.length - 1 && <span className="text-ink-line mx-1">/</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
