import React, { useMemo, useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import LetterIntro from './intro/LetterIntro'
import Morph from './games/Morph'
import Assemble from './games/Assemble'
import Catch from './games/Catch'
import SoundLetter from './games/SoundLetter'
import Pairs from './games/Pairs'
import Finale from './games/Finale'
import Cafe from './cafe/Cafe'
import { cafeReady } from './cafe/products'
import WordIntro from './words/WordIntro'
import { EXAM_SIZE, lessonSteps, wordCount, wordIntroPlan, type LessonStep } from './games/logic'

// Урок алфавита — цепочка коротких игр (logic.lessonSteps): знакомство с буквами, «Поймай букву», «Пары»,
// «Звук → буква», новые слова, «Превращение» / «Собери слово», «Кафе». Потом короткая проверка —
// EXAM_SIZE последних вопросов урока с сервера: прогресс считается как раньше (completeLesson с correct/total
// этих вопросов, урок засчитан только без ошибок). Игры на вопросы не отвечают и на зачёт не влияют.

export const ALPHABET_MODULE = 'alphabet-progressive'

/** Какие вопросы урока алфавита играем: последние EXAM_SIZE — короткая проверка в конце. */
export const alphabetExam = <T,>(questions: T[]): T[] => questions.slice(-EXAM_SIZE)

type Result = Extract<Screen, { kind: 'result' }>

export type AlphabetScene =
  | { kind: 'step'; step: LessonStep; lemmas: string[] }
  | { kind: 'finale'; result: Result }

export function useAlphabetLesson(moduleId: string, lessonId: number, questions: QuizQuestion[], _index: number) {
  const on = moduleId === ALPHABET_MODULE
  const steps = useMemo(() => (on ? lessonSteps(lessonId, cafeReady) : []), [on, lessonId])
  const [at, setAt] = useState(0)
  const [finale, setFinale] = useState<Result | null>(null)
  const lemmas = questions.map(q => q.lemma ?? '')

  const scene: AlphabetScene | null = on && questions.length && at < steps.length
    ? { kind: 'step', step: steps[at], lemmas }
    : finale ? { kind: 'finale', result: finale } : null

  return {
    scene,
    /** Доля урока для полоски сверху: игры — первые 80%, проверка — остальное. */
    progress: (index: number, total: number) => (on ? Math.min(at, steps.length) / Math.max(1, steps.length) * 0.8 + (at >= steps.length ? (index / Math.max(1, total)) * 0.2 : 0) : index / Math.max(1, total)),
    afterQuestion(_n: number) { /* игры — до проверки */ },
    /** Урок закончен (прогресс уже отправлен): засчитан — праздник, иначе сразу итог. */
    finish(result: Result, perfect: boolean, navigate: (s: Screen) => void) {
      if (on && perfect) setFinale(result)
      else navigate(result)
    },
    sceneDone(navigate: (s: Screen) => void) {
      if (!scene) return
      if (scene.kind === 'step') { setAt(a => a + 1); return }
      navigate(scene.result)
    }
  }
}

export default function AlphabetInterlude({ scene, lessonId, fraction, onExit, onDone, navigate }: {
  scene: AlphabetScene
  lessonId: number
  fraction: number
  onExit: () => void
  onDone: () => void
  navigate: (s: Screen) => void
}) {
  if (scene.kind === 'finale')
    return <Finale lesson={lessonId} onNext={onDone} onVocabulary={() => navigate({ kind: 'vocabulary-list' })} />
  const step = scene.step
  const common = { lesson: lessonId, fraction, onExit, onDone }
  switch (step.kind) {
    case 'intro':
      return <LetterIntro key={step.letter} letter={step.letter} index={step.index} count={3} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'catch':
      return <Catch key="catch" letters={step.letters} {...common} />
    case 'sound':
      return <SoundLetter key="sound" {...common} />
    case 'pairs':
      return <Pairs key={`pairs-${step.deck}`} deck={step.deck} {...common} />
    case 'words': {
      const plan = wordIntroPlan(lessonId, scene.lemmas, null)
      return <WordIntro key="words" featured={plan?.featured ?? []} rest={plan?.rest ?? []} startCount={lessonId > 1 ? wordCount(lessonId - 1) : 0} fraction={fraction} onExit={onExit} onDone={onDone} />
    }
    case 'morph':
      return <Morph key="morph" {...common} />
    case 'assemble':
      return <Assemble key="assemble" {...common} />
    case 'cafe':
      return <Cafe key="cafe" {...common} />
  }
}
