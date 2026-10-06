import { PERSONS, TENSES, type TenseKey } from './types'

// Что значит форма глагола — простыми словами. В упражнениях нет названий времён: вместо
// «я · имперфект» на экране «я хотел(а)». Фраза приходит с сервера (каталог: meanings), проспряжённая
// для своего глагола; здесь только то, как её достать и что показать, когда фразы нет.

/** Фраза и, если без неё не обойтись, пометка: «я писал(а)» · «один раз · сделано». */
export interface Meaning {
  text: string
  note: string | null
}

/** Короткое слово для строки таблицы в игре, где на фразу нет места. */
export const SHORT_TIME: Partial<Record<TenseKey, string>> = {
  present: 'сейчас', aorist: 'один раз', imperfect: 'долго', optative: 'надо', conditional: 'бы', future: 'потом'
}

/**
 * Когда фразы в базе нет (редкое время, глагол добавлен на лету): лицо и простое название времени —
 * «я · прошедшее: сделал». Так же пишет бот в разборе (VerbReplyFormatter.PlainTime).
 */
const fallback = (tense: TenseKey, person: number): Meaning =>
  ({ text: `${PERSONS[person]} · ${TENSES[tense].name.toLowerCase()}`, note: null })

interface WithMeanings {
  meanings?: Partial<Record<TenseKey, string[]>> | null
  meaningChips?: Partial<Record<TenseKey, string>> | null
}

/** Значение клетки таблицы глагола. */
export function meaningOf(verb: WithMeanings, tense: TenseKey, person: number): Meaning {
  const text = verb.meanings?.[tense]?.[person]
  return text ? { text, note: verb.meaningChips?.[tense] ?? null } : fallback(tense, person)
}

/** Значение формы, найденной в слове или фразе (словарь, урок, комикс). */
export function meaningOfHit(hit: { tense: TenseKey; person: number; meaning?: string | null; meaningNote?: string | null }): Meaning {
  return hit.meaning ? { text: hit.meaning, note: hit.meaningNote ?? null } : fallback(hit.tense, hit.person)
}

/** Одной строкой, для текста подсказки: «я писал(а)» (один раз · сделано). */
export const quoted = (m: Meaning) => (m.note ? `«${m.text}» (${m.note})` : `«${m.text}»`)

/** Два значения читаются одинаково — в одном задании рядом им стоять нельзя. */
export const sameMeaning = (a: Meaning, b: Meaning) => a.text === b.text && a.note === b.note
