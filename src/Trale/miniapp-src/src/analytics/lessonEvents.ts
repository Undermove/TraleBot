/**
 * Где люди уходят из урока: мини-апп копит события шагов урока и раз в несколько секунд (и когда приложение
 * прячут или закрывают) отправляет их пачкой на POST /api/miniapp/events → таблица LessonEvents.
 * Запрос на запрос не похож: fetch с keepalive (sendBeacon не умеет заголовок авторизации Telegram).
 * Никогда не мешает уроку: ошибки глотаются, ничего не ждёт. Выключен вне Telegram (нет initData),
 * в тестах и на стенде ?alphabet-lab. Сервер сам отбрасывает незнакомые события.
 *
 * Общий для модулей: lessonFlow.open(модуль, урок) → step(позиция, вид) → done()/skip() → end('lesson_complete'|'lesson_fail')
 * или exit() (ушёл посреди урока). Размечены алфавит и «Знакомство».
 */

export type StepKind =
  | 'opener' | 'letter-intro' | 'how-to-write' | 'catch' | 'sound-letter' | 'pairs' | 'new-word' | 'morph'
  | 'assemble' | 'dialogue' | 'cafe' | 'check' | 'finale' | 'lesson'
  | 'greeting' | 'first-word' | 'tour' | 'celebration'
  // «Знакомство» (ModuleId "intro").
  | 'new-phrase' | 'rule' | 'yard' | 'walk' | 'bakery' | 'pingpong' | 'minibus' | 'elevator' | 'party' | 'magnets' | 'border' | 'reception' | 'detective' | 'chat' | 'taxi'
  | 'family' | 'havesort' | 'aboutme' | 'supra'
export type LessonEventName =
  | 'lesson_open' | 'step_start' | 'step_done' | 'step_skip' | 'lesson_complete' | 'lesson_fail' | 'lesson_exit'

export interface LessonEventDto {
  moduleId: string
  lessonId: number
  step: number
  stepKind: StepKind
  event: LessonEventName
  value?: number
}

const FLUSH_MS = 4000
const BATCH = 50
const MAX_QUEUE = 200

let queue: LessonEventDto[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false
/** Для тестов: куда отправлять вместо сети. */
let sender: ((events: LessonEventDto[]) => void) | null = null

function initData(): string {
  try { return (window as any).Telegram?.WebApp?.initData ?? '' } catch { return '' }
}

export function trackingEnabled(): boolean {
  try {
    if (sender) return true
    if ((import.meta as any).env?.MODE === 'test') return false
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).has('alphabet-lab') || new URLSearchParams(window.location.search).has('intro-lab')) return false
    // e2e: вне Telegram SDK оставляет initData пустым — тест включает трекер явно.
    if ((window as any).__lessonEventsOn === true) return true
    return initData() !== ''
  } catch { return false }
}

function send(events: LessonEventDto[]) {
  if (sender) { sender(events); return }
  try {
    void fetch('/api/miniapp/events', {
      method: 'POST',
      keepalive: true,
      headers: { 'X-Telegram-Init-Data': initData(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    }).catch(() => {})
  } catch { /* аналитика не мешает уроку */ }
}

export function flushLessonEvents() {
  if (timer) { clearTimeout(timer); timer = null }
  while (queue.length) send(queue.splice(0, BATCH))
}

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { lessonFlow.exit(); flushLessonEvents() }
  })
  window.addEventListener('pagehide', () => { lessonFlow.exit(); flushLessonEvents() })
}

export function trackLessonEvent(e: LessonEventDto) {
  if (!trackingEnabled()) return
  listen()
  if (queue.length >= MAX_QUEUE) return
  queue.push(e)
  if (queue.length >= BATCH) flushLessonEvents()
  else if (!timer) timer = setTimeout(flushLessonEvents, FLUSH_MS)
}

interface Flow { moduleId: string; lessonId: number; step: number; kind: StepKind; ended: boolean; exited: boolean }
let flow: Flow | null = null

function emit(event: LessonEventName, value?: number) {
  if (!flow) return
  trackLessonEvent({ moduleId: flow.moduleId, lessonId: flow.lessonId, step: flow.step, stepKind: flow.kind, event, ...(value != null ? { value } : {}) })
}

/** Ход одного урока: какой шаг сейчас — чтобы «пропустить» и «ушёл» знали, где это случилось. */
export const lessonFlow = {
  /** Открыт стартовый экран урока (шаг 0). */
  open(moduleId: string, lessonId: number, kind: StepKind = 'opener') {
    flow = { moduleId, lessonId, step: 0, kind, ended: false, exited: false }
    emit('lesson_open')
  },
  /** Начался шаг урока; урок без open() (пришли сразу в практику) начинается здесь же. */
  step(moduleId: string, lessonId: number, step: number, kind: StepKind) {
    if (!flow || flow.moduleId !== moduleId || flow.lessonId !== lessonId || flow.ended) {
      flow = { moduleId, lessonId, step, kind, ended: false, exited: false }
    } else {
      // Тот же шаг ещё раз (перерисовка) — не новый старт.
      if (flow.step === step && flow.kind === kind && !flow.exited) return
      flow.step = step; flow.kind = kind; flow.exited = false
    }
    emit('step_start')
  },
  done(value?: number) { if (flow && !flow.ended) emit('step_done', value) },
  /** В шаге нажали «пропустить». */
  skip() { if (flow && !flow.ended) emit('step_skip') },
  end(event: 'lesson_complete' | 'lesson_fail', value?: number) {
    if (!flow || flow.ended) return
    emit(event, value)
    flow.ended = true
  },
  /** Ушёл посреди урока (назад, приложение спрятали или закрыли). Ничего, если урок уже закончен. */
  exit() {
    if (!flow || flow.ended || flow.exited) return
    emit('lesson_exit')
    flow.exited = true
  }
}

/** Только для тестов. */
export function __setLessonEventSender(fn: ((events: LessonEventDto[]) => void) | null) {
  sender = fn; queue = []; flow = null
  if (timer) { clearTimeout(timer); timer = null }
}
