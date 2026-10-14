import React, { useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import LetterIntro from './intro/LetterIntro'
import Morph from './games/Morph'
import Assemble from './games/Assemble'
import Finale from './games/Finale'
import { lessonGamePlan, lessonLetters } from './games/logic'

// Сцены урока алфавита между вопросами. Вопросы, их число и подсчёт верных ответов не меняются:
// сцены не отвечают на вопросы и не влияют на то, засчитан ли урок (это по-прежнему completeLesson).

export const ALPHABET_MODULE = 'alphabet-progressive'

type Result = Extract<Screen, { kind: 'result' }>

export type AlphabetScene =
  | { kind: 'intro'; letter: string; index: number; count: number }
  | { kind: 'mid' }
  | { kind: 'end'; result: Result; perfect: boolean }
  | { kind: 'finale'; result: Result }

type Pending = Exclude<AlphabetScene, { kind: 'intro' }>

export function useAlphabetLesson(moduleId: string, lessonId: number, questions: QuizQuestion[], index: number) {
  const on = moduleId === ALPHABET_MODULE
  const [introduced, setIntroduced] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Pending | null>(null)
  const letters = on ? lessonLetters(lessonId) : []
  const plan = on ? lessonGamePlan(lessonId, questions.length) : null

  // Новая буква — перед первым вопросом о ней.
  const lemma = questions[index]?.lemma ?? ''
  const intro: AlphabetScene | null = on && !pending && letters.includes(lemma) && !introduced.has(lemma)
    ? { kind: 'intro', letter: lemma, index: letters.indexOf(lemma), count: letters.length }
    : null

  return {
    scene: (pending ?? intro) as AlphabetScene | null,
    /** Ответили на n-й вопрос (1-based) и идём к следующему. */
    afterQuestion(n: number) {
      if (plan && n === plan.midAfter) setPending({ kind: 'mid' })
    },
    /** Урок закончен (прогресс уже отправлен): в алфавите — ещё игра и праздник, иначе сразу итог. */
    finish(result: Result, perfect: boolean, navigate: (s: Screen) => void) {
      if (plan) setPending({ kind: 'end', result, perfect })
      else navigate(result)
    },
    sceneDone(navigate: (s: Screen) => void) {
      const s = pending ?? intro
      if (!s) return
      if (s.kind === 'intro') { setIntroduced(new Set(introduced).add(s.letter)); return }
      if (s.kind === 'mid') { setPending(null); return }
      if (s.kind === 'end') { if (s.perfect) setPending({ kind: 'finale', result: s.result }); else navigate(s.result); return }
      navigate(s.result)
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
  switch (scene.kind) {
    case 'intro':
      return <LetterIntro key={scene.letter} letter={scene.letter} index={scene.index} count={scene.count} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'mid':
      return <Morph lesson={lessonId} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'end':
      return <Assemble lesson={lessonId} fraction={1} onExit={() => navigate(scene.result)} onDone={onDone} />
    case 'finale':
      return <Finale lesson={lessonId} onNext={onDone} onCafe={() => navigate({ kind: 'alphabet-cafe', back: scene.result })} />
  }
}
