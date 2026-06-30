import { History, Radio } from 'lucide-react'
import { frameAt, useStore } from '../store'

function clock(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19) + 'Z'
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return `${m}m ago`
}

export default function ReplayBar() {
  const frames = useStore((s) => s.replayFrames)
  const replayAt = useStore((s) => s.replayAt)
  const setReplayAt = useStore((s) => s.setReplayAt)

  // Need at least a couple of frames to scrub between.
  if (frames.length < 2) return null

  const min = frames[0].ts
  const max = frames[frames.length - 1].ts
  const live = replayAt == null
  const value = replayAt ?? max
  const frame = frameAt(frames, value)

  const onChange = (v: number) => {
    // Snapping to the newest frame returns to following live.
    setReplayAt(v >= max ? null : v)
  }

  return (
    <div className="panel shrink-0 px-2.5 py-1.5 flex items-center gap-3">
      <button
        onClick={() => setReplayAt(live ? min : null)}
        className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider shrink-0 px-1.5 py-1 rounded-sm border transition-colors ${
          live
            ? 'border-cmd-green/40 text-cmd-green'
            : 'border-cmd-accent text-cmd-accent bg-cmd-accent/10'
        }`}
        title={live ? 'Scrub to the start of the buffer' : 'Return to live'}
      >
        {live ? <Radio size={11} /> : <History size={11} />}
        {live ? 'LIVE' : 'REPLAY'}
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={1000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-cmd-accent h-1 min-w-0"
        aria-label="replay timeline"
      />

      <div className="font-mono text-[10px] shrink-0 text-right tabular-nums">
        {live ? (
          <span className="text-cmd-green">live</span>
        ) : (
          <span className="text-cmd-text">
            {clock(value)} <span className="text-cmd-dim">· {ago(max - value)}</span>
          </span>
        )}
        {frame && <span className="hidden sm:inline text-cmd-dim"> · GTI {frame.index}</span>}
      </div>
    </div>
  )
}
