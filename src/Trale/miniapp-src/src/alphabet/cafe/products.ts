import { isGeorgian, mixedBridge, readable } from '../games/logic'

// Товары кафе (последняя игра урока алфавита). Заказ гостя написан теми буквами, которые ученик уже знает:
// пока грузинское слово не читается целиком — русское слово с выученными буквами («воდა», «ხლეб»);
// как только все буквы грузинского слова выучены — настоящее слово (წყალი, პური). Русское слово целиком
// грузинскими буквами не пишется никогда: если русская запись стала бы полностью грузинской, а настоящее
// слово ещё не читается (или его нет), блюдо в этом уроке не заказывают. Грузинские слова — из базового
// словаря уроков; ლიმონი, ბანანი, მანდარინი, ხაჭაპური — сверены со словарём (data.VERIFIED_WORDS) и звучат
// почти как по-русски, так что понятны без отдельного знакомства.

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
  { id: 'banana', ru: 'банан', geo: 'ბანანი' },
  { id: 'mandarin', ru: 'мандарин', geo: 'მანდარინი' },
  { id: 'lemon', ru: 'лимон', geo: 'ლიმონი' },
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
  const m = mixedBridge(p.ru, level)
  return m && [...m].filter(isGeorgian).length >= 2 ? m : null
}

/** Заказ — целиком грузинское слово (а не смешанное). */
export const isRealWord = (p: Product, level: number) => !!p.geo && orderText(p, level) === p.geo

/** Сколько грузинских букв в заказе: за трудное слово платят больше. */
export const georgianLetters = (text: string) => [...text].filter(isGeorgian).length

/** Все товары, которые гость может заказать на этом уровне. */
export const availableProducts = (level: number) => PRODUCTS.filter(p => orderText(p, level) !== null)
