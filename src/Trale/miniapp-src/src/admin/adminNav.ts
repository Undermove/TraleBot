import type { Screen } from '../types'

// Навигация админки: у каждого экрана свой адрес (?screen=admin-…), чтобы на него можно было дать прямую
// ссылку, и свой «уровень выше», куда ведёт «Назад» — и в шапке, и системная кнопка Telegram.

type Admin = Extract<Screen, { kind: `admin${string}` | 'verb-review' }>

export const isAdminScreen = (s: Screen): s is Admin => s.kind === 'verb-review' || s.kind.startsWith('admin')

/** Экран уровнем выше. У обзора это профиль — оттуда в админку и входят. */
export function adminParent(s: Admin): Screen {
  switch (s.kind) {
    case 'admin': return { kind: 'profile' }
    case 'admin-user': return { kind: 'admin-users' }
    case 'admin-survey': return { kind: 'admin-feedback', view: 'surveys' }
    case 'admin-broadcast': return { kind: 'admin-broadcasts' }
    case 'admin-feedback': {
      const view = s.view
      if (!view) return { kind: 'admin' }
      if (typeof view === 'object' && 'thread' in view) return { kind: 'admin-feedback', view: view.back ?? 'threads' }
      if (typeof view === 'object') return { kind: 'admin-feedback', view: 'surveys' }
      return { kind: 'admin-feedback' }
    }
    default: return { kind: 'admin' }
  }
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
    case 'admin-surveys': return { kind: 'admin-feedback', view: key ? { survey: key } : 'surveys' }
    case 'admin-paywall': return { kind: 'admin-feedback', view: 'paywall' }
    case 'admin-feedback': return { kind: 'admin-feedback' }
    case 'admin-survey': return { kind: 'admin-survey', resume: key ?? undefined }
    case 'admin-broadcasts': return { kind: 'admin-broadcasts' }
    case 'admin-broadcast': return { kind: 'admin-broadcast', key: key ?? undefined }
    case 'admin-verbs': return { kind: 'verb-review' }
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
      if (!view) return q('admin-feedback')
      if (view === 'threads') return q('admin-messages')
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
