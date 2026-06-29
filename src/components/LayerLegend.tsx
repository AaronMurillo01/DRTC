import { useState } from 'react'
import { ChevronDown, ChevronUp, Layers } from 'lucide-react'
import { CATEGORY_META, useStore } from '../store'
import type { EventCategory } from '../types'

// Toggleable map/globe layers (every category backed by a feed).
const LAYERS: EventCategory[] = [
  'signals',
  'seismic',
  'disaster',
  'weather',
  'air',
  'space',
  'orbital',
  'spaceport',
  'nuclear',
]

export default function LayerLegend() {
  const active = useStore((s) => s.activeCategories)
  const toggle = useStore((s) => s.toggleCategory)
  // Collapsed by default on small screens so it doesn't overlap the event card
  // on a short map; expanded on the roomy desktop layout.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280)

  return (
    <div className="absolute bottom-2 left-2 z-10 w-48 panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="panel-header w-full hover:text-cmd-text"
      >
        <span className="flex items-center gap-1.5">
          <Layers size={11} /> Layers
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="p-1.5 space-y-0.5">
          {LAYERS.map((cat) => {
            const meta = CATEGORY_META[cat]
            const on = active.has(cat)
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-cmd-panel2 transition-colors"
              >
                <span
                  className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                  style={{ borderColor: meta.color, background: on ? meta.color : 'transparent' }}
                >
                  {on && <span className="text-cmd-bg text-[9px] font-bold leading-none">✓</span>}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: on ? meta.color : '#5c6b7a' }}
                >
                  {meta.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
