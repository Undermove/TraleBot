import React from 'react'

interface Props {
  variant?: 'line' | 'wave' | 'ornament'
  className?: string
}

/**
 * Divider drawn in ink. Three flavours:
 *  - line: thin ink rule with end-caps
 *  - wave: hand-drawn wavy underline
 *  - ornament: line — small flourish — line
 */
export default function InkDivider({ variant = 'ornament', className = '' }: Props) {
  if (variant === 'line') {
    return (
      <svg
        className={`w-full h-3 text-ink ${className}`}
        viewBox="0 0 200 8"
        preserveAspectRatio="none"
      >
        <line
          x1="2"
          y1="4"
          x2="198"
          y2="4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="2" cy="4" r="1.5" fill="currentColor" />
        <circle cx="198" cy="4" r="1.5" fill="currentColor" />
      </svg>
    )
  }

  if (variant === 'wave') {
    return (
      <svg
        className={`w-full h-4 text-wine ${className}`}
        viewBox="0 0 200 10"
        preserveAspectRatio="none"
      >
        <path
          d="M0 5 Q 12 1 24 5 T 48 5 T 72 5 T 96 5 T 120 5 T 144 5 T 168 5 T 200 5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // ornament — line / tiny flourish / line
  return (
    <div className={`flex items-center gap-3 text-ink/60 ${className}`}>
      <div className="flex-1 h-px bg-current" />
      <svg width="24" height="14" viewBox="0 0 24 14" className="text-wine shrink-0">
        <path
          d="M2 7 Q 6 2 10 7 T 18 7"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="12" cy="7" r="1.6" fill="currentColor" />
        <circle cx="2" cy="7" r="1" fill="currentColor" />
        <circle cx="22" cy="7" r="1" fill="currentColor" />
      </svg>
      <div className="flex-1 h-px bg-current" />
    </div>
  )
}
