import React from 'react'
import type { Direction, Toward } from './types'

// Маленькая схема направления в стиле иконок мини-аппа: тёмный контур, плоская заливка.
// Стрелка — куда идут; жёлтая точка — тот, кто говорит: «туда» — стрелка уходит от точки,
// «сюда» — приходит к ней. Декорация подсказывает направление: дверь, ступеньки, преграда.

const INK = '#15100A'
const GOLD = '#F5B820'

type Point = [number, number]

/** Откуда и куда стрелка на поле 48×48 и что нарисовано вокруг. */
const SHAPES: Record<Direction, { from: Point; to: Point; scenery: React.ReactNode; arc?: Point }> = {
  none: { from: [13, 24], to: [35, 24], scenery: null },
  // Дверной проём справа: стрелка входит внутрь.
  in: { from: [14, 24], to: [33, 24], scenery: <path d="M28 17V11h16v26H28v-6" /> },
  // Проём слева: стрелка выходит наружу.
  out: { from: [17, 24], to: [38, 24], scenery: <path d="M22 17V11H5v26h17v-6" /> },
  up: { from: [13, 29], to: [29, 11], scenery: <path d="M5 42h12V32h12V22h14" /> },
  down: { from: [19, 11], to: [35, 29], scenery: <path d="M5 22h12v10h12v10h14" /> },
  // Преграда посередине: стрелка перелетает через неё.
  across: { from: [10, 30], to: [38, 30], arc: [24, 2], scenery: <path d="M24 26v16" strokeWidth={5} stroke="#3A7FCC" /> }
}

const unit = (a: Point, b: Point): Point => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]
}

interface Props {
  direction: Direction
  toward: Toward
  size?: number
  className?: string
}

export default function DirectionGlyph({ direction, toward, size = 40, className = '' }: Props) {
  const { from, to, scenery, arc } = SHAPES[direction]
  // Наконечник смотрит по касательной: у дуги — от её вершины к концу.
  const [ux, uy] = unit(arc ?? from, to)
  const [sx, sy] = unit(from, arc ?? to)
  const head = `M${to[0] - ux * 7 - uy * 5} ${to[1] - uy * 7 + ux * 5}L${to[0]} ${to[1]}L${to[0] - ux * 7 + uy * 5} ${to[1] - uy * 7 - ux * 5}`
  const dot: Point = toward === 'here' ? [to[0] + ux * 8, to[1] + uy * 8] : [from[0] - sx * 7, from[1] - sy * 7]
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden data-testid="direction-glyph"
      data-direction={direction} data-toward={toward} className={`inline-block shrink-0 ${className}`}
      stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
    >
      <g stroke={INK} strokeOpacity={0.45} strokeWidth={2}>{scenery}</g>
      <path d={arc ? `M${from[0]} ${from[1]}Q${arc[0]} ${arc[1]} ${to[0]} ${to[1]}` : `M${from[0]} ${from[1]}L${to[0]} ${to[1]}`} strokeWidth={3} />
      <path d={head} strokeWidth={3} />
      <circle cx={dot[0]} cy={dot[1]} r={4} fill={GOLD} strokeWidth={1.8} />
    </svg>
  )
}

/** Точка из схемы — для подписи «это ты». */
export const SpeakerDot = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="inline-block align-[-0.05em]">
    <circle cx="6" cy="6" r="4.6" fill={GOLD} stroke={INK} strokeWidth={1.6} />
  </svg>
)
