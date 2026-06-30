import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

interface Props {
  data: number[]
  color: string
}

/** Compact Recharts area chart for the Global Threat Index history. */
export function ThreatHistoryChart({ data, color }: Props) {
  if (data.length < 2) return <div className="h-9" />
  const chartData = data.map((v, i) => ({ i, v }))
  const id = 'gti-grad'

  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[0, 100]} hide />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
          contentStyle={{
            background: '#0a0a0b',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 2,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            padding: '2px 6px',
          }}
          labelFormatter={() => ''}
          formatter={(value: number | string) => [`GTI ${value}`, '']}
          separator=""
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
