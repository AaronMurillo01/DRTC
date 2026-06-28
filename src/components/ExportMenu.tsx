import { useEffect, useRef, useState } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import { useStore } from '../store'
import { buildCOP, buildSITREP, downloadText } from '../services/report'

function snapshot() {
  const s = useStore.getState()
  return {
    brief: s.brief,
    threat: s.threat,
    events: s.events,
    countryRisk: s.countryRisk,
    markets: s.markets,
    generatedAt: Date.now(),
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:T]/g, '').slice(0, 13)
}

export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const exportSITREP = () => {
    downloadText(`DRTC_SITREP_${stamp()}Z.md`, buildSITREP(snapshot()), 'text/markdown')
    setOpen(false)
  }
  const exportCOP = () => {
    downloadText(`DRTC_COP_${stamp()}Z.json`, buildCOP(snapshot()), 'application/json')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Export products"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cmd-border hover:border-cmd-accent/60 font-mono text-[11px] text-cmd-dim hover:text-cmd-text transition-colors"
      >
        <Download size={12} /> EXPORT
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 panel bg-cmd-panel/95 backdrop-blur z-50">
          <button
            onClick={exportSITREP}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cmd-panel2 text-left"
          >
            <FileText size={13} className="text-cmd-accent" />
            <div>
              <div className="text-[11px] text-cmd-text">SITREP</div>
              <div className="font-mono text-[8px] text-cmd-dim">Markdown report</div>
            </div>
          </button>
          <button
            onClick={exportCOP}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cmd-panel2 text-left border-t border-cmd-border"
          >
            <FileJson size={13} className="text-cmd-green" />
            <div>
              <div className="text-[11px] text-cmd-text">COP Data</div>
              <div className="font-mono text-[8px] text-cmd-dim">JSON snapshot</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
