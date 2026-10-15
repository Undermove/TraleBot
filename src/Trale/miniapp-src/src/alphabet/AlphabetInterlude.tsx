import React, { useEffect, useMemo, useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import LetterIntro from './intro/LetterIntro'
import Morph from './games/Morph'
import Assemble from './games/Assemble'
import Catch from './games/Catch'
import SoundLetter from './games/SoundLetter'
import Pairs from './games/Pairs'
import Dialogue from './games/Dialogue'
import Finale from './games/Finale'
import Cafe from './cafe/Cafe'
import { cafeReady } from './cafe/products'
import WordIntro from './words/WordIntro'
import { EXAM_SIZE, assembleRounds, lessonLetters, lessonSteps, morphWords, pairsDeck, type LessonStep, type WordGame } from './games/logic'
import { dialogueReady } from './games/dialogues'
import { ALPHABET_LESSONS, lessonInfo, wordsUpToLesson } from './lessons'
import { lessonFlow, type StepKind } from '../analytics/lessonEvents'

/** Как шаг урока называется в аналитике (LessonEvents.StepKind). */
export const STEP_KIND: Record<LessonStep['kind'], StepKind> = {
  intro: 'letter-intro', catch: 'catch', sound: 'sound-letter', pairs: 'pairs', words: 'new-word',
  morph: 'morph', assemble: 'assemble', dialogue: 'dialogue', cafe: 'cafe'
}

// Урок алфавита — цепочка коротких игр (logic.lessonSteps), потом короткая проверка — вопросы урока с сервера
// (alphabetExam). Прогресс считается как раньше: completeLesson с correct/total этих вопросов, урок засчитан
// только без ошибок. Игры на вопросы не отвечают и на зачёт не влияют.
//   Урок букв (id 1..11): знакомство с тремя буквами и игры на буквы; проверка — по вопросу на каждую букву.
//   Урок слов (id 12+): каждое слово урока — своя сцена «Новое слово», потом 2–3 игры со словами; проверка — 4 вопроса.

export const ALPHABET_MODULE = 'alphabet-progressive'

/** Вопросы проверки: в уроке букв — последний вопрос о каждой букве, в уроке слов — последние EXAM_SIZE. */
export function alphabetExam<T extends { lemma?: string }>(questions: T[], lessonId: number): T[] {
  const lesson = lessonInfo(lessonId)
  if (lesson.kind === 'words') return questions.slice(-EXAM_SIZE)
  const picked = lessonLetters(lesson.stage)
    .map(l => questions.filter(q => q.lemma === l).pop())
    .filter((q): q is T => !!q)
  return picked.length ? picked : questions.slice(-EXAM_SIZE)
}

type Result = Extract<Screen, { kind: 'result' }>

export type AlphabetScene =
  | { kind: 'step'; step: LessonStep }
  | { kind: 'finale'; result: Result }

/** Какие игры со словами доступны уроку слов: каждой хватает уже знакомых слов. */
export function wordGamesFor(lessonId: number) {
  const lesson = lessonInfo(lessonId)
  const own = lesson.kind === 'words' ? lesson.words : []
  const known = wordsUpToLesson(lessonId)
  const pool = { own, known }
  const index = ALPHABET_LESSONS.filter(l => l.kind === 'words').findIndex(l => l.id === lessonId)
  const available = (g: WordGame): boolean => {
    if (g === 'morph') return morphWords(lesson.stage, 2, () => 0.5, pool).length >= 1
    if (g === 'assemble') return assembleRounds(lesson.stage, 2, () => 0.5, pool).length >= 1
    if (g === 'pairs') return pairsDeck('words', lesson.stage, () => 0.5, pool).length >= 6
    if (g === 'dialogue') return dialogueReady(lesson.stage, own, known)
    return cafeReady(lesson.stage)
  }
  return { lesson, pool, index: Math.max(0, index), available }
}

export function useAlphabetLesson(moduleId: string, lessonId: number, questions: QuizQuestion[], _index: number) {
  const on = moduleId === ALPHABET_MODULE
  const steps = useMemo(() => {
    if (!on) return []
    const g = wordGamesFor(lessonId)
    return lessonSteps(g.lesson, g.index, g.available)
  }, [on, lessonId])
  const [at, setAt] = useState(0)
  const [finale, setFinale] = useState<Result | null>(null)

  const scene: AlphabetScene | null = on && questions.length && at < steps.length
    ? { kind: 'step', step: steps[at] }
    : finale ? { kind: 'finale', result: finale } : null

  // Аналитика хода урока: шаг 0 — стартовый экран, дальше игры, проверка, праздник.
  const loaded = questions.length > 0
  const stage = !on || !loaded ? null : at < steps.length ? `step-${at}` : finale ? 'finale' : 'check'
  useEffect(() => {
    if (!stage) return
    if (stage === 'finale') lessonFlow.step(moduleId, lessonId, steps.length + 2, 'finale')
    else if (stage === 'check') lessonFlow.step(moduleId, lessonId, steps.length + 1, 'check')
    else lessonFlow.step(moduleId, lessonId, at + 1, STEP_KIND[steps[at].kind])
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  // Ушёл из урока посреди (назад, другой экран) — «выход»; закончил — ничего.
  useEffect(() => () => { if (on) lessonFlow.exit() }, [on])

  return {
    scene,
    /** Доля урока для полоски сверху: игры — первые 80%, проверка — остальное. */
    progress: (index: number, total: number) => (on ? Math.min(at, steps.length) / Math.max(1, steps.length) * 0.8 + (at >= steps.length ? (index / Math.max(1, total)) * 0.2 : 0) : index / Math.max(1, total)),
    afterQuestion(_n: number) { /* игры — до проверки */ },
    /** Урок закончен (прогресс уже отправлен): засчитан — праздник, иначе сразу итог. */
    finish(result: Result, perfect: boolean, navigate: (s: Screen) => void) {
      if (on) { lessonFlow.done(result.correct); lessonFlow.end(perfect ? 'lesson_complete' : 'lesson_fail', result.correct) }
      if (on && perfect) setFinale(result)
      else navigate(result)
    },
    sceneDone(navigate: (s: Screen) => void) {
      if (!scene) return
      if (scene.kind === 'step') { lessonFlow.done(); setAt(a => a + 1); return }
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
  const { lesson, pool } = useMemo(() => wordGamesFor(lessonId), [lessonId])
  if (scene.kind === 'finale')
    return <Finale lessonId={lessonId} onNext={onDone} onVocabulary={() => navigate({ kind: 'vocabulary-list' })} />
  const step = scene.step
  const common = { lesson: lesson.stage, fraction, onExit, onDone }
  switch (step.kind) {
    case 'intro':
      return <LetterIntro key={step.letter} letter={step.letter} index={step.index} count={3} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'catch':
      return <Catch key="catch" letters={step.letters} {...common} />
    case 'sound':
      return <SoundLetter key="sound" {...common} />
    case 'pairs':
      return <Pairs key={`pairs-${step.deck}`} deck={step.deck} pool={step.deck === 'words' ? pool : undefined} {...common} />
    case 'words':
      return <WordIntro key="words" featured={pool.own} startCount={pool.known.length - pool.own.length} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'morph':
      return <Morph key="morph" pool={pool} {...common} />
    case 'assemble':
      return <Assemble key="assemble" pool={pool} {...common} />
    case 'dialogue':
      return <Dialogue key="dialogue" stage={lesson.stage} own={pool.own} known={pool.known} fraction={fraction} onExit={onExit} onDone={onDone} />
    case 'cafe':
      return <Cafe key="cafe" {...common} />
  }
}
