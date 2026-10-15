import { COUNTRIES, JOBS, NAME_LIST, NAMES, knows, shuffle, type Rng } from '../story'
import { randomLook, type Look } from '../ui'

// «Кто есть кто» — чистая логика головоломки: соседи, варианты (страны или профессии), подслушанные реплики
// и проверка решётки. Экран — Detective.tsx. Каждая головоломка решается единственным образом, и ни одной
// реплики не лишней: убери любую — ответов станет больше одного.

const COATS = ['#1B5FB0', '#E01A3C', '#4E8A5B', '#C68F10', '#7A4E9A']

export type DetectiveMode = 'from' | 'jobs'

export interface Option {
  key: string
  /** Как это звучит в «მე ვარ …» / «ის არის …»: საქართველოდან или ექიმი. */
  say: string
  /** Подпись столбца по-грузински (страна без окончания или профессия). */
  geo: string
  ru: string
  /** Для вопроса «Ты …?» по-русски: «из Франции», «врач». */
  ask: string
  flag?: 'ge' | 'es' | 'fr'
}

export interface Neighbour { name: string; ru: string; look: Look }

/**
 * Реплика: me — сам о себе «მე ვარ X»; they — один говорит о другом «<имя>? ის არის X»;
 * not — на вопрос «Ты X?» человек отвечает «არა».
 */
export type Clue =
  | { kind: 'me'; who: number; opt: number }
  | { kind: 'they'; speaker: number; who: number; opt: number }
  | { kind: 'not'; who: number; opt: number }

export interface Puzzle {
  people: Neighbour[]
  options: Option[]
  /** solution[i] — номер варианта у соседа i. */
  solution: number[]
  clues: Clue[]
  /** Сложность 1..3: на третьей реплики подслушаны из-за угла — говорящего видно только по лицу. */
  level: number
}

export type Mark = 0 | 1 | 2 // пусто, ✓, ✗

export function optionsOf(mode: DetectiveMode): Option[] {
  if (mode === 'from') return COUNTRIES.map(c => ({ key: c.flag, say: c.from, geo: c.base, ru: c.ru, ask: c.ruFrom, flag: c.flag }))
  return JOBS.map(j => ({ key: j.geo, say: j.geo, geo: j.geo, ru: j.ru, ask: j.ru }))
}

/** Все расстановки n соседей по n вариантам. */
export function permutations(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  return out
}

export const holds = (c: Clue, sol: number[]) => (c.kind === 'not' ? sol[c.who] !== c.opt : sol[c.who] === c.opt)

/** Сколько расстановок подходит под все реплики. */
export const solutions = (n: number, clues: Clue[]) => permutations(n).filter(s => clues.every(c => holds(c, s)))

/** Ровно одно решение и ни одной лишней реплики. */
export function minimalUnique(n: number, clues: Clue[]): boolean {
  if (solutions(n, clues).length !== 1) return false
  return clues.every((_, i) => solutions(n, clues.filter((__, k) => k !== i)).length > 1)
}

/** Какие реплики доступны в этом уроке. */
export function clueKinds(mode: DetectiveMode, lessonId: number): Clue['kind'][] {
  const kinds: Clue['kind'][] = ['me']
  if (mode === 'jobs' && knows(lessonId, 'mascavlebeli')) kinds.push('they')
  if (knows(lessonId, 'ara')) kinds.push('not')
  return kinds
}

/** Состав реплик по уровням: от «двое сказали сами» до отрицаний и сплетен. */
function plans(mode: DetectiveMode, level: number, kinds: Clue['kind'][]): Clue['kind'][][] {
  const all: Clue['kind'][][] = level === 1 ? [['me', 'me']]
    : level === 2 ? (mode === 'jobs' ? [['they', 'me'], ['they', 'not'], ['me', 'not']] : [['me', 'not']])
      : (mode === 'jobs' ? [['they', 'not', 'not'], ['not', 'not', 'they'], ['they', 'not']] : [['not', 'not', 'me'], ['not', 'not', 'not']])
  const ok = all.filter(p => p.every(k => kinds.includes(k)))
  return ok.length ? ok : [['me', 'me']]
}

function randomClue(kind: Clue['kind'], sol: number[], rng: Rng): Clue {
  const n = sol.length
  const who = Math.floor(rng() * n)
  if (kind === 'me') return { kind, who, opt: sol[who] }
  if (kind === 'they') {
    const speaker = (who + 1 + Math.floor(rng() * (n - 1))) % n
    return { kind, speaker, who, opt: sol[who] }
  }
  const wrong = [...Array(n).keys()].filter(o => o !== sol[who])
  return { kind, who, opt: wrong[Math.floor(rng() * wrong.length)] }
}

export function makePuzzle(mode: DetectiveMode, level: number, lessonId: number, rng: Rng, names: string[] = NAME_LIST): Puzzle {
  const options = shuffle(optionsOf(mode), rng)
  const n = options.length
  // Разные куртки — на третьем деле говорящего узнают только по лицу и одежде.
  const coats = shuffle(COATS, rng)
  const people = shuffle(names, rng).slice(0, n).map((name, i) => ({ name, ru: NAMES[name] ?? name, look: randomLook(rng, { coat: coats[i % coats.length] }) }))
  const solution = shuffle([...Array(n).keys()], rng)
  const choices = plans(mode, level, clueKinds(mode, lessonId))
  for (let tries = 0; tries < 400; tries++) {
    const plan = choices[tries % choices.length]
    const clues = plan.map(k => randomClue(k, solution, rng))
    if (minimalUnique(n, clues)) return { people, options, solution, clues: shuffle(clues, rng), level }
  }
  // Запасной путь: двое говорят сами за себя — этого всегда хватает.
  const [a, b] = shuffle([...Array(n).keys()], rng)
  return { people, options, solution, clues: [{ kind: 'me', who: a, opt: solution[a] }, { kind: 'me', who: b, opt: solution[b] }], level }
}

export const PUZZLES = 3

export function makeCase(mode: DetectiveMode, lessonId: number, rng: Rng): Puzzle[] {
  return Array.from({ length: PUZZLES }, (_, i) => makePuzzle(mode, i + 1, lessonId, rng))
}

/** Грузинская реплика (только по проверенным образцам). */
export function clueGeo(c: Clue, p: Puzzle): string {
  if (c.kind === 'me') return `მე ვარ ${p.options[c.opt].say}.`
  if (c.kind === 'they') return `${p.people[c.who].name}? ის არის ${p.options[c.opt].say}.`
  return 'არა.'
}

/** Перевод реплики. */
export function clueRu(c: Clue, p: Puzzle): string {
  const o = p.options[c.opt]
  if (c.kind === 'me') return `Я ${o.ask}.`
  if (c.kind === 'they') return `${p.people[c.who].ru}? Он(а) ${o.ru}.`
  return 'Нет.'
}

/** Кто говорит реплику. */
export const speakerOf = (c: Clue) => (c.kind === 'they' ? c.speaker : c.who)

export const emptyGrid = (n: number): Mark[][] => Array.from({ length: n }, () => Array<Mark>(n).fill(0))

export const cycle = (m: Mark): Mark => ((m + 1) % 3) as Mark

/** Строки, где ответ неверен: нет ✓, больше одной ✓ или ✓ не там. */
export function wrongRows(grid: Mark[][], solution: number[]): number[] {
  return grid.flatMap((row, i) => {
    const ticks = row.flatMap((m, k) => (m === 1 ? [k] : []))
    return ticks.length === 1 && ticks[0] === solution[i] ? [] : [i]
  })
}

/** Какую реплику подсветить для неверной строки: ту, где этот сосед упомянут; null — о нём молчат (исключение). */
export function clueFor(row: number, clues: Clue[]): number | null {
  const k = clues.findIndex(c => c.who === row)
  return k >= 0 ? k : null
}
