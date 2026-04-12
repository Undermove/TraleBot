import React from 'react'

interface Props {
  char: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Large faded Georgian letter used as background decor.
 */
export default function GeoGlyph({ char, className = '', style }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none select-none font-geo text-paper-shade/60 ${className}`}
      style={style}
    >
      {char}
    </span>
  )
}
