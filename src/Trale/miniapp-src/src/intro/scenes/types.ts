import type { IntroLesson, IntroStep, Rng } from '../story'

/**
 * Контракт сцены «Знакомства». Сцена сама рисует рамку (GameFrame с названием и полоской урока),
 * играется сколько нужно и зовёт onDone, когда человек нажал «Дальше». onExit — выход из урока.
 * Сцены не отвечают на вопросы проверки и на зачёт урока не влияют.
 */
export interface SceneProps<S extends IntroStep = IntroStep> {
  lesson: IntroLesson
  step: S
  /** Доля урока для полоски сверху, 0..1. */
  fraction: number
  onExit: () => void
  onDone: () => void
  /** Для тестов: детерминированный случай и часы. */
  rng?: Rng
  now?: () => number
}

export type StepOf<K extends IntroStep['kind']> = Extract<IntroStep, { kind: K }>
