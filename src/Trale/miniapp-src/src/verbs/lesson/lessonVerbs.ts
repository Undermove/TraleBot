import type { VerbFormHitDto } from '../types'

// Глаголы только что пройденного урока — для строки на экране итога. Практика передаёт их итогу
// вместе с переходом (Screen 'result'.verbs): это состояние одного перехода, отдельного хранилища у него нет.

/** Сколько глаголов показываем на итоге: строка, а не список. */
export const RESULT_VERBS_LIMIT = 3

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
