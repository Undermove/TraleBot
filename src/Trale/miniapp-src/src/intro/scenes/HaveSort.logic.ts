import { ALIVE, THINGS, met, phrase, shuffle, type Rng, type Word } from '../story'

// «Фото и чемодан» (бывш. «Живое или вещь») — чистая логика. Нино по видеосвязи спрашивает, кто и что у
// тебя есть. Живых — людей и зверей — ты ставишь на семейное фото (მყავს), вещи кладёшь в чемодан
// (მაქვს). Без таймера: карточка ждёт, сколько нужно. Экран — HaveSort.tsx.
// Слова сцены, которые человек уже встретил, тоже приходят карточками: бабушка и дедушка (урок 25) — на
// фото; телефон (урок 28), паспорт (9) и фото (25) — в чемодан. Так урок 30 не повторяет урок 28.

export type HaveMode = 'people' | 'full'
export type Side = 'alive' | 'thing'

export interface Card extends Word { alive: boolean }

/** Слова, на которых легко ошибиться: ребёнок, друг, кошка — живые; деньги и хачапури — вещи. */
export const TRICKY = ['ბავშვი', 'მეგობარი', 'კატა', 'ფული', 'ხაჭაპური']

export const DECK_SIZE = 12

const card = (w: Word, alive: boolean): Card => ({ ...w, alive })

const SCENE_ALIVE = ['bebia', 'babua']
const SCENE_THINGS = ['telefoni', 'pasporti', 'foto']
const asWord = (id: string): Word => { const p = phrase(id); return { geo: p.geo, ru: p.ru, src: p.src } }

/** Слова сцены, которые к этому уроку уже встречались: живые и вещи. */
export function sceneWords(lessonId: number): { alive: Word[]; things: Word[] } {
  return {
    alive: SCENE_ALIVE.filter(id => met(lessonId, id)).map(asWord),
    things: SCENE_THINGS.filter(id => met(lessonId, id)).map(asWord)
  }
}

/** id слова сцены по грузинскому (для карточки «новое слово»). */
export const sceneIdOf = (geo: string) => [...SCENE_ALIVE, ...SCENE_THINGS, 'kata'].find(id => phrase(id).geo === geo)

/**
 * Колода: в people (урок 27) — в основном живое и немного вещей; в full — поровну и с хитрыми словами.
 * Одно и то же слово не повторяется.
 */
export function haveDeck(mode: HaveMode, rng: Rng = Math.random, size = DECK_SIZE, lessonId?: number): Card[] {
  const nAlive = mode === 'people' ? Math.round(size * 0.67) : Math.round(size / 2)
  const draw = (pool: Word[], n: number, must: string[] = []) => {
    const first = shuffle(pool.filter(w => must.includes(w.geo)), rng)
    const rest = shuffle(pool.filter(w => !must.includes(w.geo)), rng)
    const out = [...first, ...rest]
    while (out.length < n) out.push(...shuffle(pool, rng))
    return out.slice(0, n)
  }
  // Слова сцены — обязательно в колоде: ради них урок и отличается от прошлого. В уроке 27 — кошка.
  const extra = lessonId ? sceneWords(lessonId) : { alive: [], things: [] }
  const must = [...(mode === 'full' ? TRICKY : ['კატა']), ...extra.alive.map(w => w.geo), ...extra.things.map(w => w.geo)]
  const pool = shuffle([
    ...draw([...ALIVE, ...extra.alive], nAlive, must).map(w => card(w, true)),
    ...draw([...THINGS, ...extra.things], size - nAlive, must).map(w => card(w, false))
  ], rng)
  const cards: Card[] = []
  while (pool.length) {
    const k = pool.findIndex(c => c.geo !== cards[cards.length - 1]?.geo)
    cards.push(pool.splice(k < 0 ? 0 : k, 1)[0])
  }
  return cards
}

export const sideOf = (c: Card): Side => (c.alive ? 'alive' : 'thing')
export const verbOf = (s: Side) => (s === 'alive' ? 'მყავს' : 'მაქვს')
/** Целая фраза: «მე მყავს ძაღლი» / «მე მაქვს წიგნი». */
export const sentence = (c: Card) => `მე ${verbOf(sideOf(c))} ${c.geo}`

/** Подсказка на промах: «ძაღლი (собака) — кто-то живой, значит მყავს». */
export function hintFor(c: Card): string {
  return c.alive
    ? `${c.geo} (${c.ru}) — кто-то живой: на фото, ${verbOf('alive')}`
    : `${c.geo} (${c.ru}) — это вещь: в чемодан, ${verbOf('thing')}`
}

/** Запись фразы голосом героя: живые — по месту в ALIVE, вещи — в THINGS (public/audio/intro-story/have). */
const SCENE_AUDIO: Record<string, string> = {
  'ბებია': 'a-bebia', 'ბაბუა': 'a-babua', 'ტელეფონი': 't-telefoni', 'პასპორტი': 't-pasporti', 'ფოტო': 't-foto'
}

export function sentenceAudio(c: Card): string | undefined {
  if (SCENE_AUDIO[c.geo]) return `/audio/intro-story/have2/${SCENE_AUDIO[c.geo]}.m4a`
  const list = c.alive ? ALIVE : THINGS
  const k = list.findIndex(w => w.geo === c.geo)
  return k < 0 ? undefined : `/audio/intro-story/have/${c.alive ? 'a' : 't'}${k}.m4a`
}

export interface HaveState {
  i: number
  score: number
  combo: number
  best: number
  /** Верно с первого раза. */
  right: number
  misses: number
  /** Текущая карточка уже отскочила — за неё больше нет очков. */
  bounced: boolean
}

export const startState = (): HaveState => ({ i: 0, score: 0, combo: 0, best: 0, right: 0, misses: 0, bounced: false })

/** Очки: 10, с комбо от 3 — 15, от 6 — 20. */
export const pointsFor = (combo: number) => (combo >= 6 ? 20 : combo >= 3 ? 15 : 10)

export type Outcome = 'catch' | 'late-catch' | 'bounce'

/** Карточку отправили на сторону side. Верно — следующая; неверно — отскок, та же карточка ждёт. */
export function send(s: HaveState, c: Card, side: Side): { state: HaveState; outcome: Outcome; points: number } {
  if (side !== sideOf(c)) return { state: { ...s, combo: 0, misses: s.misses + 1, bounced: true }, outcome: 'bounce', points: 0 }
  if (s.bounced) return { state: { ...s, i: s.i + 1, bounced: false }, outcome: 'late-catch', points: 0 }
  const combo = s.combo + 1
  const points = pointsFor(combo)
  return { state: { ...s, i: s.i + 1, combo, best: Math.max(s.best, combo), score: s.score + points, right: s.right + 1, bounced: false }, outcome: 'catch', points }
}

export const isOver = (s: HaveState, deck: Card[]) => s.i >= deck.length
