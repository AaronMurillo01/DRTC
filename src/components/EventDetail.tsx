import { ExternalLink, X } from 'lucide-react'
import { CATEGORY_META, useStore } from '../store'
import { timeAgo } from '../utils'

export default function EventDetail() {
  const selectedId = useStore((s) => s.selectedId)
  const events = useStore((s) => s.events)
  const select = useStore((s) => s.select)

  const ev = events.find((e) => e.id === selectedId)
  if (!ev) return null
  const meta = CATEGORY_META[ev.category]

  return (
    <div
      className="absolute top-2 right-2 w-72 panel bg-cmd-panel/95 backdrop-blur z-10"
      style={{ borderColor: meta.color + '66', boxShadow: `0 0 24px ${meta.color}22` }}
    >
      <div className="panel-header" style={{ color: meta.color }}>
        <span>
          {meta.label} · SEV {ev.severity}
        </span>
        <button onClick={() => select(null)} className="hover:text-cmd-text">
          <X size={13} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-semibold text-cmd-text leading-snug">{ev.title}</div>
        <div className="text-[11px] text-cmd-dim leading-relaxed">{ev.summary}</div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Field label="SOURCE" value={ev.source} />
          <Field label="AGE" value={`${timeAgo(ev.timestamp)} ago`} />
          {ev.lat != null && <Field label="LAT" value={ev.lat.toFixed(2)} />}
          {ev.lng != null && <Field label="LON" value={ev.lng.toFixed(2)} />}
          {ev.meta &&
            Object.entries(ev.meta).map(([k, v]) => (
              <Field key={k} label={k.toUpperCase()} value={String(v)} />
            ))}
        </div>
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 mt-1 px-2 py-1.5 rounded border border-cmd-border hover:border-cmd-accent/60 font-mono text-[10px] text-cmd-accent transition-colors"
          >
            OPEN SOURCE <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cmd-panel2/60 rounded px-2 py-1 border border-cmd-border/50">
      <div className="font-mono text-[8px] text-cmd-dim tracking-wider">{label}</div>
      <div className="font-mono text-[10px] text-cmd-text truncate">{value}</div>
    </div>
  )
}
