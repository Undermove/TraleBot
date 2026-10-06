import React from 'react'
import { LEVEL_NAMES, LEVEL_ORDER, type VerbLevelKey } from './types'

/**
 * Уровень знания глагола: пять делений и название простыми словами («узнаю»).
 * Уровень считает сервер; здесь он только показывается — в виде глагола, в словаре, на финише сессии.
 */
export default function LevelBadge({ level, compact = false }: { level: VerbLevelKey; compact?: boolean }) {
  const rank = LEVEL_ORDER.indexOf(level)
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="verb-level" data-level={level}>
      <span className="inline-flex gap-[3px]" aria-hidden>
        {LEVEL_ORDER.slice(1).map((l, i) => (
          <span key={l} className={`${compact ? 'w-2 h-2' : 'w-3.5 h-2'} rounded-full border border-jewelInk/60 ${i < rank ? (level === 'learned' ? 'bg-gold' : 'bg-navy') : 'bg-cream-deep'}`} />
        ))}
      </span>
      <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-bold text-jewelInk-mid`}>{LEVEL_NAMES[level]}</span>
    </span>
  )
}
