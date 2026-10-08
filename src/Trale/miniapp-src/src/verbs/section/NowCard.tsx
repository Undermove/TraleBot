import React from 'react'
import Button from '../../components/Button'
import ProBadge from '../../components/ProBadge'
import LevelBadge from '../session/LevelBadge'
import { cyr } from '../types'
import type { SectionNextDto } from './types'

// Главная карточка раздела: «что делать сейчас». Глагол и сессию выбирает приложение —
// человеку остаётся одна кнопка.

const EYEBROW: Record<SectionNextDto['kind'], string> = {
  new: 'начни с этого',
  continue: 'продолжаем',
  review: 'пора повторить'
}

export function nowButtonLabel(next: SectionNextDto): string {
  if (next.kind === 'review') return 'Повторить за минуту'
  // Глагол из семьи при выученном основном: учить осталось только приставку.
  if (next.familyBase) return next.kind === 'continue' ? 'Продолжить — 2 минуты' : 'Выучить направление — 2 минуты'
  return next.kind === 'continue' ? 'Продолжить — 2 минуты' : 'Играть 2 минуты'
}

function pluralForms(n: number) {
  const mod100 = n % 100, mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'форм ждут'
  if (mod10 === 1) return 'форма ждёт'
  if (mod10 >= 2 && mod10 <= 4) return 'формы ждут'
  return 'форм ждут'
}

interface Props {
  next: SectionNextDto | null
  hasAccess: boolean
  onPlay: () => void
}

export default function NowCard({ next, hasAccess, onPlay }: Props) {
  if (!next) {
    return (
      <div className="jewel-tile px-5 py-5" data-testid="verbs-now" data-kind="done">
        <div className="relative z-[1] text-center">
          <div className="text-[18px] font-extrabold text-navy">Все глаголы выучены</div>
          <div className="mt-1 text-[13px] text-jewelInk-mid">Загляни позже — напомню, когда пора будет повторить.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="jewel-tile px-5 py-5" data-testid="verbs-now" data-kind={next.kind} data-tour="now">
      <div className="relative z-[1] flex flex-col gap-3">
        <div>
          <div className="mn-eyebrow text-ruby">{EYEBROW[next.kind]}</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="min-w-0 text-[26px] font-extrabold leading-[1.1] text-jewelInk" data-testid="verbs-now-ru">{next.ru}</div>
            {next.title && (
              <div className="shrink-0 text-right">
                <div className="font-geo text-[20px] font-bold leading-tight text-navy">{next.title}</div>
                <div className="text-[11px] text-jewelInk-hint leading-tight">{cyr(next.title)}</div>
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-jewelInk-mid">
            {next.kind === 'review' && next.due > 0
              ? <span data-testid="verbs-now-due">{next.due} {pluralForms(next.due)} повторения</span>
              : next.familyBase
                ? <span data-testid="verbs-now-family">это «{next.familyBase}» с приставкой — окончания ты уже знаешь</span>
                : next.packTitle && <span>набор «{next.packTitle}»</span>}
            {next.level !== 'new' && <LevelBadge level={next.level} compact />}
          </div>
        </div>
        <Button onClick={onPlay}>
          <span className="inline-flex items-center gap-2" data-testid="verbs-now-play">
            {nowButtonLabel(next)}
            {!hasAccess && <ProBadge />}
          </span>
        </Button>
      </div>
    </div>
  )
}
