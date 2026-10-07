import ladder from '../../../../Verbs/levels.json'
import { CATALOG } from '../testing/catalog'
import type { VerbLevelKey } from '../session/types'
import type { SectionMyVerbDto, SectionNextDto, VerbSectionDto } from './types'

// Только для тестов и для проверки глазами (mock API): раздел, собранный из настоящих данных —
// уровней src/Trale/Verbs/levels.json и каталога. Грузинское здесь не пишется, а берётся оттуда.

const byLemma = new Map(CATALOG.map(v => [v.id, v]))

/** Леммы в рекомендованном порядке. */
export const LADDER: string[] = ladder.levels.flatMap(l => l.packs.flatMap(p => p.verbs))

export const ruOf = (lemma: string) => byLemma.get(lemma)!.ru
export const lemmaOf = (ru: string) => CATALOG.find(v => v.ru === ru)!.id

export interface SectionFixture {
  /** Уровень знания по лемме; кого нет — «новый». */
  levels?: Record<string, VerbLevelKey>
  hasAccess?: boolean
  /** Свои глаголы, кроме начатых (они попадают сами): леммы каталога или готовые записи. */
  saved?: Array<string | SectionMyVerbDto>
  /** Глагол с формами на повторение. */
  due?: Record<string, number>
  alphabetHint?: boolean
  examples?: string[]
}

export function sectionFixture(f: SectionFixture = {}): VerbSectionDto {
  const access = f.hasAccess ?? true
  const level = (lemma: string): VerbLevelKey => f.levels?.[lemma] ?? 'new'
  const place = new Map<string, { levelId: number; packId: string; packTitle: string }>()
  for (const l of ladder.levels) for (const p of l.packs) for (const lemma of p.verbs) place.set(lemma, { levelId: l.id, packId: p.id, packTitle: p.title })

  const verb = (lemma: string) => ({
    id: access ? lemma : null, title: access ? byLemma.get(lemma)!.title : null, ru: ruOf(lemma), level: level(lemma), due: f.due?.[lemma] ?? 0
  })
  const levels = ladder.levels.map(l => ({ id: l.id, title: l.title, packs: l.packs.map(p => ({ id: p.id, title: p.title, verbs: p.verbs.map(verb) })) }))

  const started = Object.keys(f.levels ?? {})
  const mine = (lemma: string): SectionMyVerbDto => ({
    id: access ? lemma : null, title: access ? byLemma.get(lemma)!.title : null, ru: ruOf(lemma), level: level(lemma), generated: false,
    levelId: place.get(lemma)?.levelId ?? null, packId: place.get(lemma)?.packId ?? null
  })
  const myVerbs = [...started.map(mine), ...(f.saved ?? []).map(s => (typeof s === 'string' ? mine(s) : s))]

  const next = (kind: SectionNextDto['kind'], lemma: string): SectionNextDto => ({
    kind, ...verb(lemma), levelId: place.get(lemma)!.levelId, packId: place.get(lemma)!.packId, packTitle: place.get(lemma)!.packTitle
  })
  const inProgress = started.find(l => level(l) !== 'learned')
  const toReview = Object.keys(f.due ?? {})[0]
  const fresh = LADDER.find(l => !started.includes(l))
  const pick = inProgress ? next('continue', inProgress) : toReview ? next('review', toReview) : fresh ? next('new', fresh) : null

  return {
    hasAccess: access,
    total: LADDER.length,
    learned: LADDER.filter(l => level(l) === 'learned').length,
    currentLevel: pick?.levelId ?? 1,
    alphabetHint: f.alphabetHint ?? false,
    examples: f.examples ?? ['готовить', 'играть', 'смеяться'],
    next: pick,
    myVerbs,
    levels
  }
}
