import { fetchVerbFamily } from '../../api'
import type { FamilyDto } from './types'

// Семья с формами нужна нескольким сценам одной сессии — грузим один раз на семью.

const cache = new Map<string, Promise<FamilyDto>>()

export function loadFamily(id: string): Promise<FamilyDto> {
  let hit = cache.get(id)
  if (!hit) {
    hit = fetchVerbFamily(id)
    cache.set(id, hit)
    // Не получилось — в следующий раз попробуем снова.
    hit.catch(() => cache.delete(id))
  }
  return hit
}

/** Только для тестов. */
export function resetFamilyCache() {
  cache.clear()
}
