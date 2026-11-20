import React, { useEffect, useState } from 'react'
import { appEvents } from '../analytics/appEvents'
import { devDailyPush, devNextDay, devResetDailyGift, reportDailyOffer } from '../api'
import Button from '../components/Button'
import type { Screen } from '../types'
import { days, formsAndWords, streakLine } from './logic'
import { cachedDaily, loadDaily, onDaily, setDaily } from './store'
import GiftHero, { GiftState } from '../today/GiftHero'
import GiftReveal, { giftClaimed, unclaimGift, utcDay } from '../today/GiftReveal'
import TodayIntro, { forgetTodayIntro, shouldShowTodayIntro } from '../today/TodayIntro'
import type { DailyNew, DailyTaskDto } from './types'
import GiftWarp from '../today/GiftWarp'
import GiftUnbox from '../today/GiftUnbox'
import { cachedGift, loadGift, onGift, setGift, type DailyGiftDto } from '../today/gift'

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

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}

/** Реплика Бомборы, пока за день ничего не сделано: коротко, в пузырь. */
function shortNudge(streak: number, firstTime: boolean, stepsCount: number): string {
  if (firstTime) return 'Привет! Пройди первый урок — там подарок'
  const steps = stepsCount > 1 ? 'Два шага' : 'Один урок'
  if (streak >= 1) return `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд! ${steps} — и подарок твой`
  return `${steps} — и подарок твой`
}

/** Всё сделано: когда будет новый подарок (день задания — по UTC, как серия). */
function doneLine(): string {
  const now = new Date()
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const min = Math.max(1, Math.round((next - now.getTime()) / 60000))
  const h = Math.floor(min / 60)
  return h >= 1 ? `Новый подарок через ${h} ${plural(h, 'час', 'часа', 'часов')}` : `Новый подарок через ${min} мин`
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
interface Props {
  lesson: CourseLesson | null
  navigate: (s: Screen) => void
  /** Серия дней подряд — чтобы сказать, что сегодня её можно не прервать. */
  streak?: number
  /** Сегодня уже занимался — тогда кнопка не торопит. */
  playedToday?: boolean
  /** Ни одного пройденного урока: первый заход, кнопка — «первый урок». */
  firstTime?: boolean
  /** Бомбора для сцены (настроение считает главная; mood — если сцене есть чему радоваться). Нет — карточка без сцены. */
  mascot?: (mood?: 'happy' | 'cheer') => React.ReactNode
  /** Что говорит Бомбора, когда торопить не о чем. */
  greeting?: string
  /** Есть опыт — человек учился до обновления: показать «что нового». */
  hasXp?: boolean
  /** Нажали на Бомбору — покормить. */
  onFeed?: () => void
}

/** Строчка над кнопкой: зачем жать именно сейчас. Мягко, но прямо; после занятия — ничего. */
export function nudgeLine(streak: number, playedToday: boolean, firstTime: boolean): string | null {
  if (playedToday) return null
  if (firstTime) return 'Первый урок — пара минут. Бомбора покажет, что делать'
  if (streak >= 1) return `Серия — ${days(streak)} подряд. Позанимайся сегодня, чтобы она не прервалась`
  return 'Пара минут сегодня — и начнётся серия'
}

export default function TodayCard({ lesson, navigate, streak = 0, playedToday = false, firstTime = false, mascot, greeting = 'Привет!', hasXp = false, onFeed }: Props) {
  const [task, setTask] = useState<DailyTaskDto | null>(cachedDaily)
  const [claimedTick, setClaimedTick] = useState(0)
  const [reveal, setReveal] = useState(false)
  /** Какую коробку распаковываем — запоминаем при нажатии: после ответа сервера она уже «открыта». */
  const [revealBox, setRevealBox] = useState<number | null>(null)
  const [cheer, setCheer] = useState(false)
  useEffect(() => {
    if (!cheer) return
    const id = setTimeout(() => setCheer(false), 6000)
    return () => clearTimeout(id)
  }, [cheer])
  const [intro, setIntro] = useState(() => shouldShowTodayIntro(hasXp))
  const [devNote, setDevNote] = useState<string | null>(null)

  useEffect(() => {
    loadDaily().catch(() => {})
    return onDaily(setTask)
  }, [])
  // Подарок дня с сервера (редкости, шансы, вторая коробка); нет — остаётся простой подарок на этом телефоне.
  const [g, setG] = useState<DailyGiftDto | null>(cachedGift)
  useEffect(() => onGift(setG), [])
  useEffect(() => { loadGift().catch(() => {}) }, [task?.day, task?.done, task?.extras])

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
      done: false, button: firstTime ? 'Начать первый урок' : 'Пройти урок', go: () => navigate(lesson.screen)
    })
  }

  if (steps.length === 0) return null
  const next = steps.find(s => !s.done) ?? null
  const nudge = next && !steps.some(s => s.done) ? nudgeLine(streak, playedToday, firstTime) : null
  // Подарок дня — награда в конце: открывается, когда шаги дня пройдены (без задания — когда сегодня был урок).
  const day = task?.day ?? utcDay()
  // С заданием: повторение сделано и «новое» (если сервер его предложил) открыто. Урок курса вместо «нового» — уже по желанию.
  const ready = task ? task.done && (!task.offer || task.offerTaken) : playedToday
  // Задание дня ещё не сделано, а подарок помечен открытым (день перезапустили) — он снова закрыт.
  if (task && !task.done && giftClaimed(day)) unclaimGift(day)
  const claimed = ready && giftClaimed(day) && claimedTick >= 0
  const localGift: GiftState = !ready ? 'locked' : claimed ? 'claimed' : 'ready'
  // С сервера: коробка за задание, потом — вторая за ещё один раунд.
  const box0 = g?.boxes.find(b => b.box === 0)
  const box1 = g?.boxes.find(b => b.box === 1)
  const openBox = box0?.ready && !box0.opened ? 0 : box1?.ready && !box1.opened ? 1 : null
  const gift: GiftState = !g ? localGift : openBox != null ? 'ready' : box0?.opened ? 'claimed' : 'locked'
  const moreBox = Boolean(g && box0?.opened && box1 && !box1.ready && !box1.opened)
  const doneCount = steps.filter(s => s.done).length
  const say = g && gift === 'locked' && !firstTime && task && !task.done ? 'Пройди задание дня — и подарок твой!'
    : moreBox ? 'Ещё раунд — и вторая коробка твоя'
    : gift === 'claimed' ? doneLine()
    : gift === 'ready' ? 'Готово! Открывай подарок'
    : g && nudge && !firstTime ? (streak >= 1 ? `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд! Две минуты — и подарок твой` : 'Две минуты — и подарок твой')
    : nudge ? shortNudge(streak, firstTime, task ? steps.length : 1)
    : doneCount > 0 ? 'Ещё шаг — и подарок твой' : greeting
  const lockedSay = g && task && !task.done ? 'Ключ от подарка — в занятии. Погнали!'
    : firstTime ? 'Пройди первый урок — и подарок твой'
    : task ? (doneCount > 0 ? 'Остался один шаг — и открывай' : 'Пройди оба шага — и подарок твой')
    : 'Пройди урок — и подарок твой'
  const openGift = () => { setRevealBox(openBox); setReveal(true) }
  const playMore = () => navigate({ kind: 'daily', extra: true })
  /** Ключ от подарка — занятие: сразу первое упражнение. */
  const playForGift = () => navigate({ kind: 'daily', start: true })
  /** Переход «подарок → задание»: подарок вылетает, замок трясётся, экран заливает волной. */
  const [warp, setWarp] = useState<{ from: DOMRect | null } | null>(null)
  const warpToLesson = (from?: DOMRect | null) => {
    const rect = from ?? document.querySelector('[data-testid="gift-button"]')?.getBoundingClientRect() ?? null
    setWarp({ from: rect })
  }

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
      {mascot && (
        <GiftHero mascot={mascot(cheer || gift !== 'locked' ? 'cheer' : undefined)} say={say} gift={gift} lockedSay={lockedSay} onOpen={openGift} onBombora={() => onFeed?.()}
          rarity={box0?.rarity ?? 0} lockChip={g ? (task?.mode === 'comeback' ? 'минута занятия' : '2 минуты занятия') : 'в конце дня'}
          onLocked={g && task && !task.done ? (from) => { appEvents.tap('today-gift-locked-go'); warpToLesson(from) } : undefined} />
      )}
      {warp && <GiftWarp from={warp.from} onDone={playForGift} />}
      {reveal && g && revealBox != null && (
        <GiftUnbox gift={g} box={revealBox} onCheer={() => setCheer(true)}
          onClose={() => setReveal(false)} onMore={() => { setReveal(false); playMore() }}
          onHome={tab => { setReveal(false); navigate({ kind: 'bombora-home', tab }) }} />
      )}
      {reveal && (!g || revealBox == null) && (
        <GiftReveal day={day} xp={task?.result ? task.result.xpEarned : null} streak={Math.max(streak, task?.result?.streak ?? 0)}
          onCheer={() => setCheer(true)}
          onClose={() => { setReveal(false); setClaimedTick(t => t + 1) }} />
      )}
      {intro && <TodayIntro personal={Boolean(task)} onClose={() => setIntro(false)} />}
      <div className="jewel-tile mt-2 w-full px-4 pt-3 pb-3" data-testid="dashboard-today" data-next={next?.id ?? 'none'}>
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
            {gift === 'ready' && mascot ? (
              <div data-testid="dashboard-gift-cta" className="today-nudge">
                <Button variant="green" onClick={() => { appEvents.tap('today-gift-button'); openGift() }}>{openBox === 1 ? 'Открыть вторую коробку' : 'Открыть подарок'}</Button>
              </div>
            ) : g && mascot && gift === 'locked' && next ? (
              <div data-testid="dashboard-suggestion" className="today-nudge">
                <Button onClick={() => { appEvents.tap('today-gift-claim'); task && !task.done && mascot != null ? warpToLesson() : next.go() }}>
                  <span className="flex flex-col items-center leading-tight">
                    <span>Забрать подарок</span>
                    <span className="text-[11.500px] font-bold opacity-85" data-testid="dashboard-gift-sub">сначала {task?.mode === 'comeback' ? 'минута' : '2 минуты'} занятия</span>
                  </span>
                </Button>
              </div>
            ) : moreBox ? (
              <div data-testid="dashboard-gift-more" className="today-nudge">
                <Button onClick={() => { appEvents.tap('today-gift-more'); playMore() }}>Ещё раунд → вторая коробка</Button>
              </div>
            ) : next ? (
              <div data-testid="dashboard-suggestion" className={nudge ? 'today-nudge' : ''}>
                {nudge && !mascot && (
                  <div className="mb-2 px-1 text-center font-sans text-[13px] font-bold leading-snug text-ruby" data-testid="dashboard-nudge">{nudge}</div>
                )}
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
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-0.5 text-[11px] font-semibold text-jewelInk-hint [&>button]:min-h-[30px]" data-testid="daily-dev">
          <span>стенд:</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(1), 'наступил следующий день')}>+1 день</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(() => devNextDay(7), 'прошла неделя')}>+7 дней</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => dev(devDailyPush, 'сообщение отправлено')}>пуш</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" data-testid="dev-gift-again" onClick={() => {
            unclaimGift(day); setClaimedTick(t => t + 1)
            if (g) devResetDailyGift().then(setGift).then(() => setDevNote('коробки снова закрыты')).catch(() => setDevNote('не получилось'))
            else setDevNote(ready ? 'подарок снова закрыт' : 'подарок откроется, когда шаги пройдены')
          }}>подарок заново</button>
          <span>·</span>
          <button className="min-h-[44px] px-1.5 underline" onClick={() => { forgetTodayIntro(); setIntro(true) }}>что нового</button>
          {devNote && <span className="w-full text-center" data-testid="daily-dev-note">{devNote}</span>}
        </div>
      )}
    </>
  )
}
