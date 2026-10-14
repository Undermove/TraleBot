import { isGeorgian, readable } from '../games/logic'

// Товары кафе (игра урока алфавита). Гость заказывает только настоящим грузинским словом, которое уже можно
// прочитать открытыми буквами (ჩაი, ლიმონი, წყალი…): русских слов грузинскими буквами в кафе нет. Поэтому
// кафе появляется в уроке, когда таких слов хватает (cafeReady). Слова — из базового словаря уроков или
// сверены со словарём (data.VERIFIED_WORDS: ლიმონი, ბანანი, მანდარინი, ხაჭაპური — звучат почти как по-русски).

export interface Product {
  id: string
  /** По-русски — значение заказа.*/
  ru: string
  /** Настоящее грузинское название. */
  geo: string
}

export const PRODUCTS: readonly Product[] = [
  { id: 'water', ru: 'вода', geo: 'წყალი' },
  { id: 'cheese', ru: 'сыр', geo: 'ყველი' },
  { id: 'banana', ru: 'банан', geo: 'ბანანი' },
  { id: 'mandarin', ru: 'мандарин', geo: 'მანდარინი' },
  { id: 'lemon', ru: 'лимон', geo: 'ლიმონი' },
  { id: 'tea', ru: 'чай', geo: 'ჩაი' },
  { id: 'bread', ru: 'хлеб', geo: 'პური' },
  { id: 'coffee', ru: 'кофе', geo: 'ყავა' },
  { id: 'wine', ru: 'вино', geo: 'ღვინო' },
  { id: 'khachapuri', ru: 'хачапури', geo: 'ხაჭაპური' }
]

/** Как гость пишет этот товар к уроку level, или null — пока не по силам (меньше двух грузинских букв). */
export function orderText(p: Product, level: number): string | null {
  if (level < 1 || !p.geo) return null
  return readable(p.geo, level) ? p.geo : null
}

/** Кафе в уроке — только когда настоящих названий еды и питья из открытых букв хватает (не меньше трёх). */
export const cafeReady = (level: number) => availableProducts(level).length >= 3

/** Заказ — целиком грузинское слово (а не смешанное). */
export const isRealWord = (p: Product, level: number) => !!p.geo && orderText(p, level) === p.geo

/** Сколько грузинских букв в заказе: за трудное слово платят больше. */
export const georgianLetters = (text: string) => [...text].filter(isGeorgian).length

/** Все товары, которые гость может заказать на этом уровне. */
export const availableProducts = (level: number) => PRODUCTS.filter(p => orderText(p, level) !== null)
