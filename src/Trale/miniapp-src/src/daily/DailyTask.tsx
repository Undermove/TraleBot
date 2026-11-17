import React, { useEffect, useRef, useState } from 'react'
import Button from '../components/Button'
import LoaderLetter from '../components/LoaderLetter'
import { api, reportDailyOffer, saveDailyResult, type ProgressDto } from '../api'
import { publishProgress } from '../progress'
import type { Screen } from '../types'
import PlaySession from '../verbs/section/PlaySession'
import { bad, good } from '../verbs/ui/juice'
import { cyr } from '../verbs/types'
import {
  buildReport, emptyRun, finaleTitle, flowOf, georgianWords, hasGeorgian, minuteQuestions, plural, streakLine,
  type DailyRun, type MinuteQuestion
} from './logic'
import { Check, Intro, PairsGame, Warm } from './steps'
import { cachedDaily, loadDaily, setDaily } from './store'
import { DailyHeader, Geo, LinkButton, Page, Say, StepTitle } from './ui'
import type { DailyNew, DailyTaskDto } from './types'

// Экран «Задания дня»: вступление → разминка → пары → проверка → итог с «новым».
// Если задание уже сделано, экран сразу открывается итогом: так туда ведёт и карточка на главной.

type Stage =
  | { kind: 'intro' }
  | { kind: 'step'; at: number }
  | { kind: 'saving' }
  | { kind: 'save-failed' }
  | { kind: 'finale' }
  | { kind: 'minute' }

export default function DailyTask({ navigate }: { navigate: (s: Screen) => void }) {
  const [task, setTask] = useState<DailyTaskDto | null>(cachedDaily)
  const [loading, setLoading] = useState(!cachedDaily())
  const [stage, setStage] = useState<Stage>(() => (cachedDaily()?.done ? { kind: 'finale' } : { kind: 'intro' }))
  const [verb, setVerb] = useState<string | null>(null)
  const run = useRef<DailyRun>(emptyRun())
  const home = () => navigate({ kind: 'dashboard' })

  useEffect(() => {
    let alive = true
    loadDaily()
      .then(t => {
        if (!alive) return
        setTask(t)
        if (t?.done) setStage({ kind: 'finale' })
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  if (loading && !task) {
    return <Page testId="daily-loading"><div className="flex-1 flex items-center justify-center"><LoaderLetter /></div></Page>
  }
  if (!task) {
    return (
      <Page testId="daily-empty">
        <DailyHeader label="Задание дня" onExit={home} />
        <div className="flex-1 flex flex-col justify-center gap-4">
          <Say mood="think">Пока не из чего собрать задание: пройди урок или открой глагол — и завтра оно появится.</Say>
        </div>
        <div className="px-5"><Button onClick={home}>На главную</Button></div>
      </Page>
    )
  }

  const flow = flowOf(task)

  async function save() {
    setStage({ kind: 'saving' })
    try {
      const saved = await saveDailyResult(buildReport(task!, run.current))
      if (saved.progress) publishProgress(saved.progress as unknown as ProgressDto)
      setDaily(saved.task)
      setTask(saved.task)
      setStage({ kind: 'finale' })
    } catch {
      setStage({ kind: 'save-failed' })
    }
  }

  function next(at: number) {
    if (at + 1 < flow.length) setStage({ kind: 'step', at: at + 1 })
    else save()
  }

  async function takeOffer(offer: DailyNew) {
    if (offer.kind === 'check') return setStage({ kind: 'minute' })
    // Отметку о взятом «новом» не ждём дольше секунды: человек нажал — сразу открываем.
    await Promise.race([
      reportDailyOffer({ day: task!.day, outcome: 'opened' }).then(r => setDaily(r.task)).catch(() => {}),
      new Promise(r => setTimeout(r, 1000))
    ])
    if (offer.kind === 'forms' && offer.verbId) setVerb(offer.verbId)
    else if (offer.kind === 'lesson' && offer.moduleId && offer.lessonId) {
      navigate({ kind: 'lesson-theory', moduleId: offer.moduleId, lessonId: offer.lessonId })
    }
  }

  if (verb) return <PlaySession verbId={verb} onExit={home} />

  switch (stage.kind) {
    case 'intro':
      return <Intro task={task} onExit={home} onStart={() => { run.current = emptyRun(); setStage({ kind: 'step', at: 0 }) }} />

    case 'step': {
      const head = { steps: flow.length, at: stage.at + 1, onExit: home }
      const step = flow[stage.at]
      if (step === 'warm') {
        return <Warm {...head} rounds={task.warm} onDone={wrong => { run.current = { ...run.current, warmWrong: wrong }; next(stage.at) }} />
      }
      if (step === 'game') {
        return (
          <PairsGame
            {...head} pairs={task.pairs} seconds={task.seconds}
            onDone={r => {
              run.current = { ...run.current, errors: run.current.errors + r.errors, pairWrong: [...new Set([...run.current.pairWrong, ...r.wrong])], seconds: r.seconds }
              next(stage.at)
            }}
          />
        )
      }
      return <Check {...head} check={task.check} onDone={errors => { run.current = { ...run.current, checkErrors: errors }; next(stage.at) }} />
    }

    case 'saving':
    case 'save-failed':
      return (
        <Page testId="daily-saving">
          <DailyHeader label="Задание дня" onExit={home} />
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            {stage.kind === 'saving' ? <LoaderLetter /> : (
              <Say mood="think" testId="daily-save-failed">Связь пропала, итог не отправился. Он не потерян: нажми «Отправить ещё раз».</Say>
            )}
          </div>
          {stage.kind === 'save-failed' && <div className="px-5"><Button onClick={save}>Отправить ещё раз</Button></div>}
        </Page>
      )

    case 'minute':
      return task.offer?.kind === 'check'
        ? <MinuteCheck task={task} offer={task.offer} onDone={t => { setDaily(t); setTask(t); setStage({ kind: 'finale' }) }} onExit={home} />
        : null

    case 'finale':
      return <Finale task={task} onOffer={takeOffer} onHome={home} />
  }
}

// ── Итог ─────────────────────────────────────────────────────────────────────

function Finale({ task, onOffer, onHome }: { task: DailyTaskDto; onOffer: (o: DailyNew) => void; onHome: () => void }) {
  const result = task.result
  const errors = result?.errors ?? 0
  const offer = task.offer && !task.offerTaken ? task.offer : null
  const say = offer ? offer.say
    : task.offer && task.offerTaken ? 'На сегодня всё. Завтра будет новое задание.'
    : task.mode === 'review' ? 'Знакомое закреплено. Завтра, если игра пройдёт чисто, возьмём новое.'
    : errors > 1 ? `Нового сегодня нет: в игре ${errors} ${plural(errors, 'ошибка', 'ошибки', 'ошибок')}. Завтра повторим эти формы ещё раз.`
    : 'На сегодня всё. Завтра будет новое задание.'

  return (
    <Page testId="daily-finale">
      <DailyHeader label={`Задание дня · ${task.title}`} onExit={onHome} />
      <StepTitle eyebrow="Сделано">{finaleTitle(task.mode, errors)}</StepTitle>
      <div className="px-5 mt-3 grid grid-cols-2 gap-2.5">
        <div className="jewel-tile px-3 py-3 text-center" data-testid="daily-streak">
          <div className="text-[24px] font-extrabold leading-none tabular-nums">{result?.streak ?? 0}</div>
          <div className="mt-1 text-[12px] font-bold text-jewelInk-mid">{streakLine(result?.streak ?? 0)}</div>
        </div>
        <div className="jewel-tile px-3 py-3 text-center" data-testid="daily-xp">
          <div className="text-[24px] font-extrabold leading-none tabular-nums text-navy">+{result?.xpEarned ?? 0}</div>
          <div className="mt-1 text-[12px] font-bold text-jewelInk-mid">опыта</div>
        </div>
      </div>
      <div className="px-5 mt-2 text-center text-[13px] font-semibold text-jewelInk-mid" data-testid="daily-stat">
        {errors === 0 ? 'Игра без ошибок' : `В игре ${errors} ${plural(errors, 'ошибка', 'ошибки', 'ошибок')}`}
      </div>
      <div className="flex-1 min-h-[12px]" />
      {offer && (
        <div className="px-5 mb-3">
          <div className="jewel-tile px-4 py-3" data-testid="daily-offer" data-kind={offer.kind}>
            <div className="mn-eyebrow text-ruby">Новое</div>
            <div className="mt-0.5 text-[16px] font-extrabold leading-tight">{offer.title}</div>
            <div className="mt-0.5 text-[12px] text-jewelInk-mid">{offer.line}</div>
          </div>
        </div>
      )}
      <Say mood={offer ? 'guide' : 'cheer'} testId="daily-finale-say">{say}</Say>
      <div className="px-5 mt-3 flex flex-col gap-1">
        {offer ? (
          <>
            <Button onClick={() => onOffer(offer)}>{offer.button}</Button>
            <LinkButton onClick={onHome} testId="daily-home">На главную</LinkButton>
          </>
        ) : (
          <Button onClick={onHome}>На главную</Button>
        )}
      </div>
    </Page>
  )
}

// ── Минутная проверка модуля ─────────────────────────────────────────────────

/** По вопросу из каждого пропущенного урока; модуль закрыт, только если все ответы верные. */
function MinuteCheck({ task, offer, onDone, onExit }: {
  task: DailyTaskDto; offer: DailyNew; onDone: (t: DailyTaskDto) => void; onExit: () => void
}) {
  const [questions, setQuestions] = useState<MinuteQuestion[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [errors, setErrors] = useState(0)
  const [outcome, setOutcome] = useState<'passed' | 'failed' | null>(null)
  const [sending, setSending] = useState(false)
  const [updated, setUpdated] = useState<DailyTaskDto | null>(null)

  useEffect(() => {
    const lessons = offer.checkLessons ?? []
    Promise.all(lessons.map(lessonId =>
      api.lessonQuestions(offer.moduleId!, lessonId).then(qs => ({ lessonId, questions: qs as any[] })).catch(() => ({ lessonId, questions: [] }))))
      .then(byLesson => setQuestions(minuteQuestions(byLesson, task.day)))
      .catch(() => setFailed(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(result: 'passed' | 'failed') {
    setOutcome(result)
    setSending(true)
    try {
      const r = await reportDailyOffer({ day: task.day, outcome: result })
      setUpdated(r.task)
    } catch {
      // Не отправилось — проверку предложат снова; человек ничего не теряет.
    } finally {
      setSending(false)
    }
  }

  if (failed || (questions && questions.length === 0)) {
    return (
      <Page testId="daily-minute">
        <DailyHeader label={`Проверка · ${offer.title}`} onExit={onExit} />
        <div className="flex-1 flex flex-col justify-center"><Say mood="think">Не получилось загрузить вопросы. Попробуй позже.</Say></div>
        <div className="px-5"><Button onClick={onExit}>На главную</Button></div>
      </Page>
    )
  }
  if (!questions) {
    return <Page testId="daily-minute"><div className="flex-1 flex items-center justify-center"><LoaderLetter /></div></Page>
  }

  if (outcome) {
    const passed = outcome === 'passed'
    return (
      <Page testId="daily-minute-result">
        <DailyHeader label={`Проверка · ${offer.title}`} onExit={onExit} />
        <StepTitle eyebrow="Проверка">{passed ? 'Модуль закрыт' : 'Есть пробелы'}</StepTitle>
        <div className="flex-1 flex flex-col justify-center">
          <Say mood={passed ? 'cheer' : 'think'} testId="daily-minute-say">
            {passed
              ? `Все ${questions.length} ${plural(questions.length, 'ответ', 'ответа', 'ответов')} верные: пропущенные уроки модуля «${offer.title}» тебе не нужны. Дальше пойдём по курсу.`
              : `${errors} ${plural(errors, 'ошибка', 'ошибки', 'ошибок')} из ${questions.length}. Пропущенные уроки пригодятся: со следующего дня будем проходить их по одному.`}
          </Say>
        </div>
        <div className="px-5">
          <Button onClick={() => (updated ? onDone(updated) : onExit())} disabled={sending}>Готово</Button>
        </div>
      </Page>
    )
  }

  const q = questions[i]
  const words = georgianWords(q.question)
  function pick(at: number, el: Element) {
    if (picked !== null) return
    setPicked(at)
    if (at === q.answerIndex) good(el)
    else { bad(); setErrors(e => e + 1) }
  }
  function onward() {
    if (i + 1 < questions!.length) { setI(i + 1); setPicked(null) }
    else finish(errors === 0 ? 'passed' : 'failed')
  }

  return (
    <Page testId="daily-minute">
      <DailyHeader steps={questions.length} at={i + 1} onExit={onExit} />
      <StepTitle eyebrow={`Проверка · ${offer.title}`}>{q.question}</StepTitle>
      {words.length > 0 && (
        <div className="px-5 mt-1 text-[13px] font-semibold text-jewelInk-hint" data-testid="daily-minute-cyr">
          {words.map(w => `${w} — ${cyr(w)}`).join(' · ')}
        </div>
      )}
      <div className="flex-1 min-h-[8px]" />
      <div className="px-5 flex flex-col gap-2.5">
        {q.options.map((o, at) => {
          const tone = picked === null ? 'bg-cream-tile'
            : at === q.answerIndex ? 'bg-navy-wash'
            : at === picked ? 'bg-ruby-wash anim-shake' : 'bg-cream-tile opacity-50'
          return (
            <button
              key={`${i}-${at}`} onClick={e => pick(at, e.currentTarget)} disabled={picked !== null}
              data-testid="daily-minute-option" data-ok={at === q.answerIndex ? 'yes' : 'no'}
              className={`min-h-[52px] rounded-xl border-[1.5px] border-jewelInk px-4 py-2 text-center ${tone}`}
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              {hasGeorgian(o) ? <Geo ka={o} className="text-[18px]" cyrClassName="text-[12px]" /> : <span className="text-[15px] font-bold leading-tight">{o}</span>}
            </button>
          )
        })}
      </div>
      <div className={`px-5 mt-3 ${picked === null ? 'invisible' : ''}`}>
        <Button onClick={onward} disabled={picked === null}>{i + 1 < questions.length ? 'Дальше' : 'Готово'}</Button>
      </div>
    </Page>
  )
}

