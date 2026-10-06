import catalog from '../../../../Verbs/verbs.json'
import type { VerbDto } from '../types'

// Только для тестов: глаголы из настоящего каталога (src/Trale/Verbs/verbs.json) в том виде,
// в каком их отдаёт API. Грузинские формы в тестах берутся отсюда, а не пишутся от руки.
// Каталог упорядочен по частотности и растёт, поэтому глагол берём по лемме или переводу,
// а не по номеру.

type Entry = (typeof catalog.verbs)[number]

const toDto = (v: Entry): VerbDto => ({
  id: v.lemma, title: v.title, ru: v.ru, kind: v.kind as VerbDto['kind'],
  present: ((v.tenses as Record<string, string[][]>).present?.[0] ?? []) as string[],
  masdarWithPreverb: v.masdarWithPreverb ?? [], reason: v.reason ?? '', root: v.root ?? '',
  oddTenses: (v.oddTenses ?? []) as VerbDto['oddTenses'], model: v.model ?? null,
  tenses: v.tenses as VerbDto['tenses'],
  meanings: v.meanings as VerbDto['meanings'], meaningChips: v.meaningChips as VerbDto['meaningChips'],
  sentences: v.sentences ?? [], source: v.source ?? null,
  status: 'verified'
})

export const CATALOG: VerbDto[] = catalog.verbs.map(toDto)

/** Проверенный глагол каталога по русскому переводу — так тесты читаются без знания грузинского. */
export function verbRu(ru: string, patch: Partial<VerbDto> = {}): VerbDto {
  const verb = CATALOG.find(v => v.ru === ru || v.ru.split(', ').includes(ru))
  if (!verb) throw new Error(`В каталоге нет глагола «${ru}»`)
  return { ...structuredClone(verb), ...patch }
}

/** Проверенный глагол каталога по лемме (она же id карточки). */
export function verbByLemma(lemma: string, patch: Partial<VerbDto> = {}): VerbDto {
  const verb = CATALOG.find(v => v.id === lemma)
  if (!verb) throw new Error(`В каталоге нет глагола ${lemma}`)
  return { ...structuredClone(verb), ...patch }
}

/** Предсказуемая случайность для тестов. */
export function seeded(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
