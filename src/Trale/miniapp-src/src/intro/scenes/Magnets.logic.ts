import { CITIES, COUNTRIES, geoName, shuffle, type Rng } from '../story'

// «Магниты» — чистая логика мастерской: что едет по ленте, какой заказ сейчас, что получится после магнита,
// сколько очков. Экран — Magnets.tsx. Время приходит снаружи (now), случай — rng: всё проверяется тестами.

export type MagnetSet = 'name' | 'from' | 'in' | 'both'
/** Магнит: -ში «в», -დან «из», гласная ი для имени, или штамп «без ი». */
export type Tool = 'ში' | 'დან' | 'ი' | 'none'

export interface Item {
  key: string
  /** Что написано на плитке по-русски (для имён — само имя). */
  ru: string
  /** Слово до магнита. */
  base: string
  /** Слово после магнита. */
  result: string
  tool: Tool
  /** Заказ по-русски: «из Испании», «в Батуми». Для имён — пусто. */
  order: string
}

export interface Tile { id: number; item: Item; born: number }

export interface Belt {
  set: MagnetSet
  /** order — по ленте едут слова, нужно то, что в заказе; free — каждая плитка сама вопрос («нужна ли ი?»). */
  mode: 'order' | 'free'
  /** order: заказы по порядку; free: плитки, которые ещё не сделаны. */
  queue: Item[]
  /** Что может ехать по ленте (order). */
  pool: Item[]
  tiles: Tile[]
  nextId: number
  lastSpawn: number
  done: number
  total: number
  score: number
  combo: number
  best: number
  misses: number
  /** Промахи на текущем заказе — после двух подсвечиваем верный магнит. */
  missHere: number
  /** Сколько миллисекунд плитка едет через ленту. */
  travel: number
}

export const MAX_TILES = 3

const SPEED: Record<MagnetSet, { start: number; step: number; min: number; total: number }> = {
  name: { start: 7600, step: 300, min: 5200, total: 8 },
  from: { start: 7200, step: 360, min: 4300, total: 8 },
  in: { start: 7200, step: 360, min: 4300, total: 8 },
  both: { start: 6400, step: 330, min: 3500, total: 10 }
}

export const MAGNET_RU: Record<Tool, string> = { 'ში': 'в', 'დან': 'из', 'ი': 'гласная', none: 'без ი' }

export const countryItems = (): Item[] => COUNTRIES.map(c => ({ key: c.base, ru: c.ru, base: c.base, result: c.from, tool: 'დან', order: c.ruFrom }))
export const cityItems = (): Item[] => CITIES.map(c => ({ key: c.base, ru: c.ru, base: c.base, result: c.in, tool: 'ში', order: `в ${c.ru}` }))

/** Иностранные имена для ленты: половина на согласную (нужна ი), половина на гласную. Грузинское пишет geoName. */
export const FOREIGN_NAMES = ['Карлос', 'Анна', 'Давид', 'Мария', 'Максим', 'Лука', 'Антон', 'Пабло', 'Том', 'Ольга']

export function nameItem(ru: string): Item {
  const g = geoName(ru)
  return { key: ru, ru, base: g.base, result: g.geo, tool: g.added ? 'ი' : 'none', order: '' }
}

/** Что делает магнит со словом: часть, которая остаётся, что отпадает, что прилипает. */
export function transform(item: Item): { keep: string; drop: string; add: string } {
  if (item.tool === 'ში' && item.base.endsWith('ი')) return { keep: item.base.slice(0, -1), drop: 'ი', add: 'ში' }
  if (item.tool === 'none') return { keep: item.base, drop: '', add: '' }
  return { keep: item.base, drop: '', add: item.tool }
}

export const toolsOf = (set: MagnetSet): Tool[] =>
  set === 'name' ? ['ი', 'none'] : set === 'from' ? ['დან', 'ში'] : set === 'in' ? ['ში', 'დან'] : ['ში', 'დან']

function orders(pool: Item[], n: number, rng: Rng): Item[] {
  const out: Item[] = []
  while (out.length < n) {
    for (const it of shuffle(pool, rng)) {
      if (out.length >= n) break
      if (out.length && out[out.length - 1].key === it.key) continue
      out.push(it)
    }
  }
  return out
}

export function startBelt(set: MagnetSet, rng: Rng, now: number): Belt {
  const s = SPEED[set]
  const base = { set, tiles: [], nextId: 1, lastSpawn: -Infinity, done: 0, total: s.total, score: 0, combo: 0, best: 0, misses: 0, missHere: 0, travel: s.start }
  if (set === 'name') {
    const cons = shuffle(FOREIGN_NAMES.filter(n => nameItem(n).tool === 'ი'), rng).slice(0, s.total / 2)
    const vow = shuffle(FOREIGN_NAMES.filter(n => nameItem(n).tool === 'none'), rng).slice(0, s.total / 2)
    const queue = shuffle([...cons, ...vow], rng).map(nameItem)
    return spawn({ ...base, mode: 'free', queue, pool: queue, total: queue.length }, now, rng)
  }
  const pool = set === 'from' ? countryItems() : set === 'in' ? cityItems() : [...countryItems(), ...cityItems()]
  return spawn({ ...base, mode: 'order', queue: orders(pool, s.total, rng), pool }, now, rng)
}

/** Текущий заказ (order) — или null, если смена закончена. */
export const activeOrder = (b: Belt): Item | null => (b.mode === 'order' ? b.queue[b.done] ?? null : null)
export const finished = (b: Belt) => b.done >= b.total

/** Где плитка: 0 — только въехала слева, 1 — уехала за правый край. */
export const xOf = (t: Tile, b: Belt, now: number) => (now - t.born) / b.travel

function spawn(b: Belt, now: number, rng: Rng): Belt {
  if (finished(b) || b.tiles.length >= MAX_TILES) return b
  const on = new Set(b.tiles.map(t => t.item.key))
  let item: Item | undefined
  if (b.mode === 'order') {
    const want = activeOrder(b)!
    const others = b.pool.filter(p => p.key !== want.key && !on.has(p.key))
    // Нужное слово едет почаще, но не всегда первым — его надо высмотреть среди остальных.
    if (!on.has(want.key) && (rng() < 0.6 || !others.length)) item = want
    else item = others.length ? others[Math.floor(rng() * others.length)] : undefined
  } else {
    const left = b.queue.filter(q => !on.has(q.key))
    item = left.length ? left[Math.floor(rng() * left.length)] : undefined
  }
  if (!item) return b
  return { ...b, tiles: [...b.tiles, { id: b.nextId, item, born: now }], nextId: b.nextId + 1, lastSpawn: now }
}

/** Ход времени: уехавшие плитки уходят с ленты (нужная — «уехала, вернётся»), новые въезжают. */
export function tick(b: Belt, now: number, rng: Rng): { belt: Belt; missed: Tile[] } {
  if (finished(b)) return { belt: b, missed: [] }
  const gone = b.tiles.filter(t => xOf(t, b, now) >= 1)
  const want = activeOrder(b)
  const missed = gone.filter(t => b.mode === 'free' || t.item.key === want?.key)
  let belt: Belt = gone.length ? { ...b, tiles: b.tiles.filter(t => !gone.includes(t)), combo: missed.length ? 0 : b.combo } : b
  const gap = belt.travel / MAX_TILES
  if (now - belt.lastSpawn >= gap || belt.tiles.length === 0) belt = spawn(belt, now, rng)
  return { belt, missed }
}

export type TapResult = 'ok' | 'nomag' | 'wrongTile' | 'wrongMag' | 'gone'

export function tap(b: Belt, tileId: number, armed: Tool | null, now: number): { belt: Belt; result: TapResult; item?: Item; points: number } {
  const tile = b.tiles.find(t => t.id === tileId)
  if (!tile || finished(b)) return { belt: b, result: 'gone', points: 0 }
  if (!armed) return { belt: b, result: 'nomag', item: tile.item, points: 0 }
  const want = b.mode === 'order' ? activeOrder(b)! : tile.item
  const miss = (result: TapResult) => ({ belt: { ...b, combo: 0, misses: b.misses + 1, missHere: b.missHere + 1 }, result, item: tile.item, points: 0 })
  if (tile.item.key !== want.key) return miss('wrongTile')
  if (armed !== want.tool) return miss('wrongMag')
  const s = SPEED[b.set]
  const points = 10 + 5 * Math.min(b.combo, 6)
  const combo = b.combo + 1
  const done = b.done + 1
  const queue = b.mode === 'free' ? b.queue.filter(q => q.key !== tile.item.key) : b.queue
  return {
    belt: {
      ...b, queue, done, combo, best: Math.max(b.best, combo), score: b.score + points, missHere: 0,
      travel: Math.max(s.min, s.start - s.step * done),
      // Плитки, что уже едут, сохраняют место на ленте при новой скорости.
      ...rebase(b, Math.max(s.min, s.start - s.step * done), now, tileId)
    },
    result: 'ok', item: tile.item, points
  }
}

/** При смене скорости пересчитываем born, чтобы плитки не прыгали. */
function rebase(b: Belt, travel: number, now: number, without: number): { tiles: Tile[] } {
  return { tiles: b.tiles.filter(t => t.id !== without).map(t => ({ ...t, born: now - xOf(t, b, now) * travel })) }
}

/** Подсказка после промаха. */
export function hint(result: TapResult, armed: Tool | null, want: Item | null, tile?: Item): string {
  if (result === 'nomag') return 'Сначала возьми магнит снизу, потом жми на слово.'
  if (result === 'wrongTile' && want && tile) return `Это ${tile.ru}. А в заказе — «${want.order}».`
  if (result === 'wrongMag' && want) {
    if (want.tool === 'ი') return `${want.ru} кончается на согласную — грузины договаривают ი.`
    if (want.tool === 'none') return `${want.ru} кончается на гласную — ი не нужна.`
    if (armed === 'ში') return '-ში значит «в». А нужно «из».'
    if (armed === 'დან') return '-დან значит «из». А нужно «в».'
  }
  return ''
}

/** Что сказать, когда магнит прилип. */
export function praise(item: Item): string {
  if (item.tool === 'ში') return `${item.base} → ${item.result}: последняя ი ушла, ში прилип.`
  if (item.tool === 'დან') return `${item.base} → ${item.result}: слово целиком, плюс დან.`
  if (item.tool === 'ი') return `${item.ru} → ${item.result}: на согласную — договариваем ი.`
  return `${item.ru} → ${item.result}: уже на гласную, ი не нужна.`
}
