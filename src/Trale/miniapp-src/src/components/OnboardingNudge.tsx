import React, { useEffect } from 'react'
import { CatalogDto, ProgressState, Screen } from '../types'
import { findFirstLesson } from '../entryFlow'

interface Props {
  hint: string
  catalog: CatalogDto
  progress: ProgressState
  navigate: (s: Screen) => void
  onFeed: () => void
  onClose: () => void
  /** Called once when the nudge is shown — the app records it so it isn't surfaced again. */
  onShown: (hint: string) => void
}

interface NudgeCopy {
  eyebrow: string
  title: string
  cta: string
}

const COPY: Record<string, NudgeCopy> = {
  first_lesson: { eyebrow: 'дальше', title: 'Бомбора ждёт первый урок — начнём с алфавита?', cta: 'Начать урок' },
  next_lesson: { eyebrow: 'не останавливайся', title: 'Хорошо идёт! Ещё один короткий урок?', cta: 'Следующий урок' },
  explore_module: { eyebrow: 'ты освоился', title: 'Ты уже втянулся — загляни в другую тему', cta: 'Показать модули' },
  feed_bombora: { eyebrow: 'у тебя есть звёзды', title: 'Накопил опыт ⭐ — потрать его и покорми Бомбору', cta: 'Покормить' },
  add_vocab: { eyebrow: 'твой словарь', title: 'Сохраняй новые слова в личный словарь и тренируй их', cta: 'Мой словарь' },
}

/**
 * Contextual onboarding nudge on the dashboard. The backend decides which single hint is
 * active (time-spread, one per ~20h); this renders it as a friendly, dismissible banner and
 * reports it shown so it isn't repeated. Unknown / unmapped keys render nothing.
 */
export default function OnboardingNudge({ hint, catalog, progress, navigate, onFeed, onClose, onShown }: Props) {
  useEffect(() => {
    onShown(hint)
  }, [hint])

  const copy = COPY[hint]
  if (!copy) return null

  function act() {
    switch (hint) {
      case 'first_lesson':
      case 'next_lesson': {
        const first = findFirstLesson(catalog, progress.completedLessons)
        if (first) navigate({ kind: 'lesson-theory', moduleId: first.moduleId, lessonId: first.lessonId })
        break
      }
      case 'feed_bombora':
        onFeed()
        break
      case 'add_vocab':
        navigate({ kind: 'vocabulary-list' })
        break
      case 'explore_module':
      default:
        // Modules are right below on the dashboard — just dismiss the nudge.
        break
    }
    onClose()
  }

  return (
    <div className="px-5 pt-2 pb-1">
      <div
        className="jewel-tile px-4 py-3 flex items-center gap-3"
        data-testid={`onboarding-nudge-${hint}`}
        style={{ background: '#FBF6EC' }}
      >
        <div className="relative z-[1] text-[22px] leading-none shrink-0">🐶</div>
        <div className="relative z-[1] flex-1 min-w-0">
          <div className="mn-eyebrow text-ruby mb-0.5">{copy.eyebrow}</div>
          <div className="font-sans text-[13px] font-extrabold text-jewelInk leading-snug">
            {copy.title}
          </div>
          <button
            onClick={act}
            data-testid="onboarding-nudge-cta"
            className="mt-2 px-3 py-1.5 rounded-lg font-sans text-[12px] font-extrabold"
            style={{ background: '#F5B820', color: '#15100A', border: '1.5px solid #15100A' }}
          >
            {copy.cta} →
          </button>
        </div>
        <button
          onClick={onClose}
          aria-label="Закрыть подсказку"
          className="relative z-[1] shrink-0 self-start text-jewelInk-hint font-sans text-[18px] leading-none w-8 h-8 flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  )
}
