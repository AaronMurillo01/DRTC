import { Activity } from 'lucide-react'
import { useStore } from '../../store'
import type { SourceStatus } from '../../types'
import { Card } from '../ui/Card'
import { SourceCard } from './SourceCard'

export default function SystemHealth() {
  const sources = useStore((s) => s.sources)
  const list = Object.values(sources)
  const online = list.filter((s) => s.status === 'online').length
  const bit: SourceStatus =
    online === list.length ? 'online' : online === 0 ? 'offline' : 'degraded'
  const tone =
    bit === 'online' ? 'text-cmd-green' : bit === 'offline' ? 'text-cmd-red' : 'text-cmd-amber'

  return (
    <Card
      title="System Health"
      icon={Activity}
      meta={
        <span className={`font-mono text-[10px] ${tone}`}>
          {online}/{list.length} nominal
        </span>
      }
      bodyClassName="p-2"
    >
      {/* Auto-fit grid: reflows from 1 to N columns by available width, no
          manual breakpoints. min track keeps each card readable. */}
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(148px,1fr))]">
        {list.map((s) => (
          <SourceCard key={s.id} s={s} />
        ))}
      </div>
    </Card>
  )
}
