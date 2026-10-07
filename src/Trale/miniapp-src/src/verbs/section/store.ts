import { fetchVerbSection } from '../../api'
import type { VerbSectionDto } from './types'

// Последний ответ раздела — чтобы плитка на главной и сам раздел не ждали друг друга:
// экран сразу рисуется по тому, что уже есть, и обновляется, когда приходит свежий ответ.

let cached: VerbSectionDto | null = null

export const cachedSection = () => cached

export async function loadSection(): Promise<VerbSectionDto> {
  cached = await fetchVerbSection()
  return cached
}

/** Только для тестов. */
export function resetSectionCache() {
  cached = null
}
