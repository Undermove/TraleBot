import React, { useEffect, useMemo, useState } from 'react'
import type { QuizQuestion, Screen } from '../types'
import { lessonFlow, type StepKind } from '../analytics/lessonEvents'
import { INTRO_MODULE, introLesson, type IntroStep } from './story'
import type { SceneProps } from './scenes/types'
import PhraseScene from './scenes/PhraseScene'
import RuleScene from './scenes/RuleScene'
import Yard from './scenes/Yard'
import Walk from './scenes/Walk'
import Elevator from './scenes/Elevator'
import Party from './scenes/Party'
import Magnets from './scenes/Magnets'
import Border from './scenes/Border'
import Detective from './scenes/Detective'
import Chat from './scenes/Chat'
import Taxi from './scenes/Taxi'
import Family from './scenes/Family'
import HaveSort from './scenes/HaveSort'
import AboutMe from './scenes/AboutMe'
import Supra from './scenes/Supra'
import StoryFinale from './scenes/StoryFinale'

// Урок «Знакомства» — цепочка сцен из story.json (новая фраза → правило → игра урока), потом короткая
// проверка вопросами урока (introExam), потом праздник, если без ошибок. Тот же контракт, что у алфавита
// (useAlphabetLesson): Practice спрашивает scene, рисует её вместо вопроса и зовёт sceneDone/finish.

/** Как сцена называется в аналитике (LessonEvents.StepKind). */
export const INTRO_STEP_KIND: Record<IntroStep['kind'], StepKind> = {
  phrase: 'new-phrase', rule: 'rule', yard: 'yard', walk: 'walk', elevator: 'elevator', party: 'party', magnets: 'magnets',
  border: 'border', detective: 'detective', chat: 'chat', taxi: 'taxi', family: 'family', havesort: 'havesort',
  aboutme: 'aboutme', supra: 'supra'
}

type Result = Extract<Screen, { kind: 'result' }>

export type IntroScene =
  | { kind: 'step'; step: IntroStep; index: number }
  | { kind: 'finale'; result: Result }

export function useIntroLesson(moduleId: string, lessonId: number, questions: QuizQuestion[]) {
  const on = moduleId === INTRO_MODULE
  const steps = useMemo(() => (on ? introLesson(lessonId).steps : []), [on, lessonId])
  const [at, setAt] = useState(0)
  const [finale, setFinale] = useState<Result | null>(null)

  const scene: IntroScene | null = on && questions.length && at < steps.length
    ? { kind: 'step', step: steps[at], index: at }
    : finale ? { kind: 'finale', result: finale } : null

  const loaded = questions.length > 0
  const stage = !on || !loaded ? null : at < steps.length ? `step-${at}` : finale ? 'finale' : 'check'
  useEffect(() => {
    if (!stage) return
    if (stage === 'finale') lessonFlow.step(moduleId, lessonId, steps.length + 2, 'finale')
    else if (stage === 'check') lessonFlow.step(moduleId, lessonId, steps.length + 1, 'check')
    else lessonFlow.step(moduleId, lessonId, at + 1, INTRO_STEP_KIND[steps[at].kind])
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (on) lessonFlow.exit() }, [on])

  return {
    on,
    scene,
    /** Полоска урока: сцены — первые 80%, проверка — остальное. */
    progress: (index: number, total: number) => (on
      ? Math.min(at, steps.length) / Math.max(1, steps.length) * 0.8 + (at >= steps.length ? (index / Math.max(1, total)) * 0.2 : 0)
      : index / Math.max(1, total)),
    afterQuestion(_n: number) { /* сцены — до проверки */ },
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

export default function IntroInterlude({ scene, lessonId, fraction, onExit, onDone }: {
  scene: IntroScene
  lessonId: number
  fraction: number
  onExit: () => void
  onDone: () => void
}) {
  const lesson = introLesson(lessonId)
  if (scene.kind === 'finale') return <StoryFinale lesson={lesson} onNext={onDone} />
  const step = scene.step
  const key = `${lessonId}-${scene.index}`
  const p = { lesson, fraction, onExit, onDone } as const
  const props = <S extends IntroStep>(s: S): SceneProps<S> => ({ ...p, step: s })
  switch (step.kind) {
    case 'phrase': return <PhraseScene key={key} {...props(step)} />
    case 'rule': return <RuleScene key={key} {...props(step)} />
    case 'yard': return <Yard key={key} {...props(step)} />
    case 'walk': return <Walk key={key} {...props(step)} />
    case 'elevator': return <Elevator key={key} {...props(step)} />
    case 'party': return <Party key={key} {...props(step)} />
    case 'magnets': return <Magnets key={key} {...props(step)} />
    case 'border': return <Border key={key} {...props(step)} />
    case 'detective': return <Detective key={key} {...props(step)} />
    case 'chat': return <Chat key={key} {...props(step)} />
    case 'taxi': return <Taxi key={key} {...props(step)} />
    case 'family': return <Family key={key} {...props(step)} />
    case 'havesort': return <HaveSort key={key} {...props(step)} />
    case 'aboutme': return <AboutMe key={key} {...props(step)} />
    case 'supra': return <Supra key={key} {...props(step)} />
  }
}
