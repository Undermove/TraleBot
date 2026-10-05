import { CARD_TENSES, type TenseKey, type VerbDto, type VerbSentenceDto } from '../types'
import { sentenceWords, wordOrderVerdict } from '../wordOrder'

// «Лесенка»: чистая логика без React и без сети. Каждая форма глагола поднимается по ступеням
// знакомство → узнать → выбрать → вставить во фразу → собрать фразу → написать самому.
// Здесь решается, какое задание показать следующим и как ответ двигает форму по ступеням.

/** Ступень формы = каким заданием её спросят в следующий раз. */
export const STEP = { NEW: 0, MEANING: 1, FORM: 2, GAP: 3, BUILD: 4, TYPE: 5, MASTERED: 6 } as const

/** Сколько форм одновременно в работе. */
export const MAX_IN_PLAY = 3
/** Форма «окрепла», когда её уже узнали и выбрали сами: только после этого появляется новая. */
export const SOLID_STEP = STEP.GAP
/** Сколько новых форм вводим за один заход. */
export const SESSION_NEW = 4
/** Порядок лиц: сначала «я», дальше по тому, как часто лицо нужно в разговоре. */
export const PERSON_ORDER = [0, 2, 1, 3, 5, 4]
/** Фразу собираем только из коротких предложений: в длинных порядок слов слишком свободный. */
export const BUILD_WORDS = { min: 3, max: 5 }

export interface LadderItem {
  /** `${tense}:${person}` — одна клетка таблицы спряжения. */
  key: string
  tense: TenseKey
  person: number
  /** Первый вариант формы — его показываем. */
  form: string
  /** Все варианты клетки — любой из них верный ответ. */
  variants: string[]
  /** Живые фразы, где эта форма стоит отдельным словом и точно в этом значении (см. sentenceIsSafe). */
  sentences: VerbSentenceDto[]
  /** Те из них, что годятся для сборки из слов. */
  buildable: VerbSentenceDto[]
}

export interface FormState {
  step: number
  /** Лучшая достигнутая ступень. */
  best: number
  /** Сколько раз выученную форму верно повторили. */
  reviews: number
  /** Выученная форма, которой пора на повторение. */
  due: boolean
}
export type Progress = Record<string, FormState>

export interface Session {
  /** Сколько новых форм уже введено в этом заходе. */
  introduced: number
  newLimit: number
  /** Форма и время прошлого задания — чтобы не спрашивать одно и то же подряд. */
  last: string | null
  lastTense: TenseKey | null
  lastReview: boolean
  /** Со второго захода чередуем времена, а не гоняем одно время блоком. */
  mix: boolean
  /** Сколько шагов было впереди в начале захода — знаменатель полоски. */
  planned: number
}

export interface Chip {
  text: string
  /** Лишняя фишка: другая форма того же глагола. */
  decoy?: LadderItem
}

export type Task =
  | { type: 'intro'; item: LadderItem; sentence?: VerbSentenceDto; twin?: LadderItem }
  | { type: 'meaning'; item: LadderItem; options: LadderItem[]; review: boolean }
  | { type: 'form'; item: LadderItem; options: LadderItem[]; review: boolean }
  | { type: 'gap'; item: LadderItem; sentence: VerbSentenceDto; options: LadderItem[]; review: boolean }
  | { type: 'build'; item: LadderItem; sentence: VerbSentenceDto; answer: string[]; chips: Chip[]; review: boolean }
  | { type: 'type'; item: LadderItem; review: boolean }
  /** session — на этот заход всё, но новые формы ещё есть; all — выучено всё и повторять пока нечего. */
  | { type: 'done'; reason: 'session' | 'all' }

export type Rng = () => number

/** Слова предложения без знаков препинания по краям (то же правило, что в комиксе). */
export const tokens = sentenceWords

/**
 * Времена, в которых форма «ты» / «вы» служит ещё и повелением или запретом («пиши», «не пиши»,
 * «напиши»). Фраза привязана к форме только по написанию, поэтому у таких клеток живая фраза может
 * значить не то, что обещает подпись клетки («ты · настоящее» — а фраза «Не пиши…»).
 */
const COMMAND_TENSES: TenseKey[] = ['present', 'aorist', 'optative']
const SECOND_PERSONS = [1, 4]

/**
 * Можно ли показывать фразу как пример этой клетки. Фразы в каталоге привязаны к форме по написанию,
 * а не по разбору, поэтому берём только те, где ошибиться клеткой нельзя:
 * 1) написание встречается в таблице глагола ровно в одной клетке (иначе неизвестно, какая из них во фразе);
 * 2) это не «ты» / «вы» во времени, которое служит и повелением.
 * Лучше оставить форму без фразы (задания с фразой тогда просто пропускаются), чем показать перевод,
 * который учит не тому.
 */
function sentenceIsSafe(tense: TenseKey, person: number, cellsBySpelling: Map<string, number>, form: string) {
  if (SECOND_PERSONS.includes(person) && COMMAND_TENSES.includes(tense)) return false
  return cellsBySpelling.get(form) === 1
}

/** Сколько клеток всей таблицы глагола (включая редкие времена) пишутся так же. */
function countSpellings(verb: VerbDto) {
  const cells = new Map<string, number>()
  for (const persons of Object.values(verb.tenses)) {
    for (const variants of persons ?? []) {
      for (const form of new Set(variants)) cells.set(form, (cells.get(form) ?? 0) + 1)
    }
  }
  return cells
}

/** Формы глагола в том порядке, в котором их вводит лесенка: шесть главных времён для «я», потом для остальных лиц. */
export function buildItems(verb: VerbDto): LadderItem[] {
  const items: LadderItem[] = []
  const spellings = countSpellings(verb)
  for (const person of PERSON_ORDER) {
    for (const tense of CARD_TENSES) {
      const variants = verb.tenses[tense]?.[person] ?? []
      if (!variants.length) continue
      const sentences = verb.sentences.filter(s =>
        variants.includes(s.form) && tokens(s.ka).includes(s.form) && sentenceIsSafe(tense, person, spellings, s.form))
      const buildable = sentences.filter(s => {
        const n = tokens(s.ka).length
        return n >= BUILD_WORDS.min && n <= BUILD_WORDS.max
      })
      items.push({ key: `${tense}:${person}`, tense, person, form: variants[0], variants, sentences, buildable })
    }
  }
  return items
}

const stepOf = (progress: Progress, item: LadderItem) => progress[item.key]?.step ?? STEP.NEW

/** Есть ли у формы материал для этой ступени: без живой фразы нечего вставлять и собирать. */
function hasStep(item: LadderItem, step: number) {
  if (step === STEP.GAP) return item.sentences.length > 0
  if (step === STEP.BUILD) return item.buildable.length > 0
  return true
}

/** Ступень, с которой форму реально спросят: недоступные ступени пропускаются вверх. */
export function taskStep(item: LadderItem, step: number) {
  let s = Math.max(STEP.MEANING, step)
  while (s < STEP.TYPE && !hasStep(item, s)) s++
  return Math.min(s, STEP.TYPE)
}

function stepUp(item: LadderItem, step: number) {
  let s = step + 1
  while (s < STEP.MASTERED && !hasStep(item, s)) s++
  return s
}

function stepDown(item: LadderItem, step: number) {
  let s = step - 1
  while (s > STEP.MEANING && !hasStep(item, s)) s--
  return Math.max(STEP.MEANING, s)
}

/** Форму показали впервые. */
export function introduce(): FormState {
  return { step: STEP.MEANING, best: STEP.MEANING, reviews: 0, due: false }
}

/**
 * Ответ на задание. Верно — ступень вверх, ошибка — на ступень вниз (но не ниже первой).
 * У выученной формы это повторение: верно — следующее повторение позже, ошибка — снова написать самому.
 */
export function settle(item: LadderItem, state: FormState | undefined, ok: boolean): FormState {
  const cur = state ?? introduce()
  if (cur.step >= STEP.MASTERED) {
    return ok
      ? { ...cur, reviews: cur.reviews + 1, due: false }
      : { ...cur, step: stepDown(item, STEP.MASTERED), due: false }
  }
  const at = taskStep(item, cur.step)
  const step = ok ? stepUp(item, at) : stepDown(item, at)
  return { step, best: Math.max(cur.best, step), reviews: cur.reviews, due: false }
}

/** Сколько заданий осталось форме до «выучена», начиная со ступени step. */
function stepsFrom(item: LadderItem, step: number) {
  let n = 0
  for (let s = taskStep(item, step); s < STEP.MASTERED; s = stepUp(item, s)) n++
  return n
}

/** Сколько шагов осталось до конца захода: формы в работе, повторения и новые формы, которые ещё введём. */
export function remaining(items: LadderItem[], progress: Progress, session: Pick<Session, 'introduced' | 'newLimit'>) {
  let n = 0
  let toIntroduce = session.newLimit - session.introduced
  for (const item of items) {
    const state = progress[item.key]
    const step = state?.step ?? STEP.NEW
    if (step === STEP.NEW) {
      if (toIntroduce > 0) { toIntroduce--; n += 1 + stepsFrom(item, STEP.MEANING) }
    } else if (step < STEP.MASTERED) n += stepsFrom(item, step)
    else if (state.due) n += 1
  }
  return n
}

export function startSession(items: LadderItem[], progress: Progress, newLimit = SESSION_NEW): Session {
  const base = { introduced: 0, newLimit }
  return {
    ...base,
    last: null,
    lastTense: null,
    lastReview: false,
    mix: items.some(i => stepOf(progress, i) >= STEP.MASTERED),
    planned: remaining(items, progress, base)
  }
}

/** Запоминаем показанное задание, чтобы следующее от него отличалось. */
export function afterTask(session: Session, task: Task): Session {
  if (task.type === 'done') return session
  return {
    ...session,
    introduced: session.introduced + (task.type === 'intro' ? 1 : 0),
    last: task.item.key,
    lastTense: task.item.tense,
    lastReview: task.type !== 'intro' && task.review
  }
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(xs: T[], rng: Rng) => xs[Math.floor(rng() * xs.length)]

/**
 * Неверные варианты: другие формы этого же глагола. Сначала те, что человек уже встречал —
 * путать должно с знакомым. Формы, которые пишутся так же, как верная, в варианты не попадают.
 */
export function distractors(
  item: LadderItem, items: LadderItem[], progress: Progress, n: number, rng: Rng, avoid: string[] = []
): LadderItem[] {
  const taken = new Set([...item.variants, ...avoid])
  const usable = items.filter(i => i.key !== item.key)
  const met = shuffle(usable.filter(i => stepOf(progress, i) > STEP.NEW), rng)
  // Из незнакомых берём ближайшие по очереди: они появятся следующими.
  const unmet = usable.filter(i => stepOf(progress, i) === STEP.NEW)
  const result: LadderItem[] = []
  for (const candidate of [...met, ...shuffle(unmet.slice(0, 6), rng), ...unmet.slice(6)]) {
    if (result.length === n) break
    if (candidate.variants.some(v => taken.has(v))) continue
    candidate.variants.forEach(v => taken.add(v))
    result.push(candidate)
  }
  return result
}

function makeTask(item: LadderItem, step: number, review: boolean, items: LadderItem[], progress: Progress, rng: Rng): Task {
  const options = (n: number) => shuffle([item, ...distractors(item, items, progress, n, rng)], rng)
  switch (taskStep(item, step)) {
    case STEP.MEANING:
      return { type: 'meaning', item, options: options(2), review }
    case STEP.FORM:
      return { type: 'form', item, options: options(3), review }
    case STEP.GAP:
      return { type: 'gap', item, sentence: pick(item.sentences, rng), options: options(3), review }
    case STEP.BUILD: {
      const sentence = pick(item.buildable, rng)
      const answer = tokens(sentence.ka)
      // Лишние фишки — другие формы глагола: задание проверяет выбор формы, а не порядок слов.
      const decoys = distractors(item, items, progress, answer.length <= 4 ? 2 : 1, rng, answer)
      const chips: Chip[] = [...answer.map(text => ({ text })), ...decoys.map(d => ({ text: d.form, decoy: d }))]
      return { type: 'build', item, sentence, answer, chips: shuffle(chips, rng), review }
    }
    default:
      return { type: 'type', item, review }
  }
}

/** Среди кандидатов предпочитаем форму другого времени, чем в прошлом задании. */
function preferOtherTense(pool: LadderItem[], session: Session) {
  if (!session.mix || !session.lastTense) return pool
  const other = pool.filter(i => i.tense !== session.lastTense)
  return other.length ? other : pool
}

/**
 * Следующее задание.
 * 1. Новая форма — только если повторять нечего, в работе меньше трёх форм и все они окрепли.
 * 2. Повторения выученного идут вперемешку с формами в работе и раньше новых форм.
 * 3. Из форм в работе берём самые слабые; только что спрошенную подряд не спрашиваем, если есть другая.
 */
export function nextTask(items: LadderItem[], progress: Progress, session: Session, rng: Rng = Math.random): Task {
  const active = items.filter(i => { const s = stepOf(progress, i); return s > STEP.NEW && s < STEP.MASTERED })
  const due = items.filter(i => stepOf(progress, i) >= STEP.MASTERED && progress[i.key].due)
  const fresh = items.find(i => stepOf(progress, i) === STEP.NEW)
  const mayIntroduce = !!fresh && session.introduced < session.newLimit

  const solid = active.every(i => stepOf(progress, i) >= SOLID_STEP)
  if (fresh && mayIntroduce && !due.length && active.length < MAX_IN_PLAY && solid) {
    const sentence = [...fresh.sentences].sort((a, b) => tokens(a.ka).length - tokens(b.ka).length)[0]
    const twin = items.find(i => i.key !== fresh.key && stepOf(progress, i) > STEP.NEW && i.variants.some(v => fresh.variants.includes(v)))
    return { type: 'intro', item: fresh, sentence, twin }
  }

  const notLast = active.filter(i => i.key !== session.last)
  if (due.length && (!notLast.length || !session.lastReview)) {
    const item = pick(preferOtherTense(due, session), rng)
    // Повторение — то проще (узнать во фразе или среди вариантов), то труднее (написать самому).
    const step = progress[item.key].reviews % 2 === 0 ? (item.sentences.length ? STEP.GAP : STEP.FORM) : STEP.TYPE
    return makeTask(item, step, true, items, progress, rng)
  }

  if (active.length) {
    const pool = notLast.length ? notLast : active
    const lowest = Math.min(...pool.map(i => taskStep(i, stepOf(progress, i))))
    const weakest = pool.filter(i => taskStep(i, stepOf(progress, i)) <= lowest + 1)
    const item = pick(preferOtherTense(weakest, session), rng)
    return makeTask(item, stepOf(progress, item), false, items, progress, rng)
  }

  return { type: 'done', reason: fresh ? 'session' : 'all' }
}

export type BuildVerdict =
  /** Слово в слово как в источнике. */
  | { kind: 'exact' }
  /** Все слова те, порядок другой: форма глагола выбрана верно, а порядок в грузинском гибкий. */
  | { kind: 'order' }
  /** В фразу попала не та форма глагола. */
  | { kind: 'decoy'; chip: Chip }

/** Проверка собранной фразы. Ошибкой считается только неверная форма глагола, не порядок слов. */
export function checkBuild(task: Extract<Task, { type: 'build' }>, placed: Chip[]): BuildVerdict {
  const decoy = placed.find(c => c.decoy)
  if (decoy) return { kind: 'decoy', chip: decoy }
  return { kind: wordOrderVerdict(placed.map(c => c.text), task.sentence.ka) }
}

/** Какая это форма, если человек выбрал или написал её вместо нужной. */
export const findForm = (items: LadderItem[], form: string) => items.find(i => i.variants.includes(form))

/** Предложение с пропуском на месте формы. */
export function withGap(sentence: string, form: string, reveal: boolean) {
  let done = false
  return sentence.split(/(\s+)/).map(word => {
    if (done || tokens(word)[0] !== form) return word
    done = true
    return reveal ? word : word.replace(form, '_____')
  }).join('')
}
