import { CARD_TENSES, PERSONS, type TenseKey, type VerbDto } from '../types'
import { formOf, isPlayable, pick, shuffle, type Rng } from './common'

// «Конструктор»: форма = приставка + показатель лица + корень + окончание. Чистая логика без React.
// Разрез считается только по данным карточки; что не режется без остатка — в игру не попадает.

export interface Parts { preverb: string; marker: string; root: string; ending: string }

/** Из чего собираются формы этого глагола. */
export interface Scheme {
  root: string
  /** Приставка будущего и аориста: то, чем «я сделаю» длиннее, чем «я делаю». */
  preverb: string
  /** Показатель 1-го лица: то, что стоит перед корнем в «я делаю». */
  marker: string
}

/** 1-е лицо — «я» и «мы»: в их формах стоит показатель лица. */
const isFirstPerson = (person: number) => person === 0 || person === 3

/**
 * Схема есть только у глаголов «по образцу», у которых будущее — это приставка + настоящее,
 * а показатель лица виден прямо в таблице. Иначе null: такой глагол конструктору не по зубам.
 */
export function schemeOf(verb: VerbDto): Scheme | null {
  if (verb.kind !== 'pattern' || !verb.root) return null
  const i = formOf(verb, 'present', 0)
  const you = formOf(verb, 'present', 1)
  const iWill = formOf(verb, 'future', 0)
  if (!i || !you || !iWill) return null
  if (!iWill.endsWith(i) || iWill.length === i.length) return null
  const at = i.indexOf(verb.root)
  if (at <= 0 || !you.startsWith(verb.root)) return null
  return { root: verb.root, preverb: iWill.slice(0, iWill.length - i.length), marker: i.slice(0, at) }
}

/**
 * Режет форму на части. null, если она не складывается обратно из
 * [приставка] + [показатель лица, только у «я» и «мы»] + корень + окончание.
 */
export function splitForm(scheme: Scheme, form: string, person: number): Parts | null {
  const at = form.indexOf(scheme.root)
  if (at < 0) return null
  const head = form.slice(0, at)
  const preverb = head.startsWith(scheme.preverb) ? scheme.preverb : ''
  const marker = head.slice(preverb.length)
  if (marker !== (isFirstPerson(person) ? scheme.marker : '')) return null
  return { preverb, marker, root: scheme.root, ending: form.slice(at + scheme.root.length) }
}

export interface BuilderCell { tense: TenseKey; person: number; form: string; parts: Parts }

/** Все клетки главных времён, которые режутся без остатка и записаны одним вариантом. */
export function builderCells(verb: VerbDto): BuilderCell[] {
  const scheme = schemeOf(verb)
  if (!scheme) return []
  const out: BuilderCell[] = []
  for (const tense of CARD_TENSES)
    for (let person = 0; person < PERSONS.length; person++) {
      const variants = verb.tenses[tense]?.[person] ?? []
      if (variants.length !== 1) continue
      const parts = splitForm(scheme, variants[0], person)
      if (parts) out.push({ tense, person, form: variants[0], parts })
    }
  return out
}

/** Минимум клеток, чтобы игра не повторялась по кругу. */
const MIN_CELLS = 12

/**
 * Конструктор предлагаем, если в каждом ряду есть настоящий выбор: формы с приставкой и без,
 * с показателем лица и без, и хотя бы два разных окончания.
 */
export function canPlayBuilder(verb: VerbDto): boolean {
  if (!isPlayable(verb)) return false
  const cells = builderCells(verb)
  return cells.length >= MIN_CELLS
    && cells.some(c => c.parts.preverb) && cells.some(c => !c.parts.preverb)
    && cells.some(c => c.parts.marker) && cells.some(c => !c.parts.marker)
    && new Set(cells.map(c => c.parts.ending)).size >= 2
}

/** Ступень сложности: 1 — выбираешь только окончание, 2 — ещё и показатель лица, 3 — ещё и приставку. */
export type Stage = 1 | 2 | 3
/** Сколько собранных форм нужно на каждой ступени, чтобы перейти дальше. */
export const STAGE_STEP = 3
export const stageFor = (solved: number): Stage => (solved < STAGE_STEP ? 1 : solved < STAGE_STEP * 2 ? 2 : 3)

export interface Puzzle {
  cell: BuilderCell
  stage: Stage
  /** Варианты в рядах; пустая строка — «в этом месте ничего нет». Ряд из одного варианта уже поставлен за игрока. */
  preverbs: string[]
  markers: string[]
  endings: string[]
}

/**
 * Задание по ступени. На первой — только единственное число, приставка и показатель лица уже стоят.
 * extraPreverbs — приставки других глаголов из каталога (для ложных вариантов), если они известны.
 */
export function makePuzzle(
  verb: VerbDto, solved: number, rng: Rng = Math.random, extraPreverbs: readonly string[] = [], prev?: Puzzle
): Puzzle {
  const scheme = schemeOf(verb)
  const cells = builderCells(verb)
  if (!scheme || !cells.length) throw new Error('Конструктор не умеет этот глагол')
  const stage = stageFor(solved)
  const singular = cells.filter(c => c.person < 3)
  const from = stage === 1 && singular.length > 1 ? singular : cells
  const pool = from.filter(c => c.form !== prev?.cell.form)
  const cell = pick(pool.length ? pool : from, rng)

  const otherEndings = [...new Set(cells.map(c => c.parts.ending))].filter(e => e !== cell.parts.ending)
  const otherPreverbs = [...new Set(extraPreverbs)].filter(p => p && p !== scheme.preverb)
  return {
    cell, stage,
    preverbs: stage < 3 ? [cell.parts.preverb] : shuffle([scheme.preverb, '', ...shuffle(otherPreverbs, rng).slice(0, 2)], rng),
    markers: stage < 2 ? [cell.parts.marker] : [scheme.marker, ''],
    endings: shuffle([cell.parts.ending, ...shuffle(otherEndings, rng).slice(0, 3)], rng)
  }
}

export interface Choice { preverb: string; marker: string; ending: string }
export const assemble = (root: string, p: Choice): string => p.preverb + p.marker + root + p.ending

/** Какие ряды выбраны не так, как в задании. */
export function wrongRows(cell: BuilderCell, p: Choice): ('preverb' | 'marker' | 'ending')[] {
  return (['preverb', 'marker', 'ending'] as const).filter(k => p[k] !== cell.parts[k])
}
