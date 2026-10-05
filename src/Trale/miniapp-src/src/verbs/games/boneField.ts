import { CARD_TENSES, PERSONS, type TenseKey, type VerbDto } from '../types'
import { formOf, isFullTense, isPlayable, shuffle, variantsOf, type Rng } from './common'

// «Косточки»: таблица спряжения как поле. Чистая логика без React.

export const COLS = PERSONS.length
/** Меньше трёх строк — не поле, а полоска: по цифрам нечего вычислять. */
const MIN_ROWS = 3

/** Строки поля: главные времена карточки, в которых есть формы для всех шести лиц. */
export const boneRows = (verb: VerbDto): TenseKey[] => CARD_TENSES.filter(t => isFullTense(verb, t))

export const canPlayBones = (verb: VerbDto): boolean => isPlayable(verb) && boneRows(verb).length >= MIN_ROWS

/** Одна косточка на пять клеток: достаточно, чтобы цифры что-то значили, и не так много, чтобы копать подряд. */
export const boneCount = (cells: number): number => Math.max(3, Math.round(cells / 5))

export function plantBones(cells: number, rng: Rng = Math.random): Set<number> {
  return new Set(shuffle([...Array(cells).keys()], rng).slice(0, boneCount(cells)))
}

/** Сколько косточек в соседних клетках (по сторонам и по диагонали). */
export function bonesNear(bones: ReadonlySet<number>, rows: number, cell: number): number {
  const r = Math.floor(cell / COLS), c = cell % COLS
  let n = 0
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc
      if ((dr || dc) && rr >= 0 && rr < rows && cc >= 0 && cc < COLS && bones.has(rr * COLS + cc)) n++
    }
  return n
}

export const cellSlot = (rows: readonly TenseKey[], cell: number) =>
  ({ tense: rows[Math.floor(cell / COLS)], person: cell % COLS })

/** Набранное подходит к клетке: годится любой из вариантов формы. */
export function digs(verb: VerbDto, rows: readonly TenseKey[], cell: number, typed: string): boolean {
  const { tense, person } = cellSlot(rows, cell)
  return variantsOf(verb, tense, person).includes(typed.trim())
}

/** Четыре варианта для клетки: её форма и три формы из других клеток поля. */
export function digOptions(verb: VerbDto, rows: readonly TenseKey[], cell: number, rng: Rng = Math.random): string[] {
  const { tense, person } = cellSlot(rows, cell)
  const accepted = variantsOf(verb, tense, person)
  const others = new Set<string>()
  for (const t of rows)
    for (let p = 0; p < COLS; p++) {
      const f = formOf(verb, t, p)
      if (!accepted.includes(f)) others.add(f)
    }
  return shuffle([accepted[0], ...shuffle([...others], rng).slice(0, 3)], rng)
}
