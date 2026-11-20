import React, { forwardRef } from 'react'
import Gift3D, { type Gift3DHandle } from './Gift3D'
import Chest3D, { type ChestModel } from './Chest3D'

// Что выпало — видно по самой коробке, без надписей: подарок → деревянный сундучок → эмалевый сундук → золотой.
// Сменилась модель (тап «поднял» приз) — новая выпрыгивает.

const CHESTS: ChestModel[] = ['wood', 'ruby', 'gold']

interface Props {
  /** 0 — подарок, 1..3 — сундуки. */
  level: number
  size?: number
  opened?: boolean
  ajar?: boolean
  idle?: boolean
  tilt?: { x: number; y: number }
  charge?: number
  /** Анимация появления при смене модели. */
  pop?: boolean
}

const LootBox = forwardRef<Gift3DHandle, Props>(function LootBox({ level, size, opened, ajar, idle, tilt, charge, pop = false }, ref) {
  return (
    <div key={level} className={pop && level > 0 ? 'lb-pop' : ''} data-testid="lootbox" data-level={level}>
      {level <= 0
        ? <Gift3D ref={ref} size={size} opened={opened} ajar={ajar} idle={idle} tilt={tilt} />
        : <Chest3D ref={ref} model={CHESTS[Math.min(level, 3) - 1]} size={size} opened={opened} ajar={ajar} idle={idle} tilt={tilt} charge={charge} />}
    </div>
  )
})

export default LootBox
