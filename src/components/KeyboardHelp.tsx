import { useStore } from '../store'

const SHORTCUTS: [string, string][] = [
  ['⌘ / Ctrl + K', 'Open command palette'],
  ['Space', 'Pause / resume live feeds'],
  ['2 / 3 / G', '2D map · 3D terrain · stylized globe'],
  ['?', 'Toggle this help'],
  ['Esc', 'Close overlays / clear selection'],
  ['Click track', 'Select & fly to event'],
  ['Click country', 'Focus instability node'],
]

export default function KeyboardHelp() {
  const open = useStore((s) => s.helpOpen)
  const setOpen = useStore((s) => s.setHelpOpen)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[440px] max-w-[90vw] panel border-cmd-accent/40"
        style={{ boxShadow: '0 0 40px rgba(34,211,238,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <span>Keyboard &amp; Controls</span>
          <span className="text-cmd-dim">ESC</span>
        </div>
        <div className="p-3 space-y-1.5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[12px] text-cmd-text">{desc}</span>
              <kbd className="font-mono text-[10px] text-cmd-accent bg-cmd-panel2 border border-cmd-border rounded px-2 py-0.5">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
