import React from 'react'

// Плитка с числом и график регистраций — как на экране статистики всегда были.

export function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

export function Tile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'navy' | 'ruby' | 'gold'
}) {
  const accentText =
    accent === 'navy'
      ? 'text-navy'
      : accent === 'ruby'
        ? 'text-ruby'
        : accent === 'gold'
          ? 'text-gold-deep'
          : 'text-jewelInk'
  return (
    <div className="jewel-tile px-3 py-3">
      <div className="relative z-[1]">
        <div className="mn-eyebrow text-jewelInk-mid mb-1">{label}</div>
        <div className={`font-sans text-[20px] font-extrabold tabular-nums leading-none ${accentText}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

export function SignupsChart({ points }: { points: { date: string; count: number }[] }) {
  if (points.length === 0) return <div className="text-center text-jewelInk-mid font-sans text-[12px]">нет данных</div>
  const w = 320
  const h = 120
  const max = Math.max(1, ...points.map((p) => p.count))
  const barW = w / points.length
  const total = points.reduce((sum, p) => sum + p.count, 0)
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        {points.map((p, i) => {
          const barH = (p.count / max) * (h - 16)
          const x = i * barW + barW * 0.15
          const bw = barW * 0.7
          return (
            <rect
              key={p.date}
              x={x}
              y={h - barH}
              width={bw}
              height={barH}
              fill="#0d4a6e"
              rx="1.5"
            />
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between font-sans text-[10px] text-jewelInk-mid">
        <span>{points[0]?.date}</span>
        <span className="font-bold">всего: {fmt(total)}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}
