import { georgianLetters, orderText, type Product } from './products'

// Один день кафе — чистая функция от времени: гости приходят, ждут, уходят. Никакого React и таймеров:
// экран вызывает tick(now) и serve(productId, now), а тесты гоняют время руками.

export type UpgradeId = 'sign' | 'tables' | 'bell' | 'pair' | 'garland'

export interface Upgrade { id: UpgradeId; title: string; effect: string; cost: number }

/** Апгрейды лавки — по порядку цены. Каждый покупается один раз. */
export const UPGRADES: readonly Upgrade[] = [
  { id: 'sign', title: 'Вывеска', effect: 'гости приходят чаще', cost: 30 },
  { id: 'tables', title: 'Столики', effect: 'четвёртое место, гости ждут дольше', cost: 60 },
  { id: 'bell', title: 'Колокольчик', effect: 'чаевые вдвое больше', cost: 90 },
  { id: 'pair', title: 'Меню на двоих', effect: 'заказы из двух блюд — и вдвое больше монет', cost: 140 },
  { id: 'garland', title: 'Гирлянда', effect: 'день длиннее на 20 секунд', cost: 200 }
]

export interface DayConfig {
  level: number
  shelf: readonly Product[]
  owned: ReadonlySet<UpgradeId>
}

export interface Guest {
  id: number
  /** Что заказал (id товаров). */
  items: string[]
  /** Что уже подали — по индексам items. */
  got: boolean[]
  arrivedAt: number
  patience: number
  /** Вид гостя — для картинки. */
  look: number
  mood: 'wait' | 'happy' | 'sad'
  leftAt?: number
  /** Сколько монет он оставил. */
  paid?: number
}

export interface Day {
  cfg: DayConfig
  length: number
  seats: number
  guests: Guest[]
  nextId: number
  nextSpawnAt: number
  coins: number
  served: number
  lost: number
  combo: number
  bestCombo: number
  /** Тексты заказов, которые удалось прочитать и подать. */
  read: string[]
}

export const BASE_DAY_MS = 70_000
const LEAVE_MS = 650

export function newDay(cfg: DayConfig): Day {
  return {
    cfg,
    length: BASE_DAY_MS + (cfg.owned.has('garland') ? 20_000 : 0),
    seats: cfg.owned.has('tables') ? 4 : 3,
    guests: [], nextId: 1, nextSpawnAt: 700,
    coins: 0, served: 0, lost: 0, combo: 0, bestCombo: 0, read: []
  }
}

/** Пауза до следующего гостя: к концу дня темп растёт, вывеска зовёт гостей чаще. */
export function spawnGap(day: Day, now: number): number {
  const progress = Math.min(1, now / day.length)
  const gap = 4600 - 2200 * progress
  return Math.round(gap * (day.cfg.owned.has('sign') ? 0.8 : 1))
}

/** Сколько гость готов ждать: длинный заказ читается дольше. */
export function patienceFor(day: Day, items: string[]): number {
  const letters = items.reduce((s, id) => s + georgianLetters(textOf(day, id)), 0)
  const base = 13_000 + letters * 600 + (items.length - 1) * 4000
  return Math.round(base * (day.cfg.owned.has('tables') ? 1.3 : 1))
}

export const textOf = (day: Day, id: string) => {
  const p = day.cfg.shelf.find(x => x.id === id)
  return p ? orderText(p, day.cfg.level) ?? p.ru : id
}

/** Текст заказа целиком: «ჩაი და პური». */
export const orderLine = (day: Day, g: Guest) => g.items.map(id => textOf(day, id)).join(' და ')

export const waiting = (day: Day) => day.guests.filter(g => g.mood === 'wait')

/** День кончился: время вышло и все, кто ждал, обслужены или ушли. */
export const isOver = (day: Day, now: number) => now >= day.length && waiting(day).length === 0

function makeOrder(day: Day, rng: () => number): string[] {
  const ids = day.cfg.shelf.map(p => p.id)
  const first = ids[Math.floor(rng() * ids.length)]
  if (day.cfg.owned.has('pair') && ids.length > 1 && rng() < 0.45) {
    const rest = ids.filter(i => i !== first)
    return [first, rest[Math.floor(rng() * rest.length)]]
  }
  return [first]
}

/** Время идёт: новые гости, у кого кончилось терпение — уходят, ушедшие исчезают со сцены. */
export function tick(day: Day, now: number, rng: () => number = Math.random): Day {
  let d = day
  const guests = d.guests
    .map(g => (g.mood === 'wait' && now - g.arrivedAt >= g.patience ? { ...g, mood: 'sad' as const, leftAt: now } : g))
  const gotSad = guests.some((g, i) => g.mood === 'sad' && d.guests[i].mood === 'wait')
  d = {
    ...d,
    guests: guests.filter(g => g.leftAt === undefined || now - g.leftAt < LEAVE_MS),
    lost: d.lost + guests.filter((g, i) => g.mood === 'sad' && d.guests[i].mood === 'wait').length,
    combo: gotSad ? 0 : d.combo
  }
  if (now >= d.nextSpawnAt && now < d.length && d.cfg.shelf.length > 0) {
    if (waiting(d).length < d.seats) {
      const items = makeOrder(d, rng)
      const guest: Guest = {
        id: d.nextId, items, got: items.map(() => false), arrivedAt: now,
        patience: patienceFor(d, items), look: Math.floor(rng() * 4), mood: 'wait'
      }
      d = { ...d, guests: [...d.guests, guest], nextId: d.nextId + 1, nextSpawnAt: now + spawnGap(d, now) }
    } else d = { ...d, nextSpawnAt: now + 600 }
  }
  return d
}

export type ServeResult =
  | { kind: 'part'; guestId: number }
  | { kind: 'done'; guestId: number; coins: number }
  | { kind: 'wrong' }

/** Сколько гость заплатит: буквы заказа, чаевые за скорость (с колокольчиком вдвое), серия. */
export function priceOf(day: Day, g: Guest, now: number): number {
  const letters = g.items.reduce((s, id) => s + georgianLetters(textOf(day, id)), 0)
  const base = 2 * g.items.length + letters
  const left = Math.max(0, 1 - (now - g.arrivedAt) / g.patience)
  const tip = Math.round(left * 4 * (day.cfg.owned.has('bell') ? 2 : 1))
  const comboBonus = Math.min(day.combo, 5)
  return base + tip + comboBonus
}

/**
 * Подать товар. Идёт самому давнему из ждущих, кому он нужен. Никому не нужен — промах: серия
 * обнуляется, а самый давний гость теряет немного терпения.
 */
export function serve(day: Day, productId: string, now: number): { day: Day; result: ServeResult } {
  const target = waiting(day)
    .sort((a, b) => a.arrivedAt - b.arrivedAt)
    .find(g => g.items.some((id, i) => id === productId && !g.got[i]))
  if (!target) {
    const oldest = waiting(day).sort((a, b) => a.arrivedAt - b.arrivedAt)[0]
    return {
      day: {
        ...day, combo: 0,
        guests: day.guests.map(g => (g === oldest ? { ...g, patience: Math.max(now - g.arrivedAt + 1200, g.patience - 2500) } : g))
      },
      result: { kind: 'wrong' }
    }
  }
  const slot = target.items.findIndex((id, i) => id === productId && !target.got[i])
  const got = target.got.map((v, i) => v || i === slot)
  if (!got.every(Boolean)) {
    return { day: { ...day, guests: day.guests.map(g => (g.id === target.id ? { ...g, got } : g)) }, result: { kind: 'part', guestId: target.id } }
  }
  const coins = priceOf(day, target, now)
  const combo = day.combo + 1
  return {
    day: {
      ...day,
      guests: day.guests.map(g => (g.id === target.id ? { ...g, got, mood: 'happy', leftAt: now, paid: coins } : g)),
      coins: day.coins + coins, served: day.served + 1, combo, bestCombo: Math.max(day.bestCombo, combo),
      read: [...day.read, ...target.items.map(id => textOf(day, id))]
    },
    result: { kind: 'done', guestId: target.id, coins }
  }
}
