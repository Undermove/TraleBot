import React from 'react'

interface Props {
  done: number
  total: number
  accent?: 'navy' | 'ruby' | 'gold'
  size?: 'sm' | 'md'
}

/**
 * Progress track drawn as a row of alternating up/down triangles — a kilim
 * zigzag pattern, directly echoing the kilim strip at the top and bottom
 * of every screen. Completed triangles are solid in the module's accent
 * colour, the current one is gold (highlighted), upcoming ones are cream.
 */
export default function KilimProgress({
  done,
  total,
  accent = 'navy',
  size = 'md'
}: Props) {
  if (total <= 0) return null

  const triWidth = size === 'sm' ? 11 : 14
  const triHeight = size === 'md' ? 22 : 18
  const strokeWidth = size === 'md' ? 1.5 : 1.2
  const padding = 1 // stroke overflow
  const w = triWidth * total + padding * 2
  const h = triHeight + padding * 2

  const accentColor =
    accent === 'navy' ? '#1B5FB0' : accent === 'ruby' ? '#E01A3C' : '#F5B820'
  const currentColor = '#F5B820' // always gold for "you are here"
  const emptyColor = '#F5EFE0'

  return (
    <div className="relative">
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMinYMid meet"
        style={{ maxWidth: `${w}px`, display: 'block' }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const x = padding + i * triWidth
          const isDone = i < done
          const isCurrent = i === done && done < total
          const isUp = i % 2 === 0

          // Up-pointing (apex at top): base at bottom
          // Down-pointing (apex at bottom): base at top
          const path = isUp
            ? `M ${x} ${padding + triHeight} L ${x + triWidth / 2} ${padding} L ${x + triWidth} ${padding + triHeight} Z`
            : `M ${x} ${padding} L ${x + triWidth / 2} ${padding + triHeight} L ${x + triWidth} ${padding} Z`

          const fill = isDone ? accentColor : isCurrent ? currentColor : emptyColor

          return (
            <path
              key={i}
              d={path}
              fill={fill}
              stroke="#15100A"
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              style={{ transition: 'fill 320ms ease-out' }}
            />
          )
        })}
      </svg>
    </div>
  )
}
