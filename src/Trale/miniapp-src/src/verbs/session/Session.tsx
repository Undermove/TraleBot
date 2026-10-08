import React, { useEffect, useMemo, useRef, useState } from 'react'
import { publishProgress } from '../../progress'
import LoaderLetter from '../../components/LoaderLetter'
import { fetchVerb } from '../../api'
import type { TenseKey, VerbDto } from '../types'
import Bones from '../games/Bones'
import Builder from '../games/Builder'
import { schemeOf } from '../games/formParts'
import TimeMachine from '../games/TimeMachine'
import { STEP, buildItems, settleCapped, type LadderItem, type Progress } from '../ladder/engine'
import { readPending, toProgress } from '../ladder/progressStore'
import StoryReader from '../story/StoryReader'
import type { VerbStoryDto } from '../story/types'
import { SessionChrome, type SceneHooks } from '../ui/GameShell'
import { OVERLAY, useOverlay } from '../ui/overlayStack'
import { planContext } from './context'
import Finish from './Finish'
import { planSession, totalUnits } from './plan'
import PrefixIntro from '../family/PrefixIntro'
import PrefixScene, { type PrefixCheckResult } from '../family/PrefixScene'
import { PREFIX_INTRO_HINT, isPrefixSession, planPrefixSession } from '../family/prefixPlan'
import { hintSeen } from '../ui/hints'
import QuizScene, { type ExamResult } from './QuizScene'
import { createSessionSync } from './sync'
import { QUIZ_SCENES, type SessionPlan, type VerbLearningDto, type VerbSessionSavedDto } from './types'

// Сессия: 2–3 минуты с одним глаголом, несколько коротких сцен подряд. Какие сцены — решает
// постановщик (plan.ts); здесь — оболочка: полоска этой сессии, смена сцен, сохранение после каждого
// ответа и финиш. Всё состояние — на сервере: перезагрузка или другое устройство продолжают с того же места.

interface Run { id: string; plan: SessionPlan; scene: number; done: number }

interface Props {
  verb: VerbDto
  stories: VerbStoryDto[]
  learning: VerbLearningDto
  /** Выход: отдаём последнее известное состояние, чтобы вид глагола сразу показал новый уровень. */
  onExit: (latest: VerbLearningDto | null) => void
}

const newId = () =>
  crypto.randomUUID?.() ?? '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16))

/** Начатую сессию продолжаем, если её план читается; иначе собираем новую. */
function startRun(verb: VerbDto, stories: VerbStoryDto[], learning: VerbLearningDto, items: LadderItem[], progress: Progress): Run & { resumed: boolean } {
  const s = learning.session
  if (s && s.plan?.v === 1 && s.plan.scenes?.length && s.scene < s.plan.scenes.length) {
    return { id: s.id, plan: s.plan, scene: s.scene, done: s.done, resumed: true }
  }
  // Глагол из семьи при выученном основном: учить осталось приставку, а не окончания.
  const plan = verb.family && isPrefixSession(learning)
    ? planPrefixSession({ verb, learning, items, progress, introSeen: hintSeen(PREFIX_INTRO_HINT) })
    : null
  return { id: newId(), plan: plan?.scenes.length ? plan : planSession(planContext(verb, learning, stories, items, progress)), scene: 0, done: 0, resumed: false }
}

export default function Session({ verb, stories, learning: initial, onExit }: Props) {
  const items = useMemo(() => buildItems(verb), [verb])
  const byKey = useMemo(() => new Map(items.map(i => [i.key, i])), [items])
  const [learning, setLearning] = useState(initial)
  // Несохранённые ответы новее того, что знает сервер.
  const progress = useRef<Progress>(toProgress(initial.progress.forms, readPending(verb.id)))
  const [run, setRun] = useState(() => startRun(verb, stories, initial, items, progress.current))
  const sync = useMemo(() => createSessionSync(verb.id, run.id, run.plan), [verb.id, run.id, run.plan])
  /** Где сейчас сессия — без задержки перерисовки: сцены сообщают о шагах быстрее, чем React обновляет состояние. */
  const at = useRef({ scene: run.scene, done: run.done })
  /** С какого шага начать текущую сцену: не ноль только у сцены, на которой сессию продолжили. */
  const [startAt, setStartAt] = useState(run.done)
  /** Формы, которые были в игре в этой сессии: верно с первой попытки или нет. */
  const touched = useRef(new Map<string, boolean>())
  const exam = useRef<ExamResult | null>(null)
  /** Уровень глагола до этой сессии — финиш сравнивает с ним («было — стало»). */
  const [levelBefore, setLevelBefore] = useState(initial.level)
  const [finish, setFinish] = useState<{ saved: VerbSessionSavedDto | null } | 'saving' | null>(null)
  const [extraPreverbs, setExtraPreverbs] = useState<string[]>([])

  // Сессия появляется на сервере сразу, а не с первым ответом: закрыл на первом экране — продолжишь её же.
  useEffect(() => { if (!run.resumed) sync.beat(0, 0) }, [sync, run.resumed])

  // Конструктору нужна чужая приставка для ложного варианта — берём у глагола-образца из каталога.
  const wantsBuilder = run.plan.scenes.some(s => s.type === 'builder')
  useEffect(() => {
    if (!wantsBuilder || !verb.model) return
    let alive = true
    fetchVerb(verb.model.id)
      .then(model => {
        const preverb = model.status === 'verified' ? schemeOf(model)?.preverb : undefined
        if (alive && preverb) setExtraPreverbs([preverb])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [wantsBuilder, verb])

  const exit = () => onExit(finish && finish !== 'saving' && finish.saved ? finish.saved.state : null)
  useOverlay(exit, OVERLAY.screen)

  // Полоска — только про эту сессию: растёт с каждым пройденным заданием и назад не идёт.
  const total = totalUnits(run.plan)
  const before = run.plan.scenes.slice(0, run.scene).reduce((n, s) => n + s.units, 0)
  const current = run.plan.scenes[run.scene]
  const fraction = finish ? 1 : total ? (before + Math.min(run.done, current?.units ?? 0)) / total : 0
  const peak = useRef(0)
  peak.current = Math.max(peak.current, fraction)

  const hooks: SceneHooks = {
    startAt,
    onResult(cell, ok, ceiling, introduceNew) {
      const key = `${cell.tense}:${cell.person}`
      const item = byKey.get(key)
      if (!item) return
      touched.current.set(key, ok && (touched.current.get(key) ?? true))
      const next = settleCapped(item, progress.current[key], ok, ceiling, introduceNew)
      if (!next) return
      progress.current = { ...progress.current, [key]: next }
      sync.record(item, next)
    },
    onStep() {
      at.current = { ...at.current, done: at.current.done + 1 }
      sync.beat(at.current.scene, at.current.done)
      setRun(r => ({ ...r, done: at.current.done }))
    },
    onDone() {
      if (current?.type === 'story') sync.storyDone()
      const next = at.current.scene + 1
      if (next < run.plan.scenes.length) {
        at.current = { scene: next, done: 0 }
        sync.beat(next, 0)
        setStartAt(0)
        setRun(r => ({ ...r, scene: next, done: 0 }))
        return
      }
      setFinish('saving')
      const tally = exam.current
      void sync.finish(tally ? { asked: tally.asked, correct: tally.correct } : undefined).then(saved => {
        if (saved) setLearning(saved.state)
        if (saved?.progress) publishProgress(saved.progress)
        setFinish({ saved })
      })
    }
  }

  function another() {
    const state = finish && finish !== 'saving' && finish.saved ? finish.saved.state : learning
    progress.current = toProgress(state.progress.forms, readPending(verb.id))
    touched.current = new Map()
    exam.current = null
    peak.current = 0
    setLevelBefore(state.level)
    const next = startRun(verb, stories, { ...state, session: null }, items, progress.current)
    at.current = { scene: 0, done: 0 }
    setStartAt(0)
    setRun(next)
    setFinish(null)
  }

  // Комикс из плана мог исчезнуть (план старый, каталог обновился) — такую сцену пропускаем.
  const story = current?.type === 'story' ? stories.find(s => s.id === current.storyId) : undefined
  const skip = !finish && !!current && current.type === 'story' && !story
  useEffect(() => { if (skip) hooks.onDone() })

  const slot = (key: string) => {
    const [tense, person] = key.split(':')
    return { tense: tense as TenseKey, person: Number(person) }
  }

  function scene() {
    if (!current || skip) return null
    const key = `${run.id}:${run.scene}`
    if (QUIZ_SCENES.includes(current.type)) {
      const tasks = (current.tasks ?? []).filter(t => byKey.has(t.key))
      return (
        <QuizScene
          key={key} verb={verb} items={items} tasks={tasks} progress={() => progress.current} scene={hooks}
          onExam={current.type === 'exam' ? result => { exam.current = result } : undefined}
        />
      )
    }
    if (current.type === 'time') return <TimeMachine key={key} verb={verb} onExit={exit} scene={{ ...hooks, targets: (current.targets ?? []).map(slot) }} />
    if (current.type === 'bones') {
      return <Bones key={key} verb={verb} onExit={exit} scene={{ ...hooks, tenses: current.tenses ?? [], persons: current.persons ?? [], typing: current.typing }} />
    }
    if (current.type === 'builder') {
      return (
        <Builder
          key={key} verb={verb} onExit={exit} extraPreverbs={extraPreverbs}
          scene={{ ...hooks, rounds: current.rounds ?? 3, solvedBefore: current.solvedBefore ?? 0 }}
        />
      )
    }
    if (current.type === 'prefixintro' && current.familyId) return <PrefixIntro key={key} familyId={current.familyId} scene={hooks} onExit={exit} />
    if ((current.type === 'prefix' || current.type === 'prefixcheck') && current.familyId) {
      return (
        <PrefixScene
          key={key} verbId={verb.id} familyId={current.familyId} rounds={current.prefixRounds ?? []} onExit={exit}
          scene={{ ...hooks, onKnown: markKnown }}
          onCheck={current.type === 'prefixcheck' ? result => { exam.current = prefixExam(result) } : undefined}
        />
      )
    }
    return story ? <StoryReader key={key} story={story} onExit={exit} scene={hooks} /> : null
  }

  /** Слово верно выбрано в проверке приставки: окончания сданы с основным глаголом — оно уходит на повторение. */
  function markKnown(cell: { tense: string; person: number }) {
    const key = `${cell.tense}:${cell.person}`
    const item = byKey.get(key)
    const state = progress.current[key]
    if (!item || (state && state.step >= STEP.MASTERED)) return
    const next = { step: STEP.MASTERED, best: STEP.MASTERED, reviews: state?.reviews ?? 0, due: false }
    progress.current = { ...progress.current, [key]: next }
    sync.record(item, next)
  }

  /** Итог проверки приставки тем же видом, что итог экзамена: его ждут отчёт и финиш. */
  function prefixExam(result: PrefixCheckResult): ExamResult {
    return {
      asked: result.asked, correct: result.correct,
      missed: result.missed.map(c => byKey.get(`${c.tense}:${c.person}`)).filter((i): i is LadderItem => !!i)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-cream overflow-y-auto" data-testid="verb-session"
      data-scene={finish ? 'finish' : current?.type} data-scene-index={run.scene} data-reason={current?.reason}
    >
      <div className="w-full max-w-[480px] mx-auto">
        <SessionChrome.Provider value={{ fraction: peak.current, onExit: exit }}>
          {finish === 'saving' && (
            <div className="min-h-[100dvh] flex items-center justify-center" data-testid="session-saving"><LoaderLetter size={96} /></div>
          )}
          {finish && finish !== 'saving' && (
            <Finish
              verb={verb} items={items} touched={touched.current} exam={exam.current}
              levelBefore={levelBefore} saved={finish.saved} progress={progress.current}
              prefix={run.plan.scenes.some(s => s.type === 'prefixcheck')}
              onMore={another} onDone={exit}
            />
          )}
          {!finish && scene()}
        </SessionChrome.Provider>
      </div>
    </div>
  )
}
