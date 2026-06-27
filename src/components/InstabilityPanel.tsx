import { useStore } from '../store'

function scoreColor(score: number): string {
  if (score >= 75) return '#f87171'
  if (score >= 55) return '#fb923c'
  if (score >= 38) return '#fbbf24'
  return '#34d399'
}

export default function InstabilityPanel() {
  const risk = useStore((s) => s.countryRisk)
  const top = risk.slice(0, 8)

  return (
    <div className="panel flex-1 min-h-[180px]">
      <div className="panel-header">
        <span>◢ Instability Index</span>
        <span className="text-cmd-dim normal-case tracking-normal">DRTC-CII</span>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 p-2 space-y-1.5">
        {top.length === 0 && (
          <div className="text-center text-cmd-dim font-mono text-[10px] py-4">computing…</div>
        )}
        {top.map((c, i) => {
          const color = scoreColor(c.score)
          return (
            <div key={c.iso} className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-cmd-dim w-4 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] text-cmd-text w-7 shrink-0">{c.iso}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cmd-text truncate">{c.name}</span>
                  <span className="font-mono text-[10px] font-bold shrink-0" style={{ color }}>
                    {c.score}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-cmd-border overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${c.score}%`, background: color }}
                  />
                </div>
                <div className="font-mono text-[8px] text-cmd-dim truncate mt-0.5">
                  {c.drivers.join(' · ')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
