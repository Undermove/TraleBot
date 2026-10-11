import type { Screen } from '../types'

// Навигация админки: у каждого экрана свой адрес (?screen=admin-…), чтобы на него можно было дать прямую
// ссылку, и свой «уровень выше», куда ведёт «Назад» — и в шапке, и системная кнопка Telegram.

type Admin = Extract<Screen, { kind: `admin${string}` | 'verb-review' }>

export const isAdminScreen = (s: Screen): s is Admin => s.kind === 'verb-review' || s.kind.startsWith('admin')

// ── Вкладки ──
// Пять вкладок нижней панели. У каждой свой стек экранов: «список → детали → назад» происходит внутри
// вкладки, а при переключении вкладка открывается там, где её оставили. Повторный тап по активной
// вкладке возвращает на её корень.

export type AdminTab = 'stats' | 'people' | 'feedback' | 'broadcasts' | 'more'

export const TAB_ROOT: Record<AdminTab, Screen> = {
  stats: { kind: 'admin' },
  people: { kind: 'admin-users' },
  feedback: { kind: 'admin-feedback', view: 'threads' },
  broadcasts: { kind: 'admin-broadcasts' },
  more: { kind: 'admin-more' }
}

/** Вкладка, которой экран принадлежит сам по себе, — куда он попадает, если открыт по прямой ссылке. */
export function homeTab(s: Admin): AdminTab {
  switch (s.kind) {
    case 'admin': return 'stats'
    case 'admin-users': case 'admin-user': return 'people'
    case 'admin-feedback': case 'admin-survey': return 'feedback'
    case 'admin-broadcasts': case 'admin-broadcast': return 'broadcasts'
    default: return 'more'
  }
}

/** Подраздел «Связи» (сообщения / опросы / экран покупки) — корень вкладки, а не экран глубже. */
const isSegment = (s: Screen) => s.kind === 'admin-feedback' && (s.view === undefined || typeof s.view === 'string')
const same = (a: Screen, b: Screen) => isAdminScreen(a) && isAdminScreen(b) && adminLink(a) === adminLink(b)

export type Move = 'push' | 'pop' | 'switch' | 'same'

const nav = {
  tab: null as AdminTab | null,
  stacks: {} as Partial<Record<AdminTab, Screen[]>>,
  scroll: new Map<string, number>(),
  epoch: 0,
  pending: null as Move | null
}

export const currentTab = () => nav.tab
const stack = (tab: AdminTab) => (nav.stacks[tab] ??= [TAB_ROOT[tab]])

/**
 * Приложение переходит на экран админки — навигация запоминает, где он в стеках вкладок, и говорит, что это
 * было: шаг вглубь, возврат, смена вкладки. От этого зависит прокрутка: вглубь — с начала, обратно — где были.
 */
export function enterAdmin(s: Admin): Move {
  const pending = nav.pending
  nav.pending = null
  if (nav.tab === null) {
    // Вход по прямой ссылке или из профиля: вкладка экрана, под ним — её корень.
    nav.tab = homeTab(s)
    nav.stacks[nav.tab] = same(s, TAB_ROOT[nav.tab]) || isSegment(s) ? [s] : [TAB_ROOT[nav.tab], s]
    return 'push'
  }
  const own = stack(nav.tab)
  if (same(own[own.length - 1], s)) return pending ?? 'same'
  const at = own.findIndex(x => same(x, s))
  if (at >= 0) { own.length = at + 1; return 'pop' }
  // Подразделы «Связи» сменяют друг друга на месте корня.
  if (isSegment(s) && isSegment(own[own.length - 1])) { own[own.length - 1] = s; return 'push' }
  const root = (Object.keys(TAB_ROOT) as AdminTab[]).find(t => same(TAB_ROOT[t], s) || (t === 'feedback' && isSegment(s)))
  if (root && root !== nav.tab) {
    nav.tab = root
    if (isSegment(s)) nav.stacks[root] = [s]
    return 'switch'
  }
  own.push(s)
  return 'push'
}

/** Куда ведёт «Назад»: предыдущий экран той же вкладки; с корня вкладки — в профиль. */
export function adminBack(): Screen {
  if (nav.tab === null) return { kind: 'profile' }
  const own = stack(nav.tab)
  if (own.length <= 1) { leaveAdmin(); return { kind: 'profile' } }
  own.pop()
  nav.pending = 'pop'
  return own[own.length - 1]
}

/** Тап по вкладке: другая открывается там, где её оставили; активная — сбрасывается на корень. */
export function selectTab(tab: AdminTab): Screen {
  if (tab === nav.tab) {
    for (const s of stack(tab)) nav.scroll.delete(adminLink(s as Admin))
    nav.stacks[tab] = [TAB_ROOT[tab]]
    for (const key of [...kept.keys()]) if (key.startsWith(`${tab}/`)) kept.delete(key)
    nav.epoch += 1
    nav.pending = 'push'
  } else {
    nav.tab = tab
    nav.pending = 'switch'
  }
  const own = stack(tab)
  return own[own.length - 1]
}

/** Растёт при сбросе вкладки на корень: экран с тем же адресом пересоздаётся с чистым состоянием. */
export const tabEpoch = () => nav.epoch

/** Вышли из админки — в следующий раз она откроется с начала. */
export function leaveAdmin() {
  nav.tab = null
  nav.stacks = {}
  nav.scroll.clear()
  nav.pending = null
  kept.clear()
}

export const rememberScroll = (s: Screen, y: number) => { if (isAdminScreen(s)) nav.scroll.set(adminLink(s), y) }
export const scrollOf = (s: Screen) => (isAdminScreen(s) ? nav.scroll.get(adminLink(s)) ?? 0 : 0)

// То, что экран хочет помнить, пока владелец ходит по другим вкладкам и вглубь: фильтры, поиск, загруженный
// список. Ключ начинается с имени вкладки — повторный тап по ней всё это стирает.
const kept = new Map<string, unknown>()
export const keptValue = <T>(key: string, initial: T): T => (kept.has(key) ? (kept.get(key) as T) : initial)
export const keep = (key: string, value: unknown) => { kept.set(key, value) }

// Сфокусированный режим: пошаговый сценарий (новая рассылка, конструктор опроса, один глагол) занимает весь
// экран — нижняя панель вкладок прячется. Экран включает режим, пока он открыт.
let focused = false
const watchers = new Set<() => void>()
export const isFocused = () => focused
export const watchFocus = (on: () => void) => { watchers.add(on); return () => { watchers.delete(on) } }
export function setFocused(on: boolean) {
  if (focused === on) return
  focused = on
  watchers.forEach(w => w())
}

const NAME = /^[a-z0-9][a-z0-9_-]{2,47}$/
const id = (value: string | null) => (value && /^\d{1,15}$/.test(value) ? Number(value) : null)
const name = (value: string | null) => (value && NAME.test(value) ? value : null)

/** Экран админки по адресу; null — адрес не про админку. Кто не владелец, тому сервер ничего не отдаст. */
export function parseAdminLink(query: URLSearchParams): Screen | null {
  const key = name(query.get('key'))
  const person = id(query.get('id'))
  switch (query.get('screen')) {
    case 'admin': return { kind: 'admin' }
    case 'admin-users': return { kind: 'admin-users' }
    case 'admin-user': return person ? { kind: 'admin-user', telegramId: person } : { kind: 'admin-users' }
    case 'admin-messages': return { kind: 'admin-feedback', view: person ? { thread: person } : 'threads' }
    case 'admin-feedback': return { kind: 'admin-feedback', view: 'threads' }
    case 'admin-surveys': return { kind: 'admin-feedback', view: key ? { survey: key } : 'surveys' }
    case 'admin-paywall': return { kind: 'admin-feedback', view: 'paywall' }
    case 'admin-survey': return { kind: 'admin-survey', resume: key ?? undefined }
    case 'admin-broadcasts': return { kind: 'admin-broadcasts' }
    case 'admin-broadcast': return { kind: 'admin-broadcast', key: key ?? undefined }
    case 'admin-verbs': return { kind: 'verb-review' }
    case 'admin-more': return { kind: 'admin-more' }
    case 'admin-payments': return { kind: 'admin-payments' }
    case 'admin-system': return { kind: 'admin-system' }
    default: return null
  }
}

/** Адрес экрана — то, что можно скопировать и открыть снова. */
export function adminLink(s: Admin): string {
  const q = (screen: string, extra: Record<string, string | number | undefined> = {}) =>
    `?screen=${screen}` + Object.entries(extra).filter(([, v]) => v != null).map(([k, v]) => `&${k}=${v}`).join('')
  switch (s.kind) {
    case 'admin-user': return q('admin-user', { id: s.telegramId })
    case 'admin-survey': return q('admin-survey', { key: s.resume })
    case 'admin-broadcast': return q('admin-broadcast', { key: s.key })
    case 'verb-review': return q('admin-verbs')
    case 'admin-feedback': {
      const view = s.view
      if (!view || view === 'threads') return q('admin-messages')
      if (view === 'surveys') return q('admin-surveys')
      if (view === 'paywall') return q('admin-paywall')
      return 'thread' in view ? q('admin-messages', { id: view.thread }) : q('admin-surveys', { key: view.survey })
    }
    default: return q(s.kind)
  }
}

// «Назад» внутри экрана: конструктор на третьем шаге должен вернуться на второй, а не выйти из себя.
// Экран ставит свой обработчик, пока ему есть куда вернуться внутри; системная кнопка Telegram и шапка
// сначала спрашивают его.
let innerBack: (() => boolean) | null = null

/** Обработчик возвращает true, если шаг назад сделан внутри экрана. null — снять. */
export const setInnerBack = (handler: (() => boolean) | null) => { innerBack = handler }

export const goInnerBack = () => innerBack?.() ?? false
