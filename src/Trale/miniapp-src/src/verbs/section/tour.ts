import type { VerbSectionDto } from './types'

// Знакомство с разделом: несколько подсказок-«фонариков», каждая показывается один раз
// (отметки — на сервере, см. ui/hints.ts), любую можно пропустить, ни одна не мешает нажимать.
//   now   — первый вход: «начни с этого» на карточке «что делать сейчас»;
//   level — после первой сессии: полоска уровня;
//   card  — там же: где лежат все формы глагола;
//   mine  — там же: «Мои глаголы» и примеры.
// Четвёртое событие — «свой глагол открыт» (OwnVerbUnlocked) — живёт отдельно: оно случается в словаре.

export type TourStep = 'now' | 'card' | 'level' | 'mine'

export const TOUR_HINT: Record<TourStep, string> = {
  now: 'verbs_tour_now',
  card: 'verbs_tour_card',
  level: 'verbs_tour_level',
  mine: 'verbs_tour_mine'
}

/** Первое открытие своего глагола — празднуем один раз. */
export const OWN_VERB_HINT = 'verbs_own_unlocked'
/** Раздел уже открывали — метка «новое» на плитке больше не нужна. */
export const SECTION_OPENED_HINT = 'verbs_section_opened'

export const TOUR_TEXT: Record<TourStep, string> = {
  now: 'Начни с этого: 2 минуты — и первый глагол знаком.',
  card: 'А здесь все формы этого глагола. Нажми — откроется его карточка.',
  level: 'Это твой путь по уровню. Ничего не заперто: открывай любой набор.',
  mine: 'Любой глагол, который ты переведёшь в боте или в словаре, появится здесь. Попробуй — нажми на пример.'
}

/** Что подсвечивает шаг: значение атрибута data-tour у элемента раздела. */
export const TOUR_TARGET: Record<TourStep, string> = { now: 'now', card: 'verb-row', level: 'level', mine: 'mine-add' }

/** Шаги после первой сессии идут подряд. */
// Порядок — как на экране сверху вниз: уровни, потом «Мои глаголы» (строка глагола и поле с примерами).
export const AFTER_FIRST_SESSION: TourStep[] = ['level', 'card', 'mine']

/**
 * Какой шаг показать сейчас — или никакого. Пока человек ни с одним глаголом не играл, это «начни
 * с этого»; после первой игры — шаги про карточку, уровень и «Мои глаголы», по одному.
 * Без доступа знакомства нет: кнопки ведут к оплате, показывать на них незачем.
 */
export function nextTourStep(section: VerbSectionDto, seen: (hint: string) => boolean): TourStep | null {
  if (!section.hasAccess) return null
  const played = section.myVerbs.some(v => v.level !== 'new')
  if (!played) return section.next && !seen(TOUR_HINT.now) ? 'now' : null
  return AFTER_FIRST_SESSION.find(step => !seen(TOUR_HINT[step])) ?? null
}
