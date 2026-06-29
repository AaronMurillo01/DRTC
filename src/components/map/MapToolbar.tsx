import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface MapTool {
  on: boolean
  set: () => void
  icon: LucideIcon
  label: string
}

export function MapToolbar({ tools }: { tools: MapTool[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const anyOn = tools.some((t) => t.on)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <>
      {/* Wide desktop: inline strip with labels */}
      <div className="hidden xl:flex absolute top-2 right-2 z-10 items-center gap-1 p-1 rounded-sm bg-cmd-bg/90 border border-cmd-border">
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
              <span className="hidden 2xl:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Phone / tablet: single button that opens a tool menu */}
      <div className="xl:hidden absolute top-2 right-2 z-30" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Map tools"
          className={`flex items-center justify-center w-9 h-9 rounded-sm border transition-colors ${
            open || anyOn
              ? 'border-cmd-accent text-cmd-accent bg-cmd-accent/10'
              : 'border-cmd-border text-cmd-dim bg-cmd-bg/90'
          }`}
        >
          {open ? <X size={15} /> : <SlidersHorizontal size={15} />}
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-40 panel">
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.label}
                  onClick={t.set}
                  className="w-full flex items-center gap-2 px-3 py-2 border-b border-cmd-border/60 last:border-0 hover:bg-cmd-panel2 transition-colors"
                >
                  <Icon size={13} className={t.on ? 'text-cmd-accent' : 'text-cmd-dim'} />
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider flex-1 text-left ${
                      t.on ? 'text-cmd-text' : 'text-cmd-dim'
                    }`}
                  >
                    {t.label}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${t.on ? 'bg-cmd-accent' : 'bg-cmd-border'}`}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
