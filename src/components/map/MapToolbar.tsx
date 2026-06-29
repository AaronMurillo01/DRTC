import type { LucideIcon } from 'lucide-react'

export interface MapTool {
  on: boolean
  set: () => void
  icon: LucideIcon
  label: string
}

export function MapToolbar({ tools }: { tools: MapTool[] }) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 p-1 rounded-xl bg-cmd-panel/85 backdrop-blur-md border border-white/10 shadow-lg">
      {tools.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.label}
            onClick={t.set}
            title={t.label}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-mono text-[9px] tracking-wider transition-colors ${
              t.on ? 'bg-cmd-accent text-cmd-bg font-bold' : 'text-cmd-dim hover:text-cmd-text'
            }`}
          >
            <Icon size={13} />
            <span className="hidden lg:inline">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CoordReadout({
  coord,
}: {
  coord: { lat: number; lng: number; mgrs: string } | null
}) {
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 hidden md:flex items-center gap-3 px-3 py-1 rounded-xl bg-cmd-panel/85 backdrop-blur-md border border-white/10 font-mono text-[10px]">
      <span className="text-cmd-dim">MGRS</span>
      <span className="text-cmd-accent w-44 text-center">{coord ? coord.mgrs : '——'}</span>
      <span className="text-white/15">|</span>
      <span className="text-cmd-text w-32 text-center">
        {coord ? `${coord.lat.toFixed(3)}, ${coord.lng.toFixed(3)}` : '——'}
      </span>
    </div>
  )
}
