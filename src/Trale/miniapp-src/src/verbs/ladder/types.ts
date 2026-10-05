import type { TenseKey } from '../types'

// «Лесенка»: ответы API с прогрессом.

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
