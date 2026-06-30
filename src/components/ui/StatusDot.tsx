import type { SourceStatus } from '../../types'

const STYLE: Record<SourceStatus, string> = {
  online: 'bg-cmd-green',
  degraded: 'bg-cmd-amber',
  offline: 'bg-cmd-red',
  pending: 'bg-cmd-dim animate-flicker',
}

export function StatusDot({ status, ring = false }: { status: SourceStatus; ring?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {ring && status === 'online' && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-cmd-green/60 animate-ping2" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${STYLE[status]}`} />
    </span>
  )
}
