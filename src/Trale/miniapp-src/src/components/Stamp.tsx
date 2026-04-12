import React from 'react'

interface Props {
  children: React.ReactNode
  color?: 'wine' | 'moss' | 'saffron' | 'sky' | 'ink'
  tilt?: 'left' | 'right'
  animate?: boolean
  className?: string
}

/**
 * Rubber stamp — double border, slight rotation, uppercase tracked caps.
 */
export default function Stamp({
  children,
  color = 'wine',
  tilt = 'left',
  animate = false,
  className = ''
}: Props) {
  const colorClass =
    color === 'wine'
      ? 'text-wine border-wine'
      : color === 'moss'
      ? 'text-moss border-moss'
      : color === 'saffron'
      ? 'text-saffron-deep border-saffron-deep'
      : color === 'sky'
      ? 'text-sky-deep border-sky-deep'
      : 'text-ink border-ink'

  const tiltClass = tilt === 'left' ? 'rotate-xs' : 'rotate-xs-r'
  const animClass = animate ? (tilt === 'left' ? 'anim-stamp' : 'anim-stamp-r') : tiltClass

  return (
    <span className={`stamp ${colorClass} ${animClass} ${className}`}>{children}</span>
  )
}
