import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Иконки в стиле мини-аппа: плоская заливка, толстый тёмный контур. Эмодзи в интерфейсе не используем.
const INK = '#15100A'
const base = (size: number, className = '') => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', className: `inline-block align-[-0.15em] ${className}`,
  stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const
})
interface P { size?: number; className?: string }

export const BoneIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <g transform="rotate(-40 12 12)" fill="#FDFAEF">
      <circle cx="6" cy="9.6" r="2.7" /><circle cx="6" cy="14.4" r="2.7" />
      <circle cx="18" cy="9.6" r="2.7" /><circle cx="18" cy="14.4" r="2.7" />
      <rect x="6" y="9.8" width="12" height="4.4" stroke="none" />
      <path d="M8 9.8h8M8 14.2h8" />
    </g>
  </svg>
)

export const LetterIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="#FDFAEF" />
    <path d="M3.800 7.500l8.200 6 8.200-6" />
  </svg>
)

export const LockIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.500" />
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#F5B820" />
    <path d="M12 14.2v2.800" />
  </svg>
)

export const FlagIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M6 3.5v17.500" />
    <path d="M6 4.5h11.500l-3 4 3 4H6z" fill="#E01A3C" />
  </svg>
)

export const FlameIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 2.800c.6 3.200 4.800 5 4.800 10.200a4.800 4.800 0 0 1-9.600 0c0-2.200 1-3.600 2.200-4.600.1 1.700.9 2.600 1.900 2.600C12.300 8.500 11.200 6 12 2.800z" fill="#F5B820" />
  </svg>
)

export const FishIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M3 12c2.500-4 6-5.500 9.500-5.500S18 8 20 10l1.500-2v8L20 14c-2 2-4 3.500-7.500 3.500S5.500 16 3 12z" fill="#3A7FCC" />
    <circle cx="8" cy="11" r="0.9" fill={INK} stroke="none" />
  </svg>
)

export const ClockIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12.500" r="8" fill="#FCD76D" />
    <path d="M12 8v4.500l3 2M9.500 2.500h5" />
  </svg>
)

export const BlocksIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="8" width="6" height="8" rx="1.5" fill="#3A7FCC" />
    <rect x="9" y="8" width="6" height="8" rx="1.5" fill="#FDFAEF" />
    <rect x="15" y="8" width="6" height="8" rx="1.500" fill="#E01A3C" />
  </svg>
)

export const PointIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.4}>
    <path d="M4 12h14M12.500 6.500 18 12l-5.500 5.500" />
  </svg>
)

export const CloseIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

/** Разметка иконки строкой — для частиц конфетти, которые создаются мимо React. */
export const iconMarkup = (Icon: (p: P) => JSX.Element, size = 20) => renderToStaticMarkup(<Icon size={size} />)
