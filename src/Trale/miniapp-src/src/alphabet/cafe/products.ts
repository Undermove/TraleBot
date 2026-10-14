import { isGeorgian, mixed, readable } from '../games/logic'
import { LESSON_COUNT } from '../games/data'

// Товары кафе. Заказ гостя написан теми буквами, которые ученик уже знает:
// пока грузинское слово не читается целиком — русское слово с выученными буквами («воდა», «ხლეб»);
// как только все буквы грузинского слова выучены — настоящее слово (წყალი, პური). Грузинские слова —
// из базового словаря уроков алфавита (кроме ხაჭაპური — пример из теории десятого урока).

export interface Product {
  id: string
  /** По-русски — подпись в лавке и смешанный заказ, пока грузинское слово не читается. */
  ru: string
  /** Грузинское слово, если оно есть в словаре уроков. */
  geo?: string
}

export const PRODUCTS: readonly Product[] = [
  { id: 'water', ru: 'вода', geo: 'წყალი' },
  { id: 'porridge', ru: 'каша' },
  { id: 'fish', ru: 'рыба' },
  { id: 'cheese', ru: 'сыр', geo: 'ყველი' },
  { id: 'banana', ru: 'банан' },
  { id: 'mandarin', ru: 'мандарин' },
  { id: 'lemon', ru: 'лимон' },
  { id: 'tea', ru: 'чай', geo: 'ჩაი' },
  { id: 'bread', ru: 'хлеб', geo: 'პური' },
  { id: 'milk', ru: 'молоко' },
  { id: 'coffee', ru: 'кофе', geo: 'ყავა' },
  { id: 'soup', ru: 'суп' },
  { id: 'cake', ru: 'торт' },
  { id: 'wine', ru: 'вино', geo: 'ღვინო' },
  { id: 'khachapuri', ru: 'хачапури', geo: 'ხაჭაპური' }
]

/** Только грузинским словом: русское «вино» или «хачапури» с парой грузинских букв читать неинтересно. */
const GEO_ONLY = new Set(['wine', 'khachapuri'])

/** Как гость пишет этот товар к уроку level, или null — пока не по силам (меньше двух грузинских букв). */
export function orderText(p: Product, level: number): string | null {
  if (level < 1) return null
  if (p.geo && readable(p.geo, level)) return p.geo
  if (GEO_ONLY.has(p.id)) return null
  const m = mixed(p.ru, level)
  return [...m].filter(isGeorgian).length >= 2 ? m : null
}

/** Заказ — целиком грузинское слово (а не смешанное). */
export const isRealWord = (p: Product, level: number) => !!p.geo && orderText(p, level) === p.geo

/** Сколько грузинских букв в заказе: за трудное слово платят больше. */
export const georgianLetters = (text: string) => [...text].filter(isGeorgian).length

/** Все товары, которые гость может заказать на этом уровне. */
export const availableProducts = (level: number) => PRODUCTS.filter(p => orderText(p, level) !== null)

/**
 * Витрина дня — до size товаров: сначала настоящие грузинские слова, потом смешанные, где грузинских букв больше.
 * Порядок на витрине перемешан, чтобы место не подсказывало товар.
 */
export function shelfFor(level: number, size = 6, rng: () => number = Math.random): Product[] {
  const score = (p: Product) => (isRealWord(p, level) ? 100 : 0) + georgianLetters(orderText(p, level)!) + rng() * 0.5
  const best = availableProducts(level).sort((a, b) => score(b) - score(a)).slice(0, size)
  for (let i = best.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [best[i], best[j]] = [best[j], best[i]] }
  return best
}

/** Что изменится в кафе после следующего урока: новые товары и товары, которые станут настоящими словами. */
export function nextLessonNews(level: number): { lesson: number; added: Product[]; becameReal: Product[] } | null {
  if (level >= LESSON_COUNT) return null
  const now = new Set(availableProducts(level).map(p => p.id))
  const next = availableProducts(level + 1)
  return {
    lesson: level + 1,
    added: next.filter(p => !now.has(p.id)),
    becameReal: next.filter(p => now.has(p.id) && isRealWord(p, level + 1) && !isRealWord(p, level))
  }
}

/** Уровень кафе — сколько уроков алфавита пройдено подряд с первого. */
export function cafeLevel(completedLessons: readonly number[] | undefined): number {
  const done = new Set(completedLessons ?? [])
  let n = 0
  while (n < LESSON_COUNT && done.has(n + 1)) n++
  return n
}
