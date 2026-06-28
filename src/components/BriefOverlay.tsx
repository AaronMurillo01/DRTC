import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useStore } from '../store'

export default function BriefOverlay() {
  const brief = useStore((s) => s.brief)
  const [open, setOpen] = useState(true)

  return (
    <div className="absolute top-14 left-2 w-72 max-w-[40%] panel bg-cmd-panel/90 backdrop-blur z-10 border-cmd-accent/30 hidden md:flex">
      <button
        onClick={() => setOpen((o) => !o)}
        className="panel-header w-full hover:text-cmd-text transition-colors"
      >
        <span className="flex items-center gap-1.5 text-cmd-accent">
          <FileText size={11} /> SITREP
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="p-3 text-[11px] leading-relaxed text-cmd-text/90 max-h-40 overflow-y-auto">
          {brief || 'Synthesizing situation report…'}
        </div>
      )}
    </div>
  )
}
