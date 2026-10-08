import data from '../../../../Verbs/families.json'
import levels from '../../../../Verbs/levels.json'
import type { FamilyDto, FamilyMemberRef, SectionFamilyDto, VerbFamilyInfo } from '../family/types'
import type { VerbLevelKey } from '../session/types'
import type { TenseKey, VerbDto } from '../types'
import { verbByLemma } from './catalog'

// Только для тестов: семья глаголов из настоящих файлов (Verbs/families.json, levels.json, verbs.json)
// в том виде, в каком её отдаёт API. Грузинское в тестах берётся отсюда, а не пишется от руки.

type Row = (typeof data.families)[number]
type Member = Row['members'][number]

export const GO: Row = data.families.find(f => f.id === 'go')!
const MAIN: TenseKey[] = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']

const ref = (m: Member): FamilyMemberRef => {
  const verb = verbByLemma(m.lemma)
  return {
    id: m.lemma, title: verb.title, ru: verb.ru, role: m.role as FamilyMemberRef['role'],
    direction: m.direction as FamilyMemberRef['direction'], toward: m.toward as FamilyMemberRef['toward'], directionRu: m.directionRu
  }
}

/** id члена семьи по месту на схеме: at('out', 'here'). */
export const at = (direction: string, toward: string): string => GO.members.find(m => m.direction === direction && m.toward === toward)!.lemma

/** Карточка глагола семьи — с полем family, как от сервера. */
export function familyVerb(lemma: string): VerbDto {
  const me = GO.members.find(m => m.lemma === lemma)!
  const family: VerbFamilyInfo = { ...ref(me), id: GO.id, title: GO.title, baseName: GO.baseName, prefixes: me.prefixes, lessonModule: GO.lessonModule, members: GO.members.map(ref) }
  return verbByLemma(lemma, { family })
}

const pickMain = <T,>(table: Partial<Record<TenseKey, T>> | null | undefined) =>
  Object.fromEntries(MAIN.filter(t => table?.[t]).map(t => [t, table![t]])) as Partial<Record<TenseKey, T>>

/** Ответ GET verbs/families/go. Строки вступления — как в теории урока: «приставка- — значение: пример (перевод)». */
export function familyDto(levelOf: Record<string, VerbLevelKey> = {}, lessonDone = false): FamilyDto {
  const sample = (direction: string) => {
    const m = GO.members.find(x => x.direction === direction && x.toward === 'there')!
    const verb = verbByLemma(m.lemma)
    return `${m.prefixes[0]}- — ${m.directionRu}: ${verb.tenses.aorist![2][0]} (${verb.meanings!.aorist![2]})`
  }
  return {
    id: GO.id, title: GO.title, baseName: GO.baseName, baseId: GO.base, baseLearned: levelOf[GO.base] === 'learned',
    members: GO.members.map(m => {
      const verb = verbByLemma(m.lemma)
      return { ...ref(m), prefixes: m.prefixes, level: levelOf[m.lemma] ?? 'new', tenses: pickMain(verb.tenses), meanings: pickMain(verb.meanings) }
    }),
    intro: {
      lessonDone, moduleId: GO.lessonModule, moduleTitle: 'Приставки направления',
      screens: [
        { lessonId: 1, title: 'Первый урок', lines: [sample('in'), sample('out')] },
        { lessonId: 2, title: 'Второй урок', lines: [sample('up'), sample('down')] }
      ]
    }
  }
}

/** Карточка семьи в разделе. */
export function sectionFamily(levelOf: Record<string, VerbLevelKey> = {}, due: Record<string, number> = {}): SectionFamilyDto {
  const own = new Set(levels.levels.flatMap(l => ('families' in l ? (l.families as { id: string; verbs: string[] }[]) : [])).find(f => f.id === GO.id)!.verbs)
  return {
    id: `family-${GO.id}`, title: GO.title, baseName: GO.baseName, baseLearned: levelOf[GO.base] === 'learned',
    members: GO.members.map(m => ({ ...ref(m), level: levelOf[m.lemma] ?? 'new', due: due[m.lemma] ?? 0, inCard: own.has(m.lemma) }))
  }
}
