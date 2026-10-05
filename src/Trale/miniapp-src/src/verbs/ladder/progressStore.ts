import { fetchVerbProgress, saveVerbProgress } from '../../api'
import type { FormState, LadderItem, Progress } from './engine'
import type { VerbFormProgressDto, VerbProgressStepDto } from './types'

// Прогресс лесенки живёт на сервере. Каждый ответ сначала попадает в очередь на устройстве,
// потом уходит на сервер; из очереди запись убирается только после успешного сохранения.
// Поэтому пропавшая сеть посреди занятия ничего не теряет: очередь уйдёт со следующим ответом
// или при следующем открытии глагола.

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

export interface LoadedProgress {
  canLearn: boolean
  progress: Progress
}

/**
 * Прогресс по глаголу. Если с прошлого раза остались несохранённые ответы, сначала отправляем их:
 * сервер сам решит, что новее, и вернёт итог.
 */
export async function loadProgress(verbId: string): Promise<LoadedProgress> {
  const pending = readPending(verbId)
  if (Object.keys(pending).length) {
    try {
      const saved = await saveVerbProgress(verbId, Object.values(pending))
      dropSent(verbId, pending)
      return { canLearn: saved.canLearn, progress: toProgress(saved.forms, readPending(verbId)) }
    } catch {
      // Не ушло — читаем, что есть на сервере, и накладываем очередь поверх.
    }
  }
  const state = await fetchVerbProgress(verbId)
  return { canLearn: state.canLearn, progress: toProgress(state.forms, readPending(verbId)) }
}

export interface ProgressSaver {
  /** Запомнить новое состояние формы и отправить его в фоне. */
  record: (item: LadderItem, state: FormState) => void
  /** Дослать всё, что ещё не сохранено. */
  flush: () => Promise<void>
}

export function createSaver(verbId: string, now: () => Date = () => new Date()): ProgressSaver {
  let inFlight = false
  let again = false

  async function flush() {
    if (inFlight) { again = true; return }
    const pending = readPending(verbId)
    if (!Object.keys(pending).length) return
    inFlight = true
    try {
      await saveVerbProgress(verbId, Object.values(pending))
      dropSent(verbId, pending)
    } catch {
      // Остаётся в очереди.
    } finally {
      inFlight = false
      if (again) { again = false; void flush() }
    }
  }

  return {
    record(item, state) {
      const pending = readPending(verbId)
      pending[item.key] = { tense: item.tense, person: item.person, step: state.step, reviews: state.reviews, at: now().toISOString() }
      writePending(verbId, pending)
      void flush()
    },
    flush
  }
}
