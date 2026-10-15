import { lessonLetters, shuffle, type Rng } from '../games/logic'
import { availableProducts, georgianLetters, isRealWord, orderText, type Product } from './products'

// «Кафе Бомборы» — последняя игра урока алфавита. Первый гость — с подсказкой и без спешки, потом смена
// на время: гости идут один за другим, пока не кончится смена. Заказ написан буквами, выученными к концу
// урока, ученик подаёт нужное с витрины без подписей.
// Здесь только чистые функции; экран — Cafe.tsx.

export interface CafePlan {
  /** Витрина: до шести товаров, порядок перемешан, чтобы место не подсказывало. */
  shelf: Product[]
  /** Первые заказы по порядку; первый — самый короткий, его показываем с подсказкой. Дальше — случайные с витрины. */
  orders: Product[]
}

/** Есть ли в заказе буква этого урока — такие заказы берём первыми. */
const hasOwn = (text: string, lesson: number) => lessonLetters(lesson).some(l => text.includes(l))

export function cafePlan(lesson: number, rng: Rng = Math.random, maxOrders = 4): CafePlan {
  const text = (p: Product) => orderText(p, lesson)!
  const jitter = new Map(availableProducts(lesson).map(p => [p.id, rng() * 0.5]))
  const score = (p: Product) => (hasOwn(text(p), lesson) ? 20 : 0) + (isRealWord(p, lesson) ? 10 : 0) + georgianLetters(text(p)) + jitter.get(p.id)!
  const best = availableProducts(lesson).sort((a, b) => score(b) - score(a)).slice(0, 6)
  // Хотя бы один товар на витрине остаётся лишним — последний заказ не угадывается методом исключения.
  const count = Math.max(1, Math.min(maxOrders, best.length - 1))
  const orders = best.slice(0, count).sort((a, b) => georgianLetters(text(a)) - georgianLetters(text(b)))
  return { shelf: shuffle(best, rng), orders }
}

/** Сколько длится смена после первого гостя. */
export const SHIFT_MS = 45_000
/** Подал быстрее этого — «Быстро!». */
export const FAST_MS = 4_000

export const isFast = (waitedMs: number) => waitedMs < FAST_MS

/**
 * Заказ n-го гостя (0 — первый, с подсказкой): сначала заказы из плана, потом случайные с витрины,
 * но не то же блюдо, что у предыдущего гостя.
 */
export function orderAt(plan: CafePlan, n: number, prev: Product | null, rng: Rng = Math.random): Product {
  if (n < plan.orders.length) return plan.orders[n]
  const pool = plan.shelf.filter(p => p.id !== prev?.id)
  const from = pool.length ? pool : plan.shelf
  return from[Math.floor(rng() * from.length)]
}
