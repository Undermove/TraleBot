import React from 'react'
import type { Prize } from './gift'
import { FurnThumb, ItemThumb } from './CollectionThumbs'
import { ITEMS } from './collection'
import TreatIcon from '../components/TreatIcon'

/** Картинка приза в стиле мини-аппа: эмаль, чёрный контур. */
export default function PrizeIcon({ prize, size = 56, days = 1, ka }: { prize: Prize; size?: number; days?: number; ka?: string }) {
  const ink = '#15100A'
  const [kind, id] = prize.includes(':') ? prize.split(':') : [prize, '']
  if (kind === 'item') {
    const item = ITEMS.find(i => i.id === id)
    return item ? <div style={{ width: size }}><ItemThumb item={item} owned className="h-14 w-full" /></div> : null
  }
  if (kind === 'furn') return <div style={{ width: size }}><FurnThumb id={id} className="h-14 w-full" /></div>
  if (kind === 'word' || kind === 'card') {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
        {kind === 'card'
          ? <><rect x="4" y="12" width="52" height="38" rx="5" fill="#FDFAEF" stroke={ink} strokeWidth="3" /><path d="M4 18 L30 36 L56 18" fill="none" stroke="#E01A3C" strokeWidth="3" strokeLinejoin="round" /></>
          : <><path d="M10 8 H44 L52 16 V54 H10 Z" fill="#FCD76D" stroke={ink} strokeWidth="3" strokeLinejoin="round" /><path d="M44 8 V16 H52" fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" /></>}
        <text x="30" y={kind === 'card' ? 47 : 42} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1B5FB0" fontFamily="Noto Sans Georgian, sans-serif">{(ka ?? 'ბ').slice(0, 1)}</text>
      </svg>
    )
  }
  if (kind === 'hint') {
    return (
      <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
        <path d="M30 6 a16 16 0 0 1 10 28 v6 H20 v-6 A16 16 0 0 1 30 6 Z" fill="#FCD76D" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M21 46 H39 M23 52 H37" stroke={ink} strokeWidth="3.500" strokeLinecap="round" />
        <path d="M30 18 v10" stroke="#E01A3C" strokeWidth="3.500" strokeLinecap="round" />
      </svg>
    )
  }
  switch (kind) {
    case 'churchkhela':
      return <TreatIcon index={3} size={size} />
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
    case 'days':
      return (
        <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
          <rect x="6" y="10" width="48" height="44" rx="7" fill="#FDFAEF" stroke={ink} strokeWidth="3" />
          <path d="M6 22 H54 V17 a7 7 0 0 0 -7 -7 H13 a7 7 0 0 0 -7 7 Z" fill="#E01A3C" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M19 5 V15 M41 5 V15" stroke={ink} strokeWidth="3.500" strokeLinecap="round" />
          <text x="30" y="46" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1B5FB0" fontFamily="Manrope, system-ui, sans-serif">+{days}</text>
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
