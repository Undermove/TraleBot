import React from 'react'
import type { VerbDto } from '../types'
import DirectionGlyph from './DirectionGlyph'
import { openLessonModule } from './nav'
import { TOWARD_RU, placeLabel, prefixName, type FamilyMemberRef } from './types'

// Семья на карточке глагола. У глагола с приставкой — строка «Это „идти“ с приставкой „через“»
// и ссылки на основной глагол и на уроки о приставках. У основного — ряд «та же основа, другие
// направления» со ссылками на остальных.

interface Props {
  verb: VerbDto
  /** Открыть другой глагол семьи в этой же карточке. */
  onOpenVerb: (verbId: string) => void
  /** Для какого глагола это место карточки: с приставкой (строка сверху) или основного (ряд под кнопкой игры). */
  show: 'member' | 'base'
}

export default function FamilyNote({ verb, onOpenVerb, show }: Props) {
  const family = verb.family
  if (!family || family.role !== show) return null
  const base = family.members.find(m => m.role === 'base')
  const lesson = family.lessonModule && (
    <button className="min-h-[44px] text-[12px] text-navy underline" data-testid="family-lesson" onClick={() => openLessonModule(family.lessonModule)}>
      уроки о приставках
    </button>
  )

  if (family.role === 'member') {
    return (
      <div className="rounded-xl bg-navy-wash border border-jewelInk/40 px-3 pt-2.5 pb-1" data-testid="family-note" data-role="member">
        <div className="flex items-center gap-2.5">
          <DirectionGlyph direction={family.direction} toward={family.toward} size={40} />
          <div className="min-w-0 text-[14px] font-bold text-jewelInk leading-snug" data-testid="family-line">
            Это «{family.baseName}» с приставкой {prefixName(family)}
            <span className="block text-[12px] font-semibold text-jewelInk-mid">
              <span className="font-geo font-bold text-navy">{family.prefixes[0]}-</span> в начале слова — {placeLabel(family)}. Окончания те же.
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-5">
          {base && (
            <button className="min-h-[44px] text-[12px] text-navy underline" data-testid="family-base" onClick={() => onOpenVerb(base.id)}>
              открыть «{family.baseName}»
            </button>
          )}
          {lesson}
        </div>
      </div>
    )
  }

  // Основной глагол: остальные направления — короткими кнопками, парами «туда / сюда».
  const others = family.members.filter(m => m.role !== 'base')
  const label = (m: FamilyMemberRef) => (m.directionRu ? `${m.directionRu}, ${TOWARD_RU[m.toward]}` : TOWARD_RU[m.toward])
  return (
    <div className="rounded-xl bg-navy-wash border border-jewelInk/40 pt-2.5 pb-1" data-testid="family-note" data-role="base">
      <div className="px-3 text-[13px] font-bold text-jewelInk leading-snug">
        С приставкой — другое направление, окончания те же
      </div>
      <div className="mt-2 px-3 flex gap-1.5 overflow-x-auto" data-testid="family-row" style={{ scrollbarWidth: 'none' }}>
        {others.map(m => (
          <button
            key={m.id} data-testid="family-member" onClick={() => onOpenVerb(m.id)} aria-label={`${m.ru}: ${label(m)}`}
            className="jewel-pressable shrink-0 min-h-[44px] inline-flex items-center gap-1 rounded-lg bg-cream-tile border border-jewelInk/40 pl-1 pr-2 text-[12px] font-bold text-jewelInk whitespace-nowrap"
          >
            <DirectionGlyph direction={m.direction} toward={m.toward} size={26} />
            {label(m)}
          </button>
        ))}
      </div>
      <div className="flex justify-center">{lesson}</div>
    </div>
  )
}
