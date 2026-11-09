import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { __setLessonEventSender, flushLessonEvents, type LessonEventDto } from './lessonEvents'
import { useMyDayLesson } from '../myday/MyDayInterlude'
import { useNumbersLesson } from '../numbers/NumbersInterlude'
import type { QuizQuestion } from '../types'

const questions = [{ id: 'q1' }] as unknown as QuizQuestion[]
const result = (correct: number) => ({ kind: 'result' as const, moduleId: 'x', lessonId: 1, correct, total: 4, xpEarned: 0, wrongQuestions: [] })

function record() {
  const sent: LessonEventDto[] = []
  __setLessonEventSender(events => sent.push(...events))
  return () => { flushLessonEvents(); return sent.map(e => `${e.moduleId}/${e.lessonId} ${e.step}:${e.stepKind} ${e.event}${e.value != null ? `=${e.value}` : ''}`) }
}

afterEach(() => __setLessonEventSender(null))

describe('уроки «игра → проверка» пишут журнал, как алфавит', () => {
  it('«Мой день»: открыл, доиграл, сдал проверку', () => {
    const events = record()
    const { result: hook } = renderHook(() => useMyDayLesson('my-day', 3, questions))
    act(() => hook.current.sceneDone())
    act(() => hook.current.finish(result(4), true, () => {}))
    expect(events()).toEqual([
      'my-day/3 0:lesson lesson_open',
      'my-day/3 1:lesson step_start',
      'my-day/3 1:lesson step_done',
      'my-day/3 2:check step_start',
      'my-day/3 2:check step_done=4',
      'my-day/3 2:check lesson_complete=4'
    ])
  })

  it('«Числа»: не сдал проверку — lesson_fail', () => {
    const events = record()
    const { result: hook } = renderHook(() => useNumbersLesson('numbers', 2, questions))
    act(() => hook.current.sceneDone())
    act(() => hook.current.finish(result(1), false, () => {}))
    expect(events().slice(-1)[0]).toBe('numbers/2 2:check lesson_fail=1')
  })

  it('ушёл посреди игры — lesson_exit на шаге игры', () => {
    const events = record()
    const { unmount } = renderHook(() => useMyDayLesson('my-day', 5, questions))
    unmount()
    expect(events().slice(-1)[0]).toBe('my-day/5 1:lesson lesson_exit')
  })

  it('чужой модуль ничего не пишет', () => {
    const events = record()
    const { unmount } = renderHook(() => useMyDayLesson('alphabet-progressive', 3, questions))
    unmount()
    expect(events()).toEqual([])
  })
})
