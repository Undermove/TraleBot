import React from 'react'
import type { Country } from '../story'

/** Флаги рисуем сами: Грузия, Испания, Франция. */
export function Flag({ code, size = 22 }: { code: Country['flag']; size?: number }) {
  const h = Math.round(size * 0.68)
  return (
    <svg width={size} height={h} viewBox="0 0 30 20" aria-hidden className="shrink-0 rounded-[2px] border border-jewelInk">
      {code === 'ge' && <>
        <rect width="30" height="20" fill="#FFF" />
        <rect x="12.5" width="5" height="20" fill="#E01A3C" /><rect y="7.5" width="30" height="5" fill="#E01A3C" />
        {[[6, 3.7], [24, 3.7], [6, 16.3], [24, 16.3]].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x - 0.6} ${y - 2}h1.2v1.4h1.4v1.2h-1.4v1.4h-1.2v-1.4h-1.4v-1.2h1.4z`} fill="#E01A3C" />
        ))}
      </>}
      {code === 'es' && <><rect width="30" height="20" fill="#C8102E" /><rect y="5" width="30" height="10" fill="#F5B820" /></>}
      {code === 'fr' && <><rect width="10" height="20" fill="#1B5FB0" /><rect x="10" width="10" height="20" fill="#FFF" /><rect x="20" width="10" height="20" fill="#E01A3C" /></>}
    </svg>
  )
}
