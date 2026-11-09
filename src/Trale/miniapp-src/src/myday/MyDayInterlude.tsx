import React, { useEffect, useRef, useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import { MY_DAY_LESSONS, mountMyDay } from './engine'
import { gameLessonFinished, gameLessonPlayed, useGameLessonEvents } from '../analytics/useGameLessonEvents'
import './myday.css'

// Модуль «Мой день»: урок — игра (engine.ts), потом короткая проверка вопросами урока с сервера.
// Тот же контракт, что у «Чисел» (useNumbersLesson): Practice спрашивает scene, рисует её вместо вопроса
// и зовёт sceneDone/finish.

export const MY_DAY_MODULE = 'my-day'

export const isMyDayLesson = (moduleId: string, lessonId: number) =>
  moduleId === MY_DAY_MODULE && lessonId >= 1 && lessonId <= MY_DAY_LESSONS

type Result = Extract<Screen, { kind: 'result' }>

export function useMyDayLesson(moduleId: string, lessonId: number, questions: QuizQuestion[]) {
  const on = isMyDayLesson(moduleId, lessonId)
  const [played, setPlayed] = useState(false)
  const scene = on && questions.length && !played ? { kind: 'game' as const } : null
  useGameLessonEvents(on, moduleId, lessonId, questions.length > 0, played)

  return {
    on,
    scene,
    /** Игра — первые 80% полоски урока, проверка — остальное. */
    progress: (index: number, total: number) => (on ? 0.8 + (index / Math.max(1, total)) * 0.2 : index / Math.max(1, total)),
    afterQuestion(_n: number) { /* игра — до проверки */ },
    finish(result: Result, perfect: boolean, navigate: (s: Screen) => void) {
      if (on) gameLessonFinished(result.correct, perfect)
      navigate(result)
    },
    sceneDone() { if (on) gameLessonPlayed(); setPlayed(true) }
  }
}

export default function MyDayInterlude({ lessonId, onExit, onDone }: {
  lessonId: number
  onExit: () => void
  onDone: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  // движок держит свои обработчики; свежие колбэки — через ref, чтобы не перемонтировать игру
  const cb = useRef({ onExit, onDone })
  cb.current = { onExit, onDone }
  useEffect(() => {
    if (!host.current) return
    return mountMyDay(host.current, lessonId - 1, {
      onExit: () => cb.current.onExit(),
      onDone: () => cb.current.onDone()
    })
  }, [lessonId])
  return <div className="md"><div className="md-col" ref={host} /></div>
}
