import { TIME_RANGES, useStore } from '../store'

export default function TimeRange() {
  const timeRange = useStore((s) => s.timeRange)
  const setTimeRange = useStore((s) => s.setTimeRange)

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-0.5 p-1 rounded-sm bg-cmd-bg/90 border border-cmd-border">
      {TIME_RANGES.map((r) => {
        const on = r.key === timeRange
        return (
          <button
            key={r.key}
            onClick={() => setTimeRange(r.key)}
            className={`px-2.5 py-1 rounded-sm font-mono text-[10px] tracking-wider transition-colors ${
              on
                ? 'bg-cmd-accent text-cmd-bg font-bold'
                : 'text-cmd-dim hover:text-cmd-text hover:bg-cmd-panel2'
            }`}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
