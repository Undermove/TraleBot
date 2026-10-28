import React, { useEffect, useRef, useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import { NUMBER_LEVELS, mountLevel } from './engine'
import './numbers.css'

// Урок «Чисел» 1..10 — уровень с игрой (engine.ts): объяснятор, игра, итог. Потом короткая проверка вопросами
// урока с сервера. Тот же контракт, что у алфавита (useAlphabetLesson): Practice спрашивает scene, рисует её
// вместо вопроса и зовёт sceneDone/finish. Урок 11 (сотни, порядковые, дни) — обычный, без игры.

export const NUMBERS_MODULE = 'numbers'

export const isNumbersGameLesson = (moduleId: string, lessonId: number) =>
  moduleId === NUMBERS_MODULE && lessonId >= 1 && lessonId <= NUMBER_LEVELS

type Result = Extract<Screen, { kind: 'result' }>

export function useNumbersLesson(moduleId: string, lessonId: number, questions: QuizQuestion[]) {
  const on = isNumbersGameLesson(moduleId, lessonId)
  const [played, setPlayed] = useState(false)
  const scene = on && questions.length && !played ? { kind: 'level' as const } : null

  return {
    on,
    scene,
    /** Игра — первые 80% полоски урока, проверка — остальное. */
    progress: (index: number, total: number) => (on ? 0.8 + (index / Math.max(1, total)) * 0.2 : index / Math.max(1, total)),
    afterQuestion(_n: number) { /* игра — до проверки */ },
    finish(result: Result, _perfect: boolean, navigate: (s: Screen) => void) { navigate(result) },
    sceneDone() { setPlayed(true) }
  }
}

export default function NumbersInterlude({ lessonId, onExit, onDone }: {
  lessonId: number
  onExit: () => void
  onDone: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  // движок держит свои обработчики; свежие колбэки — через ref, чтобы не перемонтировать уровень
  const cb = useRef({ onExit, onDone })
  cb.current = { onExit, onDone }
  useEffect(() => {
    if (!host.current) return
    return mountLevel(host.current, lessonId - 1, {
      onExit: () => cb.current.onExit(),
      onDone: () => cb.current.onDone()
    })
  }, [lessonId])
  return <div className="nm"><div className="nm-col" ref={host} /></div>
}
