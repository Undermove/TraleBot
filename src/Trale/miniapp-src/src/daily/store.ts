import { ApiError, fetchDailyTask } from '../api'
import type { DailyTaskDto } from './types'

// Последнее занятие с сервера — чтобы карточка на главной и экран задания не ждали друг друга
// и видели одно и то же: закрыл день на экране — карточка уже «Сделано».

let cached: DailyTaskDto | null = null
const listeners = new Set<(task: DailyTaskDto | null) => void>()

export const cachedDaily = () => cached

/** Свежий ответ сервера (итог дня, «новое» открыто, стенд перемотал день). */
export function setDaily(task: DailyTaskDto | null) {
  cached = task
  listeners.forEach(l => l(task))
}

/** Занятие на сегодня. null — задания нет: нет доступа (402), оно пока открыто не всем (404) или сервер его не предлагает. */
export async function loadDaily(): Promise<DailyTaskDto | null> {
  try {
    const task = await fetchDailyTask()
    setDaily(task.available ? task : null)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 402 || e.status === 404)) setDaily(null)
    else throw e
  }
  return cached
}

export function onDaily(listener: (task: DailyTaskDto | null) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Только для тестов. */
export function resetDailyCache() {
  cached = null
}
