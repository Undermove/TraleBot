import React from 'react'

interface Props {
  children: React.ReactNode
  color?: 'wine' | 'moss' | 'saffron' | 'sky' | 'ink' | 'ruby' | 'navy' | 'gold'
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
  // Minankari-native colors
  const minankariColorClass =
    color === 'ruby'
      ? 'text-ruby border-ruby'
      : color === 'navy'
      ? 'text-navy border-navy'
      : color === 'gold'
      ? 'text-gold-deep border-gold-deep'
      : null

  // Legacy color mapping → Minankari equivalents
  const legacyColorClass =
    color === 'wine'
      ? 'text-ruby border-ruby'
      : color === 'saffron'
      ? 'text-gold-deep border-gold-deep'
      : color === 'sky'
      ? 'text-navy border-navy'
      : color === 'moss'
      ? 'text-jewelInk border-jewelInk'
      : 'text-jewelInk border-jewelInk'

  const colorClass = minankariColorClass ?? legacyColorClass

  const tiltClass = tilt === 'left' ? 'rotate-xs' : 'rotate-xs-r'
  const animClass = animate ? (tilt === 'left' ? 'anim-stamp' : 'anim-stamp-r') : tiltClass

  return (
    <span className={`stamp ${colorClass} ${animClass} ${className}`}>{children}</span>
  )
}
