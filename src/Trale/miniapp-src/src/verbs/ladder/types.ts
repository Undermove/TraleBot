import type { TenseKey } from '../types'

// Прогресс форм глагола: ответы API.

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
