import { PERSONS, type TenseKey, type VerbDto } from '../types'
import { formOf, isFullTense, isPlayable, shuffle, slotsOf, variantsOf, type Rng } from './common'

// «Машина времени»: три остановки — три времени. Чистая логика без React.

export const STOPS: { tense: TenseKey; label: string }[] = [
  { tense: 'aorist', label: 'Вчера' },
  { tense: 'present', label: 'Сейчас' },
  { tense: 'future', label: 'Завтра' }
]
const STOP_TENSES = STOPS.map(s => s.tense)

/** Через сколько верных ответов добавляется следующее лицо. */
export const PERSON_STEP = 4

/** Сколько лиц сейчас в игре: начинаем с «я», дальше по одному. */
export const personsFor = (correct: number): number =>
  Math.min(PERSONS.length, 1 + Math.floor(correct / PERSON_STEP))

/**
 * Игра честная, только если по форме однозначно понятно, куда она ведёт: у всех шести лиц есть
 * все три времени и ни одна форма не стоит в двух клетках сразу (иначе будущее не отличить от настоящего).
 */
export function canPlayTimeMachine(verb: VerbDto): boolean {
  if (!isPlayable(verb) || !STOP_TENSES.every(t => isFullTense(verb, t))) return false
  const seen = new Set<string>()
  for (const tense of STOP_TENSES)
    for (let person = 0; person < PERSONS.length; person++)
      for (const form of variantsOf(verb, tense, person)) {
        if (seen.has(form)) return false
        seen.add(form)
      }
  return true
}

/** Куда ведёт форма: номер остановки и лицо. */
export function locate(verb: VerbDto, form: string): { stop: number; person: number } | null {
  const hit = slotsOf(verb, form, STOP_TENSES)[0]
  return hit ? { stop: STOP_TENSES.indexOf(hit.tense), person: hit.person } : null
}

export interface TimeRound { stop: number; person: number; answer: string; options: string[] }

/**
 * Раунд: флажок на одной из остановок и четыре формы на выбор.
 * Соблазны — то же лицо в других временах и то же время у других лиц.
 */
export function makeTimeRound(verb: VerbDto, persons: number, rng: Rng = Math.random, prev?: TimeRound): TimeRound {
  let stop = 0, person = 0
  // Тот же вопрос дважды подряд не задаём.
  for (let attempt = 0; attempt < 12; attempt++) {
    stop = Math.floor(rng() * STOPS.length)
    person = Math.floor(rng() * persons)
    if (!prev || prev.stop !== stop || prev.person !== person) break
  }
  return timeRoundFor(verb, stop, person, persons, rng)
}

/** Раунд про заданную клетку: в сессии, что спрашивать, решает постановщик. persons — сколько лиц уже в игре. */
export function timeRoundFor(verb: VerbDto, stop: number, person: number, persons: number, rng: Rng = Math.random): TimeRound {
  const answer = formOf(verb, STOPS[stop].tense, person)
  const sameWho = STOPS.map(s => formOf(verb, s.tense, person))
  const sameWhen = PERSONS.slice(0, Math.max(persons, 2)).map((_, p) => formOf(verb, STOPS[stop].tense, p))
  const extra = shuffle([...new Set([...sameWho, ...sameWhen])].filter(f => f !== answer), rng).slice(0, 3)
  return { stop, person, answer, options: shuffle([answer, ...extra], rng) }
}
