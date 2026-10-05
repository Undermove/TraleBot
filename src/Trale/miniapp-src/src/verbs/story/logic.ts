import { PERSONS, TENSES, type VerbFormHitDto } from '../types'
import type { StoryFormDto, StoryFrameDto, VerbStoryDto } from './types'
import { sentenceWords } from '../wordOrder'

// Чистая логика комикса: разбор реплики на слова, пропуск на месте формы, объяснение неверной формы.

const WORD = /[ა-ჰ]+/g

/** Грузинские слова реплики без знаков препинания — из них собирается фраза (то же правило, что в лесенке). */
export const words = sentenceWords

/** Реплика, разрезанная вокруг нужной формы (целого слова): на её месте рисуется пропуск. */
export function gap(ka: string, form: string): { before: string; after: string } {
  for (const m of ka.matchAll(WORD)) {
    if (m[0] === form) return { before: ka.slice(0, m.index), after: ka.slice(m.index! + form.length) }
  }
  return { before: ka, after: '' }
}

/** «будущее, „я“» — клетка таблицы словами. */
export const cellName = (c: { tense: StoryFormDto['tense']; person: number }) =>
  `${TENSES[c.tense].name.toLowerCase()}, «${PERSONS[c.person]}»`

/**
 * Что сказать, когда выбрана настоящая, но не та форма. Не «ошибка», а что форма значит и чем
 * отличается от нужной. Текст строится из названия времени и лица, поэтому годится для любого глагола.
 */
export function explainWrong(chosen: StoryFormDto, need: StoryFormDto): string {
  const means = `${chosen.form} — это ${TENSES[chosen.tense].name.toLowerCase()} (${TENSES[chosen.tense].gloss}), «${PERSONS[chosen.person]}».`
  if (chosen.tense === need.tense) return `${means} Время то самое, а лицо здесь — «${PERSONS[need.person]}».`
  const tense = `${TENSES[need.tense].name.toLowerCase()} (${TENSES[need.tense].gloss})`
  if (chosen.person === need.person) return `${means} Лицо то самое, а время здесь — ${tense}.`
  return `${means} А здесь нужно: ${tense}, «${PERSONS[need.person]}».`
}

/** Что сказать про набранное слово: hits — разбор этого слова из базы глаголов. */
export function explainTyped(typed: string, hits: VerbFormHitDto[], story: VerbStoryDto, need: StoryFormDto): string {
  const own = hits.find(h => h.verbId === story.verbId)
  if (own) return explainWrong({ form: typed, tense: own.tense, person: own.person }, need)
  if (hits.length) return `${typed} — это форма другого глагола: ${hits[0].title} (${hits[0].ru}). Здесь нужно: ${cellName(need)}.`
  return `Слова ${typed} в базе глаголов нет — возможно, опечатка. Здесь нужно: ${cellName(need)}.`
}

/** Перемешанные номера слов — так, чтобы фраза не лежала уже собранной. */
export function shuffled(count: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (count > 1 && order.every((n, i) => n === i)) order.push(order.shift()!)
  return order
}

/** Формы, которые прозвучали в истории, без повторов и в порядке появления — для итога. */
export function usedForms(frames: StoryFrameDto[]): StoryFormDto[] {
  const seen = new Set<string>()
  return frames.map(f => f.target).filter(t => !seen.has(t.form) && !!seen.add(t.form))
}

/** Адреса трёх файлов кадра. */
export function frameImages(story: VerbStoryDto, frame: StoryFrameDto) {
  const base = `/stories/${story.images}/${frame.image}`
  return { placeholder: `${base}-ph.webp`, small: `${base}-480.webp`, large: `${base}-800.webp` }
}
