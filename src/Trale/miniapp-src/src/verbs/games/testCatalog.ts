import catalog from '../../../../Verbs/verbs.json'
import type { VerbDto } from '../types'

// Глаголы для тестов берутся из настоящего каталога (src/Trale/Verbs/verbs.json):
// грузинские формы в тестах не пишутся от руки.

type Entry = (typeof catalog.verbs)[number]

const toDto = (v: Entry): VerbDto => ({
  id: v.lemma, title: v.title, ru: v.ru, kind: v.kind as VerbDto['kind'],
  present: (v.tenses.present?.[0] ?? []) as string[],
  masdarWithPreverb: v.masdarWithPreverb ?? [], reason: v.reason, root: v.root,
  oddTenses: v.oddTenses as VerbDto['oddTenses'], model: v.model ?? null,
  tenses: v.tenses as VerbDto['tenses'], sentences: [], source: '',
  status: 'verified'
})

export const CATALOG: VerbDto[] = catalog.verbs.map(toDto)

/** Проверенный глагол каталога по русскому переводу — так тесты читаются без знания грузинского. */
export function verbRu(ru: string, patch: Partial<VerbDto> = {}): VerbDto {
  const verb = CATALOG.find(v => v.ru === ru || v.ru.split(', ').includes(ru))
  if (!verb) throw new Error(`В каталоге нет глагола «${ru}»`)
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

/** Игра уже открывалась: шторка с правилами сама не выезжает. */
export const rulesSeen = (id: string) => localStorage.setItem(`proto_seen_${id}`, '1')
/** Первый ход уже сделан: подсказок и подсветки нет. */
export const moveSeen = (id: string) => localStorage.setItem(`proto_seen_${id}_move`, '1')
