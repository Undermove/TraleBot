import { fetchStash } from '../api'
import { EMPTY_STASH, type Collection, type Stash } from './collection'

// Собранное из подарков дня — общее для главной (что надето на Бомборе), дома Бомборы и упражнений (подсказки).

let cached: Collection = { stash: EMPTY_STASH, words: [], cards: [], wordsTotal: 0, cardsTotal: 0 }
const listeners = new Set<(c: Collection) => void>()
export const cachedCollection = () => cached
export const cachedStash = () => cached.stash
function emit() { listeners.forEach(l => l(cached)) }
export function setStash(s: Stash) {
  cached = { ...cached, stash: { ...EMPTY_STASH, ...s } }
  emit()
}
export function onCollection(l: (c: Collection) => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export function onStash(l: (s: Stash) => void): () => void {
  return onCollection(c => l(c.stash))
}
export async function loadStash(): Promise<Stash> {
  try {
    const c = await fetchStash()
    cached = { ...c, stash: { ...EMPTY_STASH, ...c.stash } }
    emit()
  } catch {}
  return cached.stash
}
