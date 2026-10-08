import type { TenseKey } from '../types'
import type { VerbLevelKey } from '../session/types'

// Семья глаголов: один глагол с разными приставками направления («идти» → «выходить», «входить»…).
// Кто в семье и какая у кого приставка, считает сервер по каталогу (scripts/verbs/build-families.mjs);
// здесь — только типы ответов. Грузинских букв в коде семьи нет: приставки и формы приходят с сервера.

/** Место на схеме: вверх, вниз, внутрь, наружу, через; none — просто «туда / сюда» (идти, приходить). */
export type Direction = 'up' | 'down' | 'in' | 'out' | 'across' | 'none'
/** there — от говорящего, «туда»; here — к говорящему, «сюда». */
export type Toward = 'there' | 'here'
export type FamilyRole = 'base' | 'member'

export interface FamilyPlace {
  role: FamilyRole
  direction: Direction
  toward: Toward
  /** Направление по-русски из урока о приставках («наружу»); null у пары «идти / приходить». */
  directionRu: string | null
}

/** Член семьи в карточке глагола: чтобы назвать и дать ссылку. */
export interface FamilyMemberRef extends FamilyPlace {
  id: string
  title: string
  ru: string
}

/** Поле family в карточке глагола (GET /api/miniapp/verbs/{id}). */
export interface VerbFamilyInfo extends FamilyPlace {
  id: string
  title: string
  /** Как основной глагол называется по-русски («идти»). */
  baseName: string
  /** Приставки, с которых начинаются формы этого глагола; первая — его собственная. */
  prefixes: string[]
  /** Модуль уроков о приставках направления. */
  lessonModule: string
  members: FamilyMemberRef[]
}

/** Поле family в состоянии глагола (GET /api/miniapp/verbs/{id}/learning). */
export interface FamilyLearningDto {
  id: string
  role: FamilyRole
  baseId: string
  baseName: string
  /** Основной глагол выучен: этому остаётся короткая сессия про приставку. */
  baseLearned: boolean
  /** Уроки о приставках пройдены — вступление в первой сессии не нужно. */
  lessonDone: boolean
}

/** Член семьи с формами — для сцен про приставку (GET /api/miniapp/verbs/families/{id}). */
export interface FamilyMemberDto extends FamilyMemberRef {
  prefixes: string[]
  level: VerbLevelKey
  tenses: Partial<Record<TenseKey, string[][]>>
  meanings: Partial<Record<TenseKey, string[]>>
}

export interface FamilyIntroScreen {
  lessonId: number
  title: string
  /** Строки теории урока как есть: «приставка- — значение: пример (перевод)». */
  lines: string[]
}

export interface FamilyDto {
  id: string
  title: string
  baseName: string
  baseId: string
  baseLearned: boolean
  members: FamilyMemberDto[]
  intro: { lessonDone: boolean; moduleId: string | null; moduleTitle: string | null; screens: FamilyIntroScreen[] }
}

/** Член семьи на карточке раздела (поле families уровня в GET /api/miniapp/verbs/section). */
export interface SectionFamilyMemberDto extends FamilyPlace {
  /** null — у человека нет доступа. */
  id: string | null
  title: string | null
  ru: string
  level: VerbLevelKey
  due: number
  /** false — глагол стоит в своём наборе; карточка семьи его только показывает. */
  inCard: boolean
}

export interface SectionFamilyDto {
  /** id карточки в уровне (как packId у глагола «что делать сейчас»). */
  id: string
  title: string
  baseName: string
  baseLearned: boolean
  members: SectionFamilyMemberDto[]
}

export const TOWARD_RU: Record<Toward, string> = { there: 'туда', here: 'сюда' }

/** «наружу · сюда», а у пары без направления — просто «сюда». */
export const placeLabel = (p: FamilyPlace) => (p.directionRu ? `${p.directionRu} · ${TOWARD_RU[p.toward]}` : TOWARD_RU[p.toward])

/** Как назвать приставку в строке карточки: «наружу», «сюда», «наружу» + «сюда». */
export function prefixName(p: FamilyPlace): string {
  if (!p.directionRu) return `«${TOWARD_RU[p.toward]}»`
  return p.toward === 'here' ? `«${p.directionRu}» + «${TOWARD_RU.here}»` : `«${p.directionRu}»`
}

/** Какой приставкой из списка начинается форма (самой длинной), или пусто. */
export function prefixOf(form: string, prefixes: readonly string[]): string {
  return [...prefixes].sort((a, b) => b.length - a.length).find(p => p && form.startsWith(p) && form.length > p.length) ?? ''
}
