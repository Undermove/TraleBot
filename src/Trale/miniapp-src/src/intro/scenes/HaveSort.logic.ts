import { ALIVE, THINGS, shuffle, type Rng, type Word } from '../story'

// «Живое или вещь» — чистая логика аркады: колода карточек, скорость падения, очки и комбо, подсказка на промах.

export type HaveMode = 'people' | 'full'
export type Side = 'alive' | 'thing'

export interface Card extends Word { alive: boolean }

/** Слова, на которых легко ошибиться: ребёнок, друг, кошка — живые; деньги и хачапури — вещи. */
export const TRICKY = ['ბავშვი', 'მეგობარი', 'კატა', 'ფული', 'ხაჭაპური']

export const DECK_SIZE = 20
export const GAME_MS = 45_000

const card = (w: Word, alive: boolean): Card => ({ ...w, alive })

/**
 * Колода: в people (урок 27) — в основном живое и немного вещей; в full — поровну и с хитрыми словами.
 * Одно и то же слово не идёт два раза подряд.
 */
export function haveDeck(mode: HaveMode, rng: Rng = Math.random, size = DECK_SIZE): Card[] {
  const nAlive = mode === 'people' ? Math.round(size * 0.7) : Math.round(size / 2)
  const draw = (pool: Word[], n: number, must: string[] = []) => {
    const first = shuffle(pool.filter(w => must.includes(w.geo)), rng)
    const out: Word[] = [...first]
    while (out.length < n) out.push(...shuffle(pool, rng))
    return out.slice(0, n)
  }
  const must = mode === 'full' ? TRICKY : []
  const pool = shuffle([
    ...draw(ALIVE, nAlive, must).map(w => card(w, true)),
    ...draw(THINGS, size - nAlive, must).map(w => card(w, false))
  ], rng)
  // Раскладываем так, чтобы одинаковые карточки не шли подряд.
  const cards: Card[] = []
  while (pool.length) {
    const k = pool.findIndex(c => c.geo !== cards[cards.length - 1]?.geo)
    cards.push(pool.splice(k < 0 ? 0 : k, 1)[0])
  }
  return cards
}

/** Сколько миллисекунд карточка падает сверху до корзин. Чем дальше, тем быстрее. */
export function fallMs(mode: HaveMode, i: number): number {
  return mode === 'people' ? Math.max(3800, 6500 - i * 140) : Math.max(2600, 4800 - i * 120)
}

export const sideOf = (c: Card): Side => (c.alive ? 'alive' : 'thing')
export const verbOf = (s: Side) => (s === 'alive' ? 'მყავს' : 'მაქვს')
/** Целая фраза: «მე მყავს ძაღლი» / «მე მაქვს წიგნი». */
export const sentence = (c: Card) => `მე ${verbOf(sideOf(c))} ${c.geo}`

/** Подсказка на промах: «ძაღლი (собака) — кто-то живой, значит მყავს». */
export function hintFor(c: Card): string {
  return c.alive ? `${c.geo} (${c.ru}) — кто-то живой, значит ${verbOf('alive')}` : `${c.geo} (${c.ru}) — это вещь, значит ${verbOf('thing')}`
}

export interface HaveState {
  /** Номер текущей карточки. */
  i: number
  score: number
  combo: number
  best: number
  /** Верно с первого раза. */
  right: number
  misses: number
  /** Текущая карточка уже отскочила (промах) — за неё больше нет очков. */
  bounced: boolean
}

export const startState = (): HaveState => ({ i: 0, score: 0, combo: 0, best: 0, right: 0, misses: 0, bounced: false })

/** Очки за верную карточку: 10, с комбо от 3 — 15, от 6 — 20. */
export const pointsFor = (combo: number) => (combo >= 6 ? 20 : combo >= 3 ? 15 : 10)

export type Outcome = 'catch' | 'late-catch' | 'bounce' | 'fell'

/** Карточку отправили в корзину side. Верно — следующая; неверно — отскок, та же карточка падает заново. */
export function send(s: HaveState, c: Card, side: Side): { state: HaveState; outcome: Outcome; points: number } {
  if (side !== sideOf(c)) return { state: { ...s, combo: 0, misses: s.misses + 1, bounced: true }, outcome: 'bounce', points: 0 }
  if (s.bounced) return { state: { ...s, i: s.i + 1, bounced: false }, outcome: 'late-catch', points: 0 }
  const combo = s.combo + 1
  const points = pointsFor(combo)
  return { state: { ...s, i: s.i + 1, combo, best: Math.max(s.best, combo), score: s.score + points, right: s.right + 1, bounced: false }, outcome: 'catch', points }
}

/** Карточка упала мимо корзин: без очков, комбо сгорает, идём дальше. */
export function fell(s: HaveState): HaveState {
  return { ...s, i: s.i + 1, combo: 0, misses: s.bounced ? s.misses : s.misses + 1, bounced: false }
}

export const isOver = (s: HaveState, deck: Card[], elapsed: number) => s.i >= deck.length || elapsed >= GAME_MS
