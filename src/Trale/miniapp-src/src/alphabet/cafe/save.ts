import { UPGRADES, type UpgradeId } from './engine'

// Прогресс кафе в прототипе живёт в браузере (localStorage). Хранилища может не быть
// (приватный режим, превью) — тогда кафе работает, просто начинает каждый раз с нуля.

export interface CafeSave {
  coins: number
  owned: UpgradeId[]
  best: number
  days: number
  /** Товары, которые гость уже видел на витрине, — чтобы отметить новые. */
  seen: string[]
}

const KEY = 'alphabet_cafe_v1'
export const EMPTY: CafeSave = { coins: 0, owned: [], best: 0, days: 0, seen: [] }

export function loadSave(): CafeSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const s = JSON.parse(raw)
    const ids = new Set(UPGRADES.map(u => u.id))
    return {
      coins: Number.isFinite(s.coins) ? Math.max(0, s.coins) : 0,
      owned: Array.isArray(s.owned) ? s.owned.filter((x: string) => ids.has(x as UpgradeId)) : [],
      best: Number.isFinite(s.best) ? s.best : 0,
      days: Number.isFinite(s.days) ? s.days : 0,
      seen: Array.isArray(s.seen) ? s.seen.filter((x: unknown) => typeof x === 'string') : []
    }
  } catch { return { ...EMPTY } }
}

export function writeSave(s: CafeSave) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* нет хранилища */ }
}

/** Купить апгрейд: хватает монет и ещё не куплен — иначе null. */
export function buy(s: CafeSave, id: UpgradeId): CafeSave | null {
  const u = UPGRADES.find(x => x.id === id)
  if (!u || s.owned.includes(id) || s.coins < u.cost) return null
  return { ...s, coins: s.coins - u.cost, owned: [...s.owned, id] }
}

/** Итог дня: монеты в копилку, рекорд, счётчик дней. */
export function closeDay(s: CafeSave, earned: number): { save: CafeSave; record: boolean } {
  const record = earned > s.best && earned > 0
  return { save: { ...s, coins: s.coins + earned, best: Math.max(s.best, earned), days: s.days + 1 }, record }
}
