import type { VerbFormHitDto } from '../types'

// Глаголы только что пройденного урока. Практика кладёт их сюда, экран итога читает:
// так список не надо протаскивать через навигацию между экранами.

/** Сколько глаголов показываем на итоге: строка, а не список. */
export const RESULT_VERBS_LIMIT = 3

let last: { key: string; verbs: VerbFormHitDto[] } | null = null
const keyOf = (moduleId: string, lessonId: number) => `${moduleId}:${lessonId}`

/** Разные глаголы из вопросов, в порядке появления; у каждого — та форма, что встретилась первой. */
export function uniqueVerbs(
  questions: Array<{ verb?: VerbFormHitDto | null }>,
  limit = RESULT_VERBS_LIMIT
): VerbFormHitDto[] {
  const byVerb = new Map<string, VerbFormHitDto>()
  for (const q of questions) {
    if (q.verb && !byVerb.has(q.verb.verbId)) byVerb.set(q.verb.verbId, q.verb)
  }
  return [...byVerb.values()].slice(0, limit)
}

export function rememberLessonVerbs(
  moduleId: string,
  lessonId: number,
  questions: Array<{ verb?: VerbFormHitDto | null }>
) {
  last = { key: keyOf(moduleId, lessonId), verbs: uniqueVerbs(questions) }
}

/** Глаголы урока, если итог показывается именно по нему; иначе пусто. */
export function lessonVerbs(moduleId: string, lessonId: number): VerbFormHitDto[] {
  return last?.key === keyOf(moduleId, lessonId) ? last.verbs : []
}
