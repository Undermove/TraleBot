import React from 'react'

interface Props {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'green' | 'blue' | 'ghost'
  disabled?: boolean
  className?: string
}

/**
 * Minanka jewel button — solid fill, ink border, offset shadow, tactile press.
 * Variants keep their legacy names so existing screen code keeps working.
 */
export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = ''
}: Props) {
  const styles: Record<string, string> = {
    // primary → navy (main CTA across the app)
    primary: 'bg-navy text-cream',
    // green → ruby (success/confirmation — stays bright)
    green: 'bg-ruby text-cream',
    // blue → gold-deep (secondary — warm highlight)
    blue: 'bg-gold text-jewelInk',
    // ghost → cream tile (neutral secondary)
    ghost: 'bg-cream-tile text-jewelInk'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`jewel-btn ${styles[variant]} w-full ${className}`}
    >
      <span className="relative z-[1]">{children}</span>
    </button>
  )
}
