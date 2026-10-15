import { shuffle, type Rng } from '../story'
import { FOREIGN_NAMES, cityItems, countryItems, nameItem, type Item, type MagnetSet, type Tool } from './Magnets.logic'

// «Магниты» без ленты: раунд — маленький диалог. Вопрос («საიდან ხარ?»), твой ответ с пропуском
// («მე ვარ საქართველო…») и что ты хочешь сказать по-русски («я из Грузии»). Одна кнопка-окончание — ход.
// Чистая логика: какие раунды, что засчитано, очки и серия. Экран — Endings.tsx.

export interface Round {
  item: Item
  /** Вопрос собеседника: id фразы story.json или русская ремарка. */
  ask: { phrase?: string; ru: string }
  /** Начало твоего ответа (грузинское, из story.json) — перед словом. */
  lead: string
  /** Что ты хочешь сказать, по-русски. */
  goal: string
}

export interface Game {
  set: MagnetSet
  rounds: Round[]
  at: number
  score: number
  combo: number
  best: number
  /** Промахи в текущем раунде — после первого подсвечиваем верную кнопку. */
  missHere: number
  misses: number
}

const fromRound = (item: Item): Round => ({ item, ask: { phrase: 'saidan', ru: 'Откуда ты?' }, lead: 'მე ვარ', goal: `я ${item.order}` })
const inRound = (item: Item): Round => ({ item, ask: { ru: 'Где ты живёшь?' }, lead: 'ვცხოვრობ', goal: `живу ${item.order}` })
const nameRound = (item: Item): Round => ({ item, ask: { phrase: 'ra_gkvia', ru: 'Как тебя зовут?' }, lead: 'მე მქვია', goal: `меня зовут ${item.ru}` })

/** Порядок без двух одинаковых слов подряд. */
function spread<T extends { item: Item }>(list: T[], rng: Rng): T[] {
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(list, rng)
    if (s.every((r, i) => i === 0 || r.item.key !== s[i - 1].item.key)) return s
  }
  return list
}

export function startGame(set: MagnetSet, rng: Rng = Math.random): Game {
  const countries = countryItems().map(fromRound)
  const cities = cityItems().map(inRound)
  const rounds =
    set === 'from' ? spread([...countries, ...countries], rng)
      : set === 'in' ? spread([...cities, ...cities], rng)
        : set === 'both' ? spread([...countries, ...cities, ...shuffle(countries, rng).slice(0, 1), ...shuffle(cities, rng).slice(0, 1)], rng)
          : spread(shuffle(FOREIGN_NAMES, rng).slice(0, 8).map(n => nameRound(nameItem(n))), rng)
  return { set, rounds, at: 0, score: 0, combo: 0, best: 0, missHere: 0, misses: 0 }
}

export const current = (g: Game): Round | null => g.rounds[g.at] ?? null
export const over = (g: Game) => g.at >= g.rounds.length

/** Кнопки окончаний набора: для «откуда/где» — обе, для имени — «+ი» и «без ი». */
export const toolsFor = (set: MagnetSet): Tool[] => (set === 'name' ? ['ი', 'none'] : ['დან', 'ში'])

export type Verdict = 'ok' | 'miss'

export function choose(g: Game, tool: Tool): { game: Game; verdict: Verdict; points: number } {
  const r = current(g)
  if (!r) return { game: g, verdict: 'miss', points: 0 }
  if (tool !== r.item.tool) return { game: { ...g, combo: 0, missHere: g.missHere + 1, misses: g.misses + 1 }, verdict: 'miss', points: 0 }
  const combo = g.combo + 1
  const points = g.missHere ? 5 : combo >= 3 ? 15 : 10
  return { game: { ...g, combo, best: Math.max(g.best, combo), score: g.score + points, missHere: 0, at: g.at }, verdict: 'ok', points }
}

/** Следующий раунд (после анимации верного ответа). */
export const advance = (g: Game): Game => ({ ...g, at: g.at + 1, missHere: 0 })

/** Почему не так — на промах. */
export function why(r: Round, tool: Tool): string {
  const it = r.item
  if (it.tool === 'დან' && tool === 'ში') return `-ში — это «в». А ты хочешь сказать «${it.order}» — нужно -დან.`
  if (it.tool === 'ში' && tool === 'დან') return `-დან — это «из». А ты хочешь сказать «${it.order}» — нужно -ში.`
  if (it.tool === 'ი') return `${it.ru} кончается на согласную — грузины договаривают ი: ${it.result}.`
  if (it.tool === 'none') return `${it.ru} кончается на гласную — ი не нужна: ${it.result}.`
  return ''
}

// ── Автомат с краном ──────────────────────────────────────────────────────────────────────────────

export interface Capsule { id: number; tool: Tool; /** Центр капсулы, доля ширины стекла 0..1. */ x: number; /** Слой в куче: 0 — внизу. */ row: number }

/**
 * Капсулы в стекле: окончаний набора поровну, всего 5–6, рассыпаны по ширине без наложений.
 * Правая часть стекла занята трубой (x > 0.82), там капсул нет.
 */
export function pile(set: MagnetSet, rng: Rng, seed = 0): Capsule[] {
  const tools = toolsFor(set)
  const list: Tool[] = shuffle([...tools, ...tools, ...tools], rng).slice(0, 6)
  // Хотя бы по одной каждого, чтобы выбор был всегда.
  for (const t of tools) if (!list.includes(t)) list[0] = t
  // Нижний ряд — пять мест без наложений, шестая капсула лежит сверху, между двумя.
  const bottom = shuffle([0.1, 0.25, 0.4, 0.55, 0.7], rng)
  const top = shuffle([0.175, 0.325, 0.475, 0.625], rng)
  return list.map((tool, i) => ({ id: seed * 10 + i, tool, x: i < 5 ? bottom[i] : top[0], row: i < 5 ? 0 : 1 }))
}

/** Какую капсулу схватит кран в точке x (доля ширины): ближайшую в пределах захвата, верхний слой первым. */
export function grab(caps: Capsule[], x: number, reach = 0.075): Capsule | null {
  const near = caps.filter(c => Math.abs(c.x - x) <= reach)
  if (!near.length) return null
  return near.sort((a, b) => b.row - a.row || Math.abs(a.x - x) - Math.abs(b.x - x))[0]
}

/** Кран не заезжает в трубу. */
export const clampClaw = (x: number) => Math.max(0.06, Math.min(0.74, x))

/** Свободное место на дне стекла — туда падает отскочившая капсула. */
export function freeSpot(caps: Capsule[], rng: Rng): number {
  const spots = [0.1, 0.25, 0.4, 0.55, 0.7]
  const free = spots.filter(x => caps.every(c => c.row > 0 || Math.abs(c.x - x) > 0.1))
  return free.length ? free[Math.floor(rng() * free.length)] : spots[Math.floor(rng() * spots.length)]
}
