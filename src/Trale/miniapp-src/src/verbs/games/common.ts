import { PERSONS, TENSES, type TenseKey, type VerbDto } from '../types'

// Общее для трёх игр по таблице глагола: случайность, доступ к формам, русская формулировка задания.
// Грузинских форм здесь нет и быть не должно — всё берётся из карточки глагола.

/** Источник случайности; в тестах подменяется на предсказуемый. */
export type Rng = () => number

export const pick = <T,>(xs: readonly T[], rng: Rng = Math.random): T => xs[Math.floor(rng() * xs.length)]

export function shuffle<T>(xs: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Все варианты формы в клетке таблицы. */
export const variantsOf = (verb: VerbDto, tense: TenseKey, person: number): string[] =>
  verb.tenses[tense]?.[person] ?? []

/** Основной (первый) вариант формы или пустая строка, если клетки нет. */
export const formOf = (verb: VerbDto, tense: TenseKey, person: number): string =>
  variantsOf(verb, tense, person)[0] ?? ''

/** Во времени есть форма для каждого из шести лиц. */
export const isFullTense = (verb: VerbDto, tense: TenseKey): boolean =>
  PERSONS.every((_, p) => formOf(verb, tense, p) !== '')

export interface Slot { tense: TenseKey; person: number }

/** Каким клеткам (из перечисленных времён) принадлежит форма. Пусто — такой формы там нет. */
export function slotsOf(verb: VerbDto, form: string, tenses: readonly TenseKey[]): Slot[] {
  const out: Slot[] = []
  for (const tense of tenses)
    for (let person = 0; person < PERSONS.length; person++)
      if (variantsOf(verb, tense, person).includes(form)) out.push({ tense, person })
  return out
}

/** Короткий образец времени из справочника: «сделаю», «делал». Всё, что после тире, — пояснение. */
export const shortGloss = (tense: TenseKey): string => TENSES[tense].gloss.split(' — ')[0]

/** «я · Будущее» — кто и когда, без перевода самой формы: его у нас нет, и выдумывать его нельзя. */
export const whoWhen = (slot: Slot): string => `${PERSONS[slot.person]} · ${TENSES[slot.tense].name}`

/** «это «ты», аорист» — что на самом деле значит выбранная форма. */
export const describeSlot = (slot: Slot): string =>
  `«${PERSONS[slot.person]}», ${TENSES[slot.tense].name.toLowerCase()}`

/** Глагол можно объяснить по-русски (есть перевод) и его формы проверены по источнику. */
export const isPlayable = (verb: VerbDto): boolean => verb.status === 'verified' && verb.ru.trim() !== ''
