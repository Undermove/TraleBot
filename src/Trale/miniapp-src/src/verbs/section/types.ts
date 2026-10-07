import { LEVEL_ORDER, type VerbLevelKey } from '../session/types'

// Раздел «Глаголы»: ответ GET /api/miniapp/verbs/section и то, что из него считается на экране.
// Без триала/Pro сервер отдаёт только обзор: русские названия и числа, без грузинского и без id глаголов.

export interface SectionVerbDto {
  /** id глагола в каталоге (он же лемма); null — у человека нет доступа. */
  id: string | null
  /** Название действия по-грузински; null — нет доступа. */
  title: string | null
  ru: string
  level: VerbLevelKey
  /** Сколько форм ждут повторения. */
  due: number
}

export interface SectionPackDto { id: string; title: string; verbs: SectionVerbDto[] }

export interface SectionLevelDto { id: number; title: string; packs: SectionPackDto[] }

export interface SectionNextDto {
  /** continue — глагол в работе, review — пора повторить, new — следующий по порядку. */
  kind: 'continue' | 'review' | 'new'
  id: string | null
  title: string | null
  ru: string
  level: VerbLevelKey
  due: number
  levelId: number | null
  packId: string | null
  packTitle: string | null
}

export interface SectionMyVerbDto {
  id: string | null
  title: string | null
  ru: string
  level: VerbLevelKey
  /** Запись собрана моделью, а не взята из проверенного каталога. */
  generated: boolean
  /** Уровень, в котором этот глагол тоже стоит; null — глагол вне уровней. */
  levelId: number | null
  packId: string | null
}

export interface VerbSectionDto {
  hasAccess: boolean
  total: number
  learned: number
  /** Уровень, который показываем раскрытым. */
  currentLevel: number
  /** Новичок, не закончивший алфавит: одна тихая строка со ссылкой на него. */
  alphabetHint: boolean
  /** Русские глаголы-примеры для поля «введи любой глагол». */
  examples: string[]
  next: SectionNextDto | null
  myVerbs: SectionMyVerbDto[]
  levels: SectionLevelDto[]
}

const rank = (level: VerbLevelKey) => LEVEL_ORDER.indexOf(level)
const TOP = LEVEL_ORDER.length - 1

/**
 * Сколько пройдено в наборе или уровне. learned — выученные глаголы (экзамен сдан); fraction — доля
 * пути с учётом начатых: полоска трогается с места уже после первой сессии. Уровень глагола сервер
 * не понижает, поэтому полоска назад не идёт.
 */
export function progressOf(verbs: SectionVerbDto[]) {
  const learned = verbs.filter(v => v.level === 'learned').length
  const steps = verbs.reduce((sum, v) => sum + rank(v.level), 0)
  return { learned, total: verbs.length, fraction: verbs.length ? steps / (verbs.length * TOP) : 0 }
}

export const levelVerbs = (level: SectionLevelDto) => level.packs.flatMap(p => p.verbs)

/** Набор пройден, когда выучены все его глаголы. */
export const packDone = (pack: SectionPackDto) => pack.verbs.length > 0 && pack.verbs.every(v => v.level === 'learned')

export function pluralVerbs(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'глаголов'
  if (mod10 === 1) return 'глагол'
  if (mod10 >= 2 && mod10 <= 4) return 'глагола'
  return 'глаголов'
}
