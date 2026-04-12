import React from 'react'

interface Props {
  label?: string
  size?: number
}

/**
 * Learning-first loader. A single big Georgian letter that breathes.
 * The user sees it many times during loading — and later, when they reach
 * it in the alphabet module, there's a reveal moment.
 *
 * Chosen letter: ქ (pronounced "k"), first letter of ქართული — "Georgian".
 */
export default function LoaderLetter({ label = 'ქართული...', size = 140 }: Props) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Letter — normal flow, no absolute positioning */}
      <div
        className="mn-loader-letter text-navy flex items-center justify-center"
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          height: `${size}px`
        }}
      >
        ქ
      </div>

      {/* Gold underline — sits below, separate element */}
      <div
        className="bg-gold rounded-full"
        style={{
          width: `${Math.round(size * 0.5)}px`,
          height: '4px'
        }}
      />

      {/* Label */}
      <div className="mn-eyebrow text-jewelInk-mid tracking-wider">{label}</div>
    </div>
  )
}
