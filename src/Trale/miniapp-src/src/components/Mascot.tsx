import React from 'react'

interface Props {
  mood?: 'happy' | 'cheer' | 'sleep' | 'think' | 'guide' | 'hungry' | 'sated' | 'chewing'
  /**
   * Satiety tier, only meaningful for mood="sated":
   *  1 = light snack (Дзвали/Хорци) — just content smile + heart
   *  2 = proper meal (Мцвади/Чурчхела) — table + plate with leftover
   *  3 = feast (Супра) — lemonade glass, bread, grapes, sparkles
   */
  satietyTier?: 1 | 2 | 3
  size?: number
  className?: string
}

/**
 * Бомбора — Picture Book illustration.
 * Flat shapes, thick ink outline, warm fur, ruby scarf.
 * Designed as a book illustration: less detail, more character.
 */
export default function Mascot({ mood = 'happy', satietyTier = 3, size = 200, className = '' }: Props) {
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
    ) : mood === 'hungry' ? (
      <g fill={INK}>
        <ellipse cx="80" cy="102" rx="5" ry="6.5" />
        <ellipse cx="122" cy="102" rx="5" ry="6.5" />
        <circle cx="78.5" cy="99" r="1.8" fill="#fff" />
        <circle cx="120.5" cy="99" r="1.8" fill="#fff" />
      </g>
    ) : mood === 'chewing' ? (
      /* Happy squinty eyes while chewing */
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M72 100 Q80 94 88 100" />
        <path d="M112 100 Q120 94 128 100" />
      </g>
    ) : mood === 'sated' ? (
      /* Contented half-closed eyes */
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M72 101 Q80 106 88 101" />
        <path d="M112 101 Q120 106 128 101" />
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
    ) : mood === 'hungry' ? (
      <g>
        <path
          d="M90 126 Q101 118 112 126"
          stroke={INK}
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* tiny drool */}
        <path
          d="M104 128 Q104 134 106 138"
          stroke={CORAL}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    ) : mood === 'chewing' ? (
      /* Pursed, chewing mouth — round-ish */
      <g>
        <ellipse cx="101" cy="123" rx="8" ry="5" fill={CORAL_DEEP} stroke={INK} strokeWidth="2.5" />
        {/* crumb */}
        <circle cx="92" cy="125" r="1.5" fill="#C98B4A" />
      </g>
    ) : mood === 'sated' ? (
      /* Big contented smile */
      <path
        d="M88 122 Q101 134 114 122"
        stroke={INK}
        strokeWidth="3"
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

      {/* Blush cheeks — extra pink when sated */}
      <circle cx="56" cy="132" r={mood === 'sated' ? 6.5 : 5} fill={CORAL} opacity={mood === 'sated' ? 0.5 : 0.35} />
      <circle cx="144" cy="132" r={mood === 'sated' ? 6.5 : 5} fill={CORAL} opacity={mood === 'sated' ? 0.5 : 0.35} />

      {/* ── Satiety accessories ── rendered only when sated. Tier cumulative: higher tier includes lower tier's vibe. */}
      {mood === 'sated' && satietyTier >= 1 && (
        /* Tier 1 — small floating heart near cheek (light snack) */
        <g>
          <path
            d="M40 98 C36 94 30 96 30 101 C30 105 34 108 40 112 C46 108 50 105 50 101 C50 96 44 94 40 98 Z"
            fill={CORAL}
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>
      )}

      {mood === 'sated' && satietyTier >= 2 && (
        /* Tier 2 — small plate on the left paw with a nibbled treat */
        <g>
          {/* Left paw */}
          <ellipse cx="32" cy="156" rx="14" ry="10" fill={FUR} stroke={INK} strokeWidth="2.5" />
          {/* Plate */}
          <ellipse cx="32" cy="148" rx="18" ry="5" fill={CREAM} stroke={INK} strokeWidth="2.2" />
          <ellipse cx="32" cy="147.5" rx="14" ry="3.2" fill="#FBEFD2" />
          {/* Leftover nibble — brown crumb */}
          <circle cx="28" cy="146" r="2.2" fill="#8A5A2A" stroke={INK} strokeWidth="1.2" />
          <circle cx="34" cy="145" r="1.6" fill="#8A5A2A" opacity="0.8" />
          {/* Tiny steam */}
          <path
            d="M30 142 Q28 138 32 134"
            stroke={INK}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            opacity="0.35"
          />
        </g>
      )}

      {mood === 'sated' && satietyTier >= 3 && (
        /* Tier 3 — full feast: lemonade glass raised + sparkles around */
        <g>
          {/* Right paw holding the glass */}
          <ellipse cx="168" cy="150" rx="12" ry="9" fill={FUR} stroke={INK} strokeWidth="2.5" />
          {/* Glass body */}
          <path
            d="M156 116 L180 116 L178 150 L158 150 Z"
            fill="#FFF8C2"
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
            opacity="0.95"
          />
          {/* Lemonade liquid */}
          <path
            d="M157 124 L179 124 L177.5 148 L158.5 148 Z"
            fill="#F5B820"
            opacity="0.85"
          />
          {/* Lemon slice */}
          <circle cx="168" cy="120" r="4" fill="#FFE070" stroke={INK} strokeWidth="1.5" />
          <path d="M164.5 120 L171.5 120" stroke={INK} strokeWidth="1" />
          <path d="M168 116.5 L168 123.5" stroke={INK} strokeWidth="1" />
          {/* Bubbles */}
          <circle cx="163" cy="132" r="1.3" fill="#fff" opacity="0.8" />
          <circle cx="172" cy="138" r="1" fill="#fff" opacity="0.8" />
          <circle cx="166" cy="142" r="1.2" fill="#fff" opacity="0.8" />
          {/* Straw */}
          <path
            d="M170 114 L174 102"
            stroke={CORAL}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Festive sparkles around Bombora */}
          <g fill="#F5B820" stroke={INK} strokeWidth="1">
            <path d="M14 70 L16 66 L18 70 L22 72 L18 74 L16 78 L14 74 L10 72 Z" opacity="0.9" />
            <path d="M186 76 L187.5 73 L189 76 L192 77 L189 78 L187.5 81 L186 78 L183 77 Z" opacity="0.9" />
          </g>
          {/* Confetti dots */}
          <circle cx="54" cy="34" r="2" fill="#E01A3C" opacity="0.8" />
          <circle cx="146" cy="30" r="2" fill="#2B4A7A" opacity="0.8" />
          <circle cx="100" cy="22" r="1.8" fill="#F5B820" opacity="0.9" />
        </g>
      )}
    </svg>
  )
}
