import { useStore } from '../store'
import { fmtPrice } from '../utils'

export default function MarketTicker() {
  const markets = useStore((s) => s.markets)

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span>Markets Radar</span>
        <span className="text-cmd-dim normal-case tracking-normal">USD · 24h</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1">
        {markets.length === 0 && (
          <div className="col-span-2 text-center text-cmd-dim font-mono text-[10px] py-3">
            linking radar…
          </div>
        )}
        {markets.slice(0, 8).map((m) => {
          const up = m.changePct >= 0
          const color = up ? '#5b9c7b' : '#c2564a'
          return (
            <div
              key={m.symbol}
              className="flex items-center justify-between px-2 py-1 rounded bg-cmd-panel2/60 border border-cmd-border/50"
            >
              <span className="font-mono text-[10px] text-cmd-text font-medium">{m.symbol}</span>
              <div className="text-right">
                <div className="font-mono text-[10px] text-cmd-text">${fmtPrice(m.price)}</div>
                <div className="font-mono text-[8px]" style={{ color }}>
                  {up ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(1)}%
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
