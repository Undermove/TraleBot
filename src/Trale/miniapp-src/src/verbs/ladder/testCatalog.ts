import catalog from '../../../../Verbs/verbs.json'
import type { VerbDto } from '../types'

// Только для тестов: глаголы из настоящего каталога, в том виде, в каком их отдаёт API.
// Грузинские формы в тестах берём отсюда, а не пишем руками.

type Entry = (typeof catalog.verbs)[number]

const toDto = (e: Entry): VerbDto => ({
  id: e.lemma,
  title: e.title,
  ru: e.ru,
  kind: e.kind as VerbDto['kind'],
  present: (e.tenses as Record<string, string[][]>).present?.[0] ?? [],
  masdarWithPreverb: e.masdarWithPreverb ?? [],
  reason: e.reason ?? '',
  root: e.root ?? '',
  oddTenses: (e.oddTenses ?? []) as VerbDto['oddTenses'],
  model: null,
  tenses: e.tenses as VerbDto['tenses'],
  sentences: e.sentences ?? [],
  source: e.source ?? ''
})

export const catalogVerbs: VerbDto[] = catalog.verbs.map(toDto)

/** Глагол каталога по порядковому номеру (0 — «писать»). */
export const catalogVerb = (index: number) => catalogVerbs[index]

/** Генератор случайных чисел с зерном: тесты с перемешиванием повторяемы. */
export function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
