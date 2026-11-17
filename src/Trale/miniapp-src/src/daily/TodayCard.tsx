import React, { useEffect, useState } from 'react'
import { appEvents } from '../analytics/appEvents'
import { devDailyPush, devNextDay, reportDailyOffer } from '../api'
import Button from '../components/Button'
import type { Screen } from '../types'
import { formsAndWords, streakLine } from './logic'
import { cachedDaily, loadDaily, onDaily, setDaily } from './store'
import type { DailyNew, DailyTaskDto } from './types'

/** Следующий урок курса, как его находит главная: первый непройденный по порядку модулей. */
export interface CourseLesson {
  title: string
  /** «Знакомство · урок 3». */
  subtitle: string
  screen: Screen
}

/** Один шаг дня: повторение или новое. */
interface Step {
  id: 'review' | 'new'
  label: string
  title: string
  line: string
  done: boolean
  /** Подпись большой кнопки, когда этот шаг — следующий. */
  button: string
  go: () => void
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.500L19 7.500" />
  </svg>
)

/**
 * «Сегодня» — единственный призыв на главной: план дня из двух шагов, «Повторение» (задание дня) и «Новое»
 * (то, что задание предложит в конце, или следующий урок курса). Большая кнопка ведёт к первому несделанному
 * шагу. Без задания дня (нет доступа или материала) остаётся один шаг — следующий урок.
 */
export default function TodayCard({ lesson, navigate }: { lesson: CourseLesson | null; navigate: (s: Screen) => void }) {
  const [task, setTask] = useState<DailyTaskDto | null>(cachedDaily)
  const [devNote, setDevNote] = useState<string | null>(null)

  useEffect(() => {
    loadDaily().catch(() => {})
    return onDaily(setTask)
  }, [])

  const openDaily = () => navigate({ kind: 'daily' })

  /** Новое из задания: урок курса — сразу в урок, формы и проверка — через экран задания, там их сценарий. */
  function openOffer(offer: DailyNew) {
    if (offer.kind === 'lesson' && offer.moduleId && offer.lessonId) {
      if (task?.done) reportDailyOffer({ day: task.day, outcome: 'opened' }).then(r => setDaily(r.task)).catch(() => {})
      navigate({ kind: 'lesson-theory', moduleId: offer.moduleId, lessonId: offer.lessonId })
    } else openDaily()
  }

  const steps: Step[] = []
  if (task) {
    steps.push({
      id: 'review',
      label: 'Повторение',
      title: task.done ? streakLine(task.result?.streak ?? 0) : task.title,
      line: task.done ? 'Сделано на сегодня' : `${formsAndWords(task.pairs)} · ${task.mode === 'comeback' ? 'одна минута' : 'две минуты'}`,
      done: task.done,
      button: task.mode === 'comeback' ? 'Начать · 1 минута' : 'Начать · 2 минуты',
      go: openDaily
    })
  }
  // Что задание предложит (до занятия) или уже предложило (после); его нет — следующий урок курса.
  const offer = task ? (task.done ? task.offer : task.next) : null
  if (offer) {
    steps.push({
      id: 'new', label: 'Новое', title: offer.title, line: offer.line,
      done: task!.done && task!.offerTaken, button: offer.button, go: () => openOffer(offer)
    })
  } else if (lesson) {
    steps.push({
      id: 'new', label: task ? 'Новое' : 'Следующий урок', title: lesson.title, line: lesson.subtitle,
      done: false, button: 'Пройти урок', go: () => navigate(lesson.screen)
    })
  }

  if (steps.length === 0) return null
  const next = steps.find(s => !s.done) ?? null

  async function dev(action: () => Promise<{ task?: DailyTaskDto; ok?: boolean }>, note: string) {
    setDevNote('…')
    try {
      const r = await action()
      if (r.task) setDaily(r.task.available ? r.task : null)
      setDevNote(r.ok === false ? 'задание уже сделано — сообщения нет' : note)
    } catch {
      setDevNote('не получилось')
    }
  }

  return (
    <>
      <div className="jewel-tile mt-4 w-full px-4 pt-4 pb-4" data-testid="dashboard-today" data-next={next?.id ?? 'none'}>
        <div className="relative z-[1]">
          <div className="flex items-baseline justify-between px-1">
            <div className="mn-eyebrow text-ruby">Сегодня</div>
            {steps.length > 1 && (
              <div className="font-sans text-[11px] font-bold text-jewelInk-mid tabular-nums" data-testid="dashboard-today-count">
                {steps.filter(s => s.done).length} из {steps.length}
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-col">
            {steps.map((s, i) => {
              const isNext = s === next
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { appEvents.tap(`today-${s.id}`); s.go() }}
                  data-testid={s.id === 'review' ? 'dashboard-daily' : 'dashboard-today-new'}
                  data-state={s.done ? 'done' : isNext ? 'next' : 'later'}
                  className={`w-full text-left flex items-center gap-3 rounded-xl px-1 py-2.5 active:bg-cream-deep ${i > 0 ? 'border-t border-jewelInk/10' : ''}`}
                >
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full border-[1.5px] border-jewelInk flex items-center justify-center font-sans text-[14px] font-extrabold ${
                      s.done ? 'bg-navy text-cream' : isNext ? 'bg-gold text-jewelInk' : 'bg-cream text-jewelInk-mid'
                    }`}
                  >
                    {s.done ? <Check /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-jewelInk-mid">{s.label}</div>
                    <div
                      className={`font-sans text-[15px] font-bold leading-tight truncate ${s.done ? 'text-jewelInk-mid' : 'text-jewelInk'}`}
                      data-testid={s.id === 'review' ? 'dashboard-daily-title' : undefined}
                    >
                      {s.title}
                    </div>
                    <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5 truncate" data-testid={s.id === 'review' ? 'dashboard-daily-line' : undefined}>
                      {s.line}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-jewelInk-hint">
                    <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            })}
          </div>
          <div className="mt-3">
            {next ? (
              <div data-testid="dashboard-suggestion">
                <Button onClick={() => { appEvents.tap('today-button'); next.go() }}>{next.button}</Button>
              </div>
            ) : (
              <div className="text-center" data-testid="dashboard-today-done">
                <div className="font-sans text-[14px] font-bold text-jewelInk">На сегодня всё. Завтра будет новое.</div>
                {task && (
                  <button
                    type="button"
                    onClick={() => { appEvents.tap('today-extra'); openDaily() }}
                    className="mt-1 min-h-[44px] px-2 font-sans text-[13px] font-bold text-ruby underline"
                    data-testid="dashboard-today-extra"
                  >
                    Ещё раунд · +10 опыта
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {task?.dev && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[12px] font-semibold text-jewelInk-hint" data-testid="daily-dev">
          <span>стенд:</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(1), 'наступил следующий день')}>+1 день</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(7), 'прошла неделя')}>+7 дней</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(devDailyPush, 'сообщение отправлено')}>сообщение бота</button>
          {devNote && <span className="w-full text-center" data-testid="daily-dev-note">{devNote}</span>}
        </div>
      )}
    </>
  )
}
