import type { Screen } from '../types'
import { LEVEL_NAMES, type VerbLevelKey } from './session/types'

// Единственная строка про глаголы на главной — под блоком «что дальше». Не плитка и не раздел.

/** Ответ GET /api/miniapp/verbs/summary. */
export interface VerbsSummaryDto {
  /** Сколько своих слов и фраз в словаре содержат форму известного глагола. */
  dictionaryVerbs: number
  /** Глагол, который человек учит (последний, с которым играл) и ещё не выучил. */
  continueVerb?: { id: string; title: string; ru: string; level: VerbLevelKey } | null
}

export interface VerbsLine {
  id: 'dictionary' | 'continue'
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

/** «Продолжить глагол X» — открывает сразу вид этого глагола, с уровнем и кнопкой игры. */
function continueLine({ continueVerb: verb }: VerbsSummaryDto): VerbsLine | null {
  if (!verb) return null
  return {
    id: 'continue',
    text: `Продолжить глагол «${verb.ru}» · ${LEVEL_NAMES[verb.level]}`,
    screen: { kind: 'vocabulary-list', filter: 'verbs', verb: { verbId: verb.id } }
  }
}

/** Кандидаты на строку по убыванию важности; показывается первый подошедший, всегда один. */
const CANDIDATES: Array<(summary: VerbsSummaryDto) => VerbsLine | null> = [continueLine, dictionaryLine]

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
