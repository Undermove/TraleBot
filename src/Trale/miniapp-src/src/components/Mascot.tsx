import React from 'react'

interface Props {
  mood?: 'happy' | 'cheer' | 'sleep' | 'think' | 'guide'
  size?: number
  className?: string
}

/**
 * Бомбора — Picture Book illustration.
 * Flat shapes, thick ink outline, warm fur, ruby scarf.
 * Designed as a book illustration: less detail, more character.
 */
export default function Mascot({ mood = 'happy', size = 200, className = '' }: Props) {
  const INK = '#2A1F18'
  const FUR = '#E6AE78'
  const FUR_DARK = '#C98B4A'
  const CREAM = '#FDF6EA'
  const CORAL = '#E01A3C'
  const CORAL_DEEP = '#A61026'
  const NOSE = '#2A1F18'

  const eyes =
    mood === 'sleep' ? (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M72 102 Q80 96 88 102" />
        <path d="M112 102 Q120 96 128 102" />
      </g>
    ) : mood === 'think' ? (
      <g fill={INK}>
        <ellipse cx="80" cy="100" rx="4" ry="5.5" />
        <ellipse cx="122" cy="100" rx="4" ry="5.5" />
        <circle cx="78.5" cy="98" r="1.3" fill="#fff" />
        <circle cx="120.5" cy="98" r="1.3" fill="#fff" />
      </g>
    ) : (
      <g fill={INK}>
        <circle cx="80" cy="100" r="5.5" />
        <circle cx="122" cy="100" r="5.5" />
        <circle cx="82" cy="98" r="1.8" fill="#fff" />
        <circle cx="124" cy="98" r="1.8" fill="#fff" />
      </g>
    )

  const mouth =
    mood === 'cheer' ? (
      <g>
        <path
          d="M88 122 Q101 138 114 122 Q101 128 88 122 Z"
          fill={CORAL_DEEP}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M93 128 Q101 133 109 128"
          stroke={CORAL}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ) : mood === 'sleep' ? (
      <path
        d="M93 122 Q101 126 109 122"
        stroke={INK}
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M90 120 Q101 128 112 120"
        stroke={INK}
        strokeWidth="2.8"
        fill="none"
        strokeLinecap="round"
      />
    )

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`pb-breath ${className}`}
      style={{ display: 'block' }}
    >
      {/* Ground shadow */}
      <ellipse cx="100" cy="188" rx="58" ry="5" fill="#2A1F18" opacity="0.08" />

      {/* Scarf — ruby wrap under chin */}
      <g>
        <path
          d="M38 138 Q68 162 100 156 Q132 162 162 138 L168 176 Q132 186 100 180 Q68 186 32 176 Z"
          fill={CORAL}
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M68 152 Q100 160 132 152"
          stroke={INK}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M50 172 Q44 184 56 192 L72 186 L68 172 Z"
          fill={CORAL}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      {/* Ears */}
      <path d="M28 56 Q22 20 58 36 L66 66 Z" fill={FUR_DARK} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M172 56 Q178 20 142 36 L134 66 Z" fill={FUR_DARK} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />

      {/* Head */}
      <ellipse cx="100" cy="108" rx="66" ry="60" fill={FUR} stroke={INK} strokeWidth="3.5" />

      {/* Cream muzzle/cheeks */}
      <path
        d="M50 118 Q42 142 58 152 Q72 160 86 154 Q94 148 100 148 Q106 148 114 154 Q128 160 142 152 Q158 142 150 118 Q138 108 122 114 Q110 120 100 120 Q90 120 78 114 Q62 108 50 118 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Inner ears */}
      <path d="M38 52 Q34 32 54 42 L58 62 Z" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      <path d="M162 52 Q166 32 146 42 L142 62 Z" fill={CREAM} stroke={INK} strokeWidth="2.5" />

      {/* Eyebrows */}
      <path d="M70 86 L82 84" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M118 84 L130 86" stroke={INK} strokeWidth="3" strokeLinecap="round" />

      {/* Eyes */}
      {eyes}

      {/* Nose bridge */}
      <path d="M100 118 L100 122" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />

      {/* Nose */}
      <ellipse cx="100" cy="116" rx="6" ry="4.5" fill={NOSE} />
      <ellipse cx="98" cy="114.5" rx="1.3" ry="1" fill="#fff" />

      {/* Mouth */}
      {mouth}

      {/* Blush cheeks */}
      <circle cx="56" cy="132" r="5" fill={CORAL} opacity="0.35" />
      <circle cx="144" cy="132" r="5" fill={CORAL} opacity="0.35" />
    </svg>
  )
}
