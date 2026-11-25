import React from 'react'
import { Glasses, Hat, NeckExtra, ScarfPattern, scarfFill } from '../components/BomboraWear'
import { Furniture } from './BomboraRoom'
import type { ItemInfo } from './collection'

// Значки вещей и мебели — в гардеробе, в комнате и на карточке приза.

/** Значок вещи: Бомбора в ней (маленький). */
export function ItemThumb({ item, owned, className = 'h-12 w-full' }: { item: ItemInfo; owned: boolean; className?: string }) {
  return (
    <svg viewBox={item.slot === 'neck' ? '20 120 160 80' : item.slot === 'eyes' ? '40 70 120 60' : '30 0 140 90'} className={className} aria-hidden="true"
      style={owned ? undefined : { filter: 'brightness(0) opacity(.18)' }}>
      {item.slot === 'neck' ? (
        <g>
          <path d="M38 138 Q68 162 100 156 Q132 162 162 138 L168 176 Q132 186 100 180 Q68 186 32 176 Z" fill={scarfFill(item.id)} stroke="#2A1F18" strokeWidth="3.5" strokeLinejoin="round" />
          <ScarfPattern neck={item.id} />
          <NeckExtra neck={item.id} />
        </g>
      ) : item.slot === 'eyes' ? <Glasses id={item.id} /> : <Hat id={item.id} />}
    </svg>
  )
}


/** Где в комнате 360×240 нарисована каждая вещь — для значков. */
export const FURN_VIEW: Record<string, string> = {
  rug: '56 190 248 48', bowl: '244 196 52 32', pillow: '136 180 88 44', lamp: '290 86 56 136',
  plant: '12 132 50 94', shelf: '228 26 100 50', picture: '128 18 104 70', clock: '38 32 52 52'
}

/** Значок мебели: вырезка из комнаты. */
export function FurnThumb({ id, owned = true, className = 'h-10 w-full' }: { id: string; owned?: boolean; className?: string }) {
  return (
    <svg viewBox={FURN_VIEW[id]} className={className} aria-hidden="true" style={owned ? undefined : { filter: 'brightness(0) opacity(.18)' }}>
      <Furniture id={id} />
    </svg>
  )
}
