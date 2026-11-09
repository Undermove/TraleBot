import { useEffect } from 'react'
import { lessonFlow } from './lessonEvents'

/**
 * Журнал урока вида «игра → проверка» («Числа» 1–10, «Мой день»): открытие, шаг 1 — игра, шаг 2 — проверка
 * вопросами урока, «ушёл посреди». Конец урока пишет finish хука модуля (lessonFlow.end).
 */
export function useGameLessonEvents(on: boolean, moduleId: string, lessonId: number, loaded: boolean, played: boolean) {
  const stage = !on || !loaded ? null : played ? 'check' : 'game'
  useEffect(() => {
    if (stage === 'game') { lessonFlow.open(moduleId, lessonId, 'lesson'); lessonFlow.step(moduleId, lessonId, 1, 'lesson') }
    else if (stage === 'check') lessonFlow.step(moduleId, lessonId, 2, 'check')
  }, [stage, moduleId, lessonId])
  useEffect(() => () => { if (on) lessonFlow.exit() }, [on])
}

/** Игра доиграна — шаг закрыт. */
export const gameLessonPlayed = () => lessonFlow.done()

/** Проверка пройдена или нет: засчитанный урок — lesson_complete, иначе lesson_fail. */
export function gameLessonFinished(correct: number, passed: boolean) {
  lessonFlow.done(correct)
  lessonFlow.end(passed ? 'lesson_complete' : 'lesson_fail', correct)
}
