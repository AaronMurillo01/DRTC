import type { LucideIcon } from 'lucide-react'

export interface MapTool {
  on: boolean
  set: () => void
  icon: LucideIcon
  label: string
}

export function MapToolbar({ tools }: { tools: MapTool[] }) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 p-1 rounded-sm bg-cmd-bg/90 border border-cmd-border">
      {tools.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.label}
            onClick={t.set}
            title={t.label}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-sm font-mono text-[9px] uppercase tracking-wider transition-colors ${
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
