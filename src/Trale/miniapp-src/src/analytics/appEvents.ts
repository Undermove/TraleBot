/**
 * Что человек делает в мини-аппе вне урока: приложение открылось (скрипт запустился), загрузилось (первый экран
 * получил данные) или не смогло, какой экран показан, открылась шторка покупки, приложение спрятали или закрыли.
 * Уходит на POST /api/miniapp/app-events → таблица AppEvents (запросы — docs/analytics/app-funnel.sql).
 * Шаги уроков — отдельно, в lessonEvents.ts.
 *
 * Открытие и уход отправляются сразу: человек, который закрыл приложение на загрузке, иначе не успеет ничего
 * отправить. Остальное копится и уходит пачкой раз в несколько секунд. Никогда ничему не мешает: ошибки
 * глотаются, ничего не ждёт. Выключен вне Telegram (нет initData), в тестах и на стендах ?alphabet-lab, ?intro-lab.
 */

export type AppEventName = 'app_open' | 'app_ready' | 'app_error' | 'app_hide' | 'screen' | 'paywall'

export interface AppEventDto {
  event: AppEventName
  /** Экран (`dashboard`, `verbs`…) для screen и app_hide; что открыло шторку — для paywall. */
  target?: string
  /** Мс с начала загрузки страницы для app_open, app_ready, app_error; секунды в приложении для app_hide. */
  value?: number
  platform?: string
  startParam?: string
}

const FLUSH_MS = 4000
const BATCH = 50
const MAX_QUEUE = 200

let queue: AppEventDto[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false
let currentScreen: string | null = null
let openedAt: number | null = null
/** Для тестов: куда отправлять вместо сети. */
let sender: ((events: AppEventDto[]) => void) | null = null

function tg(): any {
  try { return (window as any).Telegram?.WebApp } catch { return undefined }
}

function enabled(): boolean {
  try {
    if (sender) return true
    if ((import.meta as any).env?.MODE === 'test') return false
    if (typeof window === 'undefined') return false
    const q = new URLSearchParams(window.location.search)
    if (q.has('alphabet-lab') || q.has('intro-lab')) return false
    // e2e: вне Telegram SDK оставляет initData пустым — тест включает трекер явно.
    if ((window as any).__appEventsOn === true) return true
    return (tg()?.initData ?? '') !== ''
  } catch { return false }
}

function sinceLoad(): number {
  try { return Math.round(performance.now()) } catch { return 0 }
}

function send(events: AppEventDto[]) {
  if (sender) { sender(events); return }
  try {
    void fetch('/api/miniapp/app-events', {
      method: 'POST',
      keepalive: true,
      headers: { 'X-Telegram-Init-Data': tg()?.initData ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    }).catch(() => {})
  } catch { /* аналитика ничему не мешает */ }
}

export function flushAppEvents() {
  if (timer) { clearTimeout(timer); timer = null }
  while (queue.length) send(queue.splice(0, BATCH))
}

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  const hide = () => {
    track({ event: 'app_hide', target: currentScreen ?? 'loading', value: openedAt == null ? undefined : Math.round((Date.now() - openedAt) / 1000) })
    flushAppEvents()
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hide() })
  window.addEventListener('pagehide', hide)
}

function track(e: AppEventDto, now = false) {
  if (!enabled()) return
  listen()
  if (queue.length >= MAX_QUEUE) return
  queue.push(e)
  if (now || queue.length >= BATCH) flushAppEvents()
  else if (!timer) timer = setTimeout(flushAppEvents, FLUSH_MS)
}

export const appEvents = {
  /** Скрипт приложения запустился: сколько ушло на загрузку страницы и скрипта, с какого клиента и по какой ссылке. */
  opened() {
    openedAt = Date.now()
    const t = tg()
    track({
      event: 'app_open',
      value: sinceLoad(),
      ...(t?.platform ? { platform: String(t.platform) } : {}),
      ...(t?.initDataUnsafe?.start_param ? { startParam: String(t.initDataUnsafe.start_param) } : {})
    }, true)
  },
  /** Первый экран получил данные; target «no-auth» — сервер не узнал человека, приложение открылось гостем. */
  ready(signedIn: boolean) {
    track({ event: 'app_ready', value: sinceLoad(), ...(signedIn ? {} : { target: 'no-auth' }) }, true)
  },
  /** Первый экран не загрузился (показана ошибка загрузки). */
  failed() {
    track({ event: 'app_error', value: sinceLoad() }, true)
  },
  /** Показан экран; тот же экран ещё раз (перерисовка) — не новый показ. Загрузку и админку не считаем. */
  screen(kind: string) {
    if (kind === 'loading' || kind.startsWith('admin') || kind === currentScreen) return
    currentScreen = kind
    track({ event: 'screen', target: kind })
  },
  /** Открылась шторка покупки; target — что её открыло. */
  paywall(trigger: string) {
    track({ event: 'paywall', target: trigger })
  }
}

/** Только для тестов. */
export function __setAppEventSender(fn: ((events: AppEventDto[]) => void) | null) {
  sender = fn; queue = []; currentScreen = null; openedAt = null
  if (timer) { clearTimeout(timer); timer = null }
}
