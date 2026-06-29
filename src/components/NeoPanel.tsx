import { Orbit } from 'lucide-react'
import { useStore } from '../store'

// Compact distance: lunar distances (LD) is the intuitive unit for close passes.
function dist(n: { missLunar: number; missKm: number }): string {
  if (n.missLunar && n.missLunar < 100) return `${n.missLunar} LD`
  return `${(n.missKm / 1_000_000).toFixed(1)}M km`
}

export default function NeoPanel() {
  const neos = useStore((s) => s.neos)
  const top = neos.slice(0, 6)
  const hazards = neos.filter((n) => n.hazardous).length

  return (
    <div className="panel shrink-0">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Orbit size={11} /> Near-Earth Objects
        </span>
        <span className="text-cmd-dim normal-case tracking-normal">
          NASA · {hazards ? `${hazards} PHA` : 'today'}
        </span>
      </div>
      <div className="p-2 space-y-1">
        {top.length === 0 && (
          <div className="text-center text-cmd-dim font-mono text-[10px] py-3">tracking…</div>
        )}
        {top.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm bg-white/[0.02] border border-white/5"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.hazardous ? 'bg-cmd-red' : 'bg-[#c4b5fd]'}`}
              title={n.hazardous ? 'Potentially hazardous' : 'Not hazardous'}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-cmd-text truncate">{n.name}</div>
              <div className="font-mono text-[8px] text-cmd-dim">
                ~{n.diameterM} m · {Math.round(n.velocityKmh / 1000)}k km/h
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[10px] text-cmd-text">{dist(n)}</div>
              <div className="font-mono text-[8px] text-cmd-dim">miss</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
