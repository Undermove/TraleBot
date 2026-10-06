import { PERSONS, type TenseKey, type VerbDto } from '../types'
import { meaningOf, quoted, type Meaning } from '../meaning'

// Общее для трёх игр по таблице глагола: случайность, доступ к формам, что форма значит по-русски.
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

/** Что значит клетка простыми словами: «я буду писать». */
export const slotMeaning = (verb: VerbDto, slot: Slot): Meaning => meaningOf(verb, slot.tense, slot.person)

/** То же одной строкой для подсказки: «ты пишешь» в кавычках, с пометкой, если она нужна. */
export const describeSlot = (verb: VerbDto, slot: Slot): string => quoted(slotMeaning(verb, slot))

/**
 * Глагол можно объяснить по-русски (есть перевод) и его формы приняты: взяты из источника (verified)
 * или составлены одной моделью и одобрены второй (generated). Карточка без статуса в игры не идёт.
 */
export const isPlayable = (verb: VerbDto): boolean =>
  (verb.status === 'verified' || verb.status === 'generated') && verb.ru.trim() !== ''
