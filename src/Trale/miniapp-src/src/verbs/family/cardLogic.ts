import type { Direction, SectionFamilyDto, SectionFamilyMemberDto, Toward } from './types'

// Что карточка семьи считает из ответа раздела: счёт «туда / сюда» и что запустит её кнопка.

export const FAMILY_CARD_HINT = 'verbs_family_card'

/** Где направления стоят на схеме (сетка 3×3): как в жизни — вверх сверху, внутрь слева, наружу справа. */
export const SCHEME: (Direction | null)[][] = [
  ['across', 'up', null],
  ['in', 'none', 'out'],
  [null, 'down', null]
]

export type PillState = 'new' | 'started' | 'learned'
export const pillState = (m: SectionFamilyMemberDto): PillState => (m.level === 'learned' ? 'learned' : m.level === 'new' ? 'new' : 'started')
export const STATE_RU: Record<PillState, string> = { new: 'новый', started: 'начат', learned: 'выучен' }

export const memberAt = (family: SectionFamilyDto, direction: Direction, toward: Toward) =>
  family.members.find(m => m.direction === direction && m.toward === toward)

/** «туда: 2 из 6 · сюда: 1 из 6» — выученные из всех глаголов семьи по каждой стороне. */
export function towardProgress(family: SectionFamilyDto) {
  const count = (toward: Toward) => {
    const all = family.members.filter(m => m.toward === toward)
    return { learned: all.filter(m => m.level === 'learned').length, total: all.length }
  }
  return { there: count('there'), here: count('here') }
}

export interface FamilyAction {
  /** Кого запустит кнопка; null — играть некого (семья пуста). */
  member: SectionFamilyMemberDto | null
  label: string
  /** Тихая кнопка: всё выучено и повторять нечего. */
  quiet: boolean
}

/**
 * Одна кнопка карточки. Пока основной глагол не выучен — она ведёт к нему: окончания у всей семьи
 * его. Потом — к следующему невыученному направлению (сначала начатое), потом — к повторению.
 */
export function familyAction(family: SectionFamilyDto): FamilyAction {
  const base = family.members.find(m => m.role === 'base') ?? null
  if (base && !family.baseLearned) return { member: base, label: `Сначала «${family.baseName}» — 2 минуты`, quiet: false }
  const open = family.members.filter(m => m.level !== 'learned')
  const started = open.find(m => m.level !== 'new')
  if (started) return { member: started, label: 'Продолжить — 2 минуты', quiet: false }
  if (open.length) return { member: open[0], label: 'Выучить направление — 2 минуты', quiet: false }
  const due = [...family.members].sort((a, b) => b.due - a.due)[0] ?? null
  if (due && due.due > 0) return { member: due, label: 'Повторить за минуту', quiet: false }
  return { member: family.members.find(m => m.role === 'member') ?? base, label: 'Сыграть ещё', quiet: true }
}
