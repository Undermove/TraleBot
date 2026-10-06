import type { Progress } from './engine'
import type { VerbFormProgressDto, VerbProgressStepDto } from './types'

// Прогресс форм живёт на сервере. Каждый ответ сначала попадает в очередь на устройстве, потом
// уходит на сервер вместе с отчётом о сессии (session/sync.ts); из очереди запись убирается только
// после успешного сохранения. Поэтому пропавшая сеть посреди занятия ничего не теряет: очередь
// уйдёт со следующим ответом или при следующем открытии глагола. Здесь — сама очередь.

export type Pending = Record<string, VerbProgressStepDto>

const storeKey = (verbId: string) => `verb_ladder_pending_v1:${verbId}`
/** Запас на случай, когда localStorage недоступен: очередь живёт хотя бы до закрытия мини-аппа. */
const memory: Record<string, Pending> = {}
let storageWorks = true

export function readPending(verbId: string): Pending {
  if (storageWorks) {
    try {
      const raw = localStorage.getItem(storeKey(verbId))
      return raw ? (JSON.parse(raw) as Pending) : {}
    } catch {
      storageWorks = false
    }
  }
  return memory[verbId] ?? {}
}

export function writePending(verbId: string, pending: Pending) {
  memory[verbId] = pending
  if (!storageWorks) return
  try {
    if (Object.keys(pending).length) localStorage.setItem(storeKey(verbId), JSON.stringify(pending))
    else localStorage.removeItem(storeKey(verbId))
  } catch {
    storageWorks = false
  }
}

/** Убираем из очереди то, что сервер принял, — но не ответы, которые человек дал, пока шёл запрос. */
export function dropSent(verbId: string, sent: Pending) {
  const now = readPending(verbId)
  for (const [key, step] of Object.entries(sent)) {
    if (now[key]?.at === step.at) delete now[key]
  }
  writePending(verbId, now)
}

const cellKey = (c: { tense: string; person: number }) => `${c.tense}:${c.person}`

export function toProgress(forms: VerbFormProgressDto[], pending: Pending = {}): Progress {
  const progress: Progress = {}
  for (const f of forms) {
    progress[cellKey(f)] = { step: f.step, best: f.bestStep, reviews: f.reviews, due: f.due }
  }
  // Несохранённые ответы новее того, что знает сервер.
  for (const [key, p] of Object.entries(pending)) {
    progress[key] = { step: p.step, best: Math.max(progress[key]?.best ?? 0, p.step), reviews: p.reviews, due: false }
  }
  return progress
}
