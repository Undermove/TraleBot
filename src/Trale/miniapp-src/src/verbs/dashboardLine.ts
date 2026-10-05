import type { Screen } from '../types'

// Единственная строка про глаголы на главной — под блоком «что дальше». Не плитка и не раздел.

/** Ответ GET /api/miniapp/verbs/summary. */
export interface VerbsSummaryDto {
  /** Сколько своих слов и фраз в словаре содержат форму известного глагола. */
  dictionaryVerbs: number
}

export interface VerbsLine {
  id: 'dictionary'
  text: string
  screen: Screen
}

export interface VerbsLineInput {
  /** null — сводки нет: не загрузилась или нет доступа к глаголам. */
  summary: VerbsSummaryDto | null
  /** Новичок: ещё ни одного пройденного урока из каталога. */
  newcomer: boolean
  /** Сейчас показывается подсказка онбординга. */
  onboardingActive: boolean
}

export function pluralVerbs(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'глаголов'
  if (mod10 === 1) return 'глагол'
  if (mod10 >= 2 && mod10 <= 4) return 'глагола'
  return 'глаголов'
}

function dictionaryLine({ dictionaryVerbs: n }: VerbsSummaryDto): VerbsLine | null {
  if (n <= 0) return null
  return {
    id: 'dictionary',
    text: n === 1
      ? 'В твоём словаре 1 глагол — посмотри его формы'
      : `В твоём словаре ${n} ${pluralVerbs(n)} — посмотри формы`,
    screen: { kind: 'vocabulary-list', filter: 'verbs' }
  }
}

/**
 * Кандидаты на строку по убыванию важности; показывается первый подошедший, всегда один.
 * Когда появится прогресс по глаголу («продолжи глагол X», формы к повторению) — он встаёт
 * сюда первым элементом, остальное не меняется.
 */
const CANDIDATES: Array<(summary: VerbsSummaryDto) => VerbsLine | null> = [dictionaryLine]

/**
 * Какую строку про глаголы показать на главной — или никакой. Новичку и во время подсказок
 * онбординга строки нет: там всё внимание на первом уроке.
 */
export function pickVerbsLine({ summary, newcomer, onboardingActive }: VerbsLineInput): VerbsLine | null {
  if (!summary || newcomer || onboardingActive) return null
  for (const candidate of CANDIDATES) {
    const line = candidate(summary)
    if (line) return line
  }
  return null
}
