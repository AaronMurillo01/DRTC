import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_META, useStore } from '../store'
import type { EventCategory } from '../types'

interface Cmd {
  id: string
  label: string
  hint?: string
  run: () => void
}

export default function CommandPalette() {
  const open = useStore((s) => s.commandOpen)
  const setOpen = useStore((s) => s.setCommandOpen)
  const toggleCategory = useStore((s) => s.toggleCategory)
  const togglePause = useStore((s) => s.togglePause)
  const select = useStore((s) => s.select)
  const paused = useStore((s) => s.paused)
  const active = useStore((s) => s.activeCategories)

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Cmd[]>(() => {
    const layerCmds: Cmd[] = (
      ['seismic', 'disaster', 'space', 'orbital', 'signals'] as EventCategory[]
    ).map((cat) => ({
      id: `layer-${cat}`,
      label: `${active.has(cat) ? 'Hide' : 'Show'} ${CATEGORY_META[cat].label} layer`,
      hint: 'LAYER',
      run: () => toggleCategory(cat),
    }))
    return [
      {
        id: 'pause',
        label: paused ? 'Resume live feeds' : 'Pause live feeds',
        hint: 'SYSTEM',
        run: togglePause,
      },
      {
        id: 'focus',
        label: 'Focus highest-severity track',
        hint: 'NAV',
        run: () => {
          const top = [...useStore.getState().events]
            .filter((e) => e.lat != null)
            .sort((a, b) => b.severity - a.severity)[0]
          if (top) select(top.id)
        },
      },
      { id: 'clear', label: 'Clear selection', hint: 'NAV', run: () => select(null) },
      {
        id: 'clear-alerts',
        label: 'Clear all alerts',
        hint: 'SYSTEM',
        run: () => useStore.getState().clearAlerts(),
      },
      {
        id: 'reset-sev',
        label: 'Reset severity filter',
        hint: 'FILTER',
        run: () => useStore.getState().setMinSeverity(0),
      },
      ...layerCmds,
    ]
  }, [active, paused, toggleCategory, togglePause, select])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setCursor(0), [query])

  if (!open) return null

  const exec = (c?: Cmd) => {
    c?.run()
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[18vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[520px] max-w-[90vw] panel"
        style={{ boxShadow: '0 24px 60px -20px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cmd-border">
          <span className="font-mono text-cmd-accent text-sm">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setCursor((c) => Math.min(filtered.length - 1, c + 1))
              if (e.key === 'ArrowUp') setCursor((c) => Math.max(0, c - 1))
              if (e.key === 'Enter') exec(filtered[cursor])
            }}
            placeholder="Type a command…"
            className="flex-1 bg-transparent outline-none font-mono text-sm text-cmd-text placeholder:text-cmd-dim"
          />
          <span className="font-mono text-[9px] text-cmd-dim">ESC</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-3 py-3 font-mono text-[11px] text-cmd-dim">no matching command</div>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(c)}
              className={`w-full text-left flex items-center justify-between px-3 py-2 ${
                i === cursor ? 'bg-cmd-panel2' : ''
              }`}
            >
              <span className="text-[12px] text-cmd-text">{c.label}</span>
              {c.hint && (
                <span className="font-mono text-[8px] text-cmd-dim tracking-wider">{c.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
