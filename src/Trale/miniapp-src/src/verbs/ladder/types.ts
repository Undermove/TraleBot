import { PERSONS, TENSES, type TenseKey } from '../types'

// «Лесенка»: ответы API с прогрессом и русские подписи к формам.

export interface VerbFormProgressDto {
  tense: TenseKey
  person: number
  step: number
  bestStep: number
  reviews: number
  nextDueAtUtc: string | null
  /** Выученной форме пора на повторение. */
  due: boolean
}

export interface VerbProgressDto {
  verbId: string
  /** false у глаголов, которые ещё никто не проверил: их по лесенке не учим. */
  canLearn: boolean
  total: number
  forms: VerbFormProgressDto[]
}

/** Состояние одной формы после ответа — то, что уходит на сервер. */
export interface VerbProgressStepDto {
  tense: TenseKey
  person: number
  step: number
  reviews: number
  /** Когда ответили: сервер оставляет самое позднее, поэтому повторная отправка безвредна. */
  at: string
}

/** Глаголы, которые человек учит, — для строки «продолжить» на главном экране. */
export interface VerbsInProgressDto {
  dueForms: number
  verbs: Array<{
    id: string
    title: string
    ru: string
    started: number
    mastered: number
    total: number
    due: number
    updatedAtUtc: string
  }>
}

/**
 * Русский образец для каждой клетки на глаголе «делать»: «ты · будущее» — это как «ты сделаешь».
 * Русских спряжений для каждого глагола в базе нет и выдумывать их нельзя, поэтому значение формы
 * объясняем так: лицо, время и образец, одинаковый для всех глаголов.
 */
const LIKE: Partial<Record<TenseKey, string[]>> = {
  present: ['я делаю', 'ты делаешь', 'он делает', 'мы делаем', 'вы делаете', 'они делают'],
  aorist: ['я сделал', 'ты сделал', 'он сделал', 'мы сделали', 'вы сделали', 'они сделали'],
  imperfect: ['я делал', 'ты делал', 'он делал', 'мы делали', 'вы делали', 'они делали'],
  optative: ['мне надо сделать', 'тебе надо сделать', 'ему надо сделать', 'нам надо сделать', 'вам надо сделать', 'им надо сделать'],
  conditional: ['я сделал бы', 'ты сделал бы', 'он сделал бы', 'мы сделали бы', 'вы сделали бы', 'они сделали бы'],
  future: ['я сделаю', 'ты сделаешь', 'он сделает', 'мы сделаем', 'вы сделаете', 'они сделают']
}

/** «ты · будущее». */
export const cellLabel = (c: { tense: TenseKey; person: number }) =>
  `${PERSONS[c.person]} · ${TENSES[c.tense].name.toLowerCase()}`

/** «ты сделаешь» — образец на глаголе «делать»; пусто для времён вне лесенки. */
export const cellLike = (c: { tense: TenseKey; person: number }) => LIKE[c.tense]?.[c.person] ?? ''
