import React from 'react'
import Passerby, { type Face } from '../walk/Passerby'
import type { Who } from '../Walk.logic'
import type { Look } from '../../ui'

// Портрет для семейного альбома: человечек с прогулки, по пояс — в рамке важнее лицо.

export const whoOf = (look: Look, female?: boolean): Who => {
  const f = female ?? !!look.long
  const kind = look.age === 'kid' ? 'kid' : look.age === 'old' ? 'old' : f ? 'woman' : 'man'
  // Мальчик — в кепке: у Passerby девочку отличают косички, а кепка их снимает.
  const extra = kind === 'kid' && !f ? 'cap' : look.bag ? 'bag' : 'none'
  return { ru: '', kind, coat: look.coat, skin: look.skin, hair: look.hair, extra, voice: f ? 'f' : 'm' }
}

export default function Portrait({ look, female, size = 48, face = 'smile', talking = false }: { look: Look; female?: boolean; size?: number; face?: Face; talking?: boolean }) {
  const kid = look.age === 'kid'
  return (
    <svg width={size} height={size} viewBox={kid ? '-46 -142 92 100' : '-50 -200 100 124'} aria-hidden>
      <Passerby who={whoOf(look, female)} phase={0} stride={0} face={face} talking={talking} wave={false} />
    </svg>
  )
}
