import { LESSON_COUNT, WORD_LESSONS } from './games/data'
import type { Word } from './games/logic'

// Уроки модуля «Алфавит» по порядку. id 1..11 — уроки букв (как и раньше: прогресс людей хранится по id),
// после каждого — его уроки слов (id 12+, по 2–4 слова). stage — номер урока букв, чьи буквы уже открыты:
// по нему игры решают, какие буквы и слова можно показывать.

export type AlphabetLesson =
  | { id: number; kind: 'letters'; stage: number }
  | { id: number; kind: 'words'; stage: number; words: Word[]; part: number }

export const ALPHABET_LESSONS: readonly AlphabetLesson[] = (() => {
  const out: AlphabetLesson[] = []
  for (let n = 1; n <= LESSON_COUNT; n++) {
    out.push({ id: n, kind: 'letters', stage: n })
    WORD_LESSONS.filter(w => w.after === n).forEach((w, part) =>
      out.push({ id: w.id, kind: 'words', stage: n, part, words: w.words.map(([geo, ru]) => ({ geo, ru, lesson: n })) }))
  }
  return out
})()

export const LESSON_TOTAL = ALPHABET_LESSONS.length

/** Урок по id; неизвестный — как урок букв с ближайшей стадией (не роняем экран). */
export function lessonInfo(id: number): AlphabetLesson {
  return ALPHABET_LESSONS.find(l => l.id === id) ?? { id, kind: 'letters', stage: Math.max(1, Math.min(LESSON_COUNT, id)) }
}

/** Номер урока в модуле (1-based), как его видит человек. */
export const positionOf = (id: number) => ALPHABET_LESSONS.findIndex(l => l.id === id) + 1

/** Слова, которые человек уже прошёл к этому уроку (уроки слов не позже него), — для игр и вариантов ответа. */
export function wordsUpToLesson(id: number): Word[] {
  const pos = positionOf(id)
  return ALPHABET_LESSONS.slice(0, Math.max(0, pos)).flatMap(l => (l.kind === 'words' ? l.words : []))
}

/** Следующий урок слов после урока букв — для строки «дальше — слова …» на начале урока. */
export const nextWordsLesson = (id: number) => {
  const pos = positionOf(id)
  const next = ALPHABET_LESSONS[pos]
  return next?.kind === 'words' ? next : undefined
}
