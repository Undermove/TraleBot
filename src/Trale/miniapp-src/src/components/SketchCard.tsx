import React from 'react'

interface Props {
  children: React.ReactNode
  tilt?: 'none' | 'left' | 'right'
  corners?: boolean
  className?: string
  onClick?: () => void
  as?: 'div' | 'button'
  ariaLabel?: string
}

/**
 * Paper card with ink border, subtle shadow, optional corner marks and tilt.
 * Feels like a card slipped into a journal.
 */
export default function SketchCard({
  children,
  tilt = 'none',
  corners = false,
  className = '',
  onClick,
  as = 'div',
  ariaLabel
}: Props) {
  const tiltClass = tilt === 'left' ? 'tilt-l' : tilt === 'right' ? 'tilt-r' : ''
  const cornerClass = corners ? 'corner-marks' : ''
  const base = `sketch-card ${tiltClass} ${cornerClass} ${className}`.trim()

  if (as === 'button' || onClick) {
    return (
      <button
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${base} text-left w-full transition active:translate-y-0.5 active:shadow-paper`}
      >
        {children}
      </button>
    )
  }

  return <div className={base}>{children}</div>
}
