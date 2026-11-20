import React from 'react'
import type { Prize } from './gift'

/** Картинка приза в стиле мини-аппа: эмаль, чёрный контур. */
export default function PrizeIcon({ prize, size = 56 }: { prize: Prize; size?: number }) {
  const ink = '#15100A'
  switch (prize) {
    case 'churchkhela':
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
          <path d="M30 3 V10" stroke="#5B4A3A" strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map(i => (
            <ellipse key={i} cx="30" cy={15 + i * 9} rx="9" ry="6" fill={i % 2 ? '#8E4424' : '#A0522D'} stroke={ink} strokeWidth="2.500" />
          ))}
        </svg>
      )
    case 'freeze':
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="26" fill="#D6ECFA" stroke={ink} strokeWidth="3" />
          <path d="M30 12 V48 M14 21 L46 39 M14 39 L46 21" stroke="#1B5FB0" strokeWidth="4" strokeLinecap="round" />
          <path d="M25 15 L30 20 L35 15 M25 45 L30 40 L35 45" stroke="#1B5FB0" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'boost':
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
          <rect x="4" y="10" width="52" height="40" rx="10" fill="#E01A3C" stroke={ink} strokeWidth="3" />
          <text x="30" y="38" textAnchor="middle" fontSize="22" fontWeight="800" fill="#FDFAEF" fontFamily="Manrope, system-ui, sans-serif">×2</text>
        </svg>
      )
    case 'friend':
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
          <rect x="9" y="24" width="42" height="30" rx="4" fill="#F5B820" stroke={ink} strokeWidth="3" />
          <rect x="6" y="16" width="48" height="11" rx="3" fill="#FCD76D" stroke={ink} strokeWidth="3" />
          <rect x="26" y="16" width="8" height="38" fill="#E01A3C" stroke={ink} strokeWidth="2.500" />
          <path d="M30 16 C 22 4, 10 8, 16 15 M30 16 C 38 4, 50 8, 44 15" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      )
  }
}
