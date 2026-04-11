import React from 'react'

interface Props {
  mood?: 'happy' | 'cheer' | 'sleep' | 'think'
  size?: number
}

/**
 * Dog mascot — "Бомбора" (a friendly shiba-ish puppy).
 * Pure inline SVG, no external assets.
 */
export default function Mascot({ mood = 'happy', size = 140 }: Props) {
  const eyeY = mood === 'sleep' ? 92 : 86
  const eyeShape = mood === 'sleep'
    ? <><path d="M58 92 Q65 88 72 92" stroke="#1B1B2F" strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M98 92 Q105 88 112 92" stroke="#1B1B2F" strokeWidth="3" fill="none" strokeLinecap="round"/></>
    : <><circle cx="65" cy={eyeY} r="5" fill="#1B1B2F"/><circle cx="105" cy={eyeY} r="5" fill="#1B1B2F"/><circle cx="67" cy={eyeY - 2} r="1.5" fill="#fff"/><circle cx="107" cy={eyeY - 2} r="1.5" fill="#fff"/></>

  const mouth = mood === 'cheer'
    ? <path d="M76 108 Q85 120 94 108" stroke="#1B1B2F" strokeWidth="3" fill="#E94F4F" strokeLinecap="round"/>
    : <path d="M78 106 Q85 112 92 106" stroke="#1B1B2F" strokeWidth="3" fill="none" strokeLinecap="round"/>

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 170 170"
      className="anim-wag"
      style={{ display: 'block' }}
    >
      {/* ground shadow */}
      <ellipse cx="85" cy="155" rx="48" ry="6" fill="#000" opacity="0.08" />

      {/* ears back layer */}
      <path d="M30 50 Q25 20 55 30 L60 60 Z" fill="#C8782A" />
      <path d="M140 50 Q145 20 115 30 L110 60 Z" fill="#C8782A" />

      {/* head */}
      <ellipse cx="85" cy="95" rx="58" ry="52" fill="#F4A95A" />

      {/* cheek markings (shiba style) */}
      <ellipse cx="58" cy="110" rx="16" ry="12" fill="#FFFFFF" />
      <ellipse cx="112" cy="110" rx="16" ry="12" fill="#FFFFFF" />
      <ellipse cx="85" cy="122" rx="18" ry="12" fill="#FFFFFF" />

      {/* inner ears */}
      <path d="M38 48 Q36 30 52 36 L56 55 Z" fill="#FFD9B0" />
      <path d="M132 48 Q134 30 118 36 L114 55 Z" fill="#FFD9B0" />

      {/* eyes */}
      {eyeShape}

      {/* snout */}
      <ellipse cx="85" cy="108" rx="10" ry="7" fill="#FFFFFF" />
      <ellipse cx="85" cy="100" rx="5" ry="3.5" fill="#1B1B2F" />

      {/* mouth */}
      {mouth}

      {/* tongue peek when cheer */}
      {mood === 'cheer' && <ellipse cx="85" cy="115" rx="4" ry="3" fill="#E94F4F" />}

      {/* blush */}
      <circle cx="48" cy="112" r="4" fill="#FFB5B5" opacity="0.7" />
      <circle cx="122" cy="112" r="4" fill="#FFB5B5" opacity="0.7" />
    </svg>
  )
}
