import { CARD_TENSES, type TenseKey, type VerbDto, type VerbSentenceDto } from '../types'
import { meaningOf, sameMeaning, type Meaning } from '../meaning'
import { sentenceWords, wordOrderVerdict } from '../wordOrder'
import { pick, shuffle, type Rng } from '../games/common'

// Ступени формы: чистая логика без React и без сети. Каждая форма глагола поднимается по ступеням
// знакомство → узнать → выбрать → вставить во фразу → собрать фразу → написать самому.
// Здесь — как собрать задание нужного вида и как ответ двигает форму по ступеням. Какие задания и
// сцены войдут в сессию, решает постановщик (session/plan.ts); бесконечного режима «лесенка» больше нет.

/** Ступень формы = каким заданием её спросят в следующий раз. */
export const STEP = { NEW: 0, MEANING: 1, FORM: 2, GAP: 3, BUILD: 4, TYPE: 5, MASTERED: 6 } as const

/** Форма «окрепла», когда её уже узнали и выбрали сами: только после этого появляется новая. */
export const SOLID_STEP = STEP.GAP
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
  /** Что форма значит простыми словами: «я хочу». Это и есть «вопрос» и «ответ» в заданиях. */
  meaning: Meaning
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

export type { Rng }

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
      const meaning = meaningOf(verb, tense, person)
      items.push({ key: `${tense}:${person}`, tense, person, form: variants[0], variants, meaning, sentences, buildable })
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

/**
 * Неверные варианты: другие формы этого же глагола. Сначала те, что человек уже встречал —
 * путать должно с знакомым. Формы, которые пишутся так же, как верная, в варианты не попадают;
 * формы, которые по-русски читаются так же (та же фраза и та же пометка), — тоже: иначе на экране
 * оказались бы два одинаковых варианта.
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
    if ([item, ...result].some(other => sameMeaning(other.meaning, candidate.meaning))) continue
    candidate.variants.forEach(v => taken.add(v))
    result.push(candidate)
  }
  return result
}

export function makeTask(item: LadderItem, step: number, review: boolean, items: LadderItem[], progress: Progress, rng: Rng): Task {
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

// ── Сессии: те же ступени, но задание выбирает не лесенка, а постановщик сессии (session/plan.ts) ──

/** Виды заданий, из которых постановщик собирает сцены-квизы. */
export type TaskKind = 'intro' | 'meaning' | 'form' | 'gap' | 'build' | 'type'

/** Ступень, до которой задание такого вида может поднять форму: выбором из вариантов форму не «выучить». */
export const KIND_CEILING: Record<Exclude<TaskKind, 'intro'>, number> = {
  meaning: STEP.FORM, form: STEP.GAP, gap: STEP.BUILD, build: STEP.TYPE, type: STEP.MASTERED
}

/**
 * Задание заданного вида для формы. Если у формы нет материала (живой фразы) — ближайшее попроще:
 * собрать → вставить → выбрать.
 */
export function taskOfKind(kind: TaskKind, item: LadderItem, items: LadderItem[], progress: Progress, rng: Rng = Math.random): Task {
  if (kind === 'intro') {
    const sentence = [...item.sentences].sort((a, b) => tokens(a.ka).length - tokens(b.ka).length)[0]
    const twin = items.find(i => i.key !== item.key && stepOf(progress, i) > STEP.NEW && i.variants.some(v => item.variants.includes(v)))
    return { type: 'intro', item, sentence, twin }
  }
  const review = stepOf(progress, item) >= STEP.MASTERED
  const options = (n: number) => shuffle([item, ...distractors(item, items, progress, n, rng)], rng)
  if (kind === 'build' && item.buildable.length) return makeTask({ ...item, sentences: item.buildable }, STEP.BUILD, review, items, progress, rng)
  if ((kind === 'build' || kind === 'gap') && item.sentences.length) {
    return { type: 'gap', item, sentence: pick(item.sentences, rng), options: options(3), review }
  }
  if (kind === 'type') return { type: 'type', item, review }
  return kind === 'meaning'
    ? { type: 'meaning', item, options: options(2), review }
    : { type: 'form', item, options: options(3), review }
}

/**
 * Ответ в сцене сессии — та же модель ступеней, что у лесенки, с двумя оговорками:
 * 1) сцена поднимает форму не выше своего потолка (игра на узнавание не делает форму «выученной»);
 * 2) незнакомую форму засчитывают только сцены, которые её показывают (знакомство, комикс) — introduce.
 * null — состояние не изменилось, сохранять нечего.
 */
export function settleCapped(
  item: LadderItem, state: FormState | undefined, ok: boolean, ceiling: number, introduceNew = false
): FormState | null {
  if (!state || state.step === STEP.NEW) {
    if (!introduceNew) return null
    return ok ? settleCapped(item, introduce(), true, ceiling) ?? introduce() : introduce()
  }
  if (!ok) {
    // Выученную форму ошибка возвращает в игру; остальные — на ступень ниже.
    const next = settle(item, state, false)
    return next.step === state.step ? null : next
  }
  if (state.step >= STEP.MASTERED) return state.due ? settle(item, state, true) : null
  if (state.step >= ceiling) return null
  const up = settle(item, state, true)
  const step = Math.min(up.step, ceiling)
  return { ...up, step, best: Math.max(state.best, step) }
}

/** Главные времена, с которых начинают: сейчас, сделал, сделаю. Остальные — вторым кругом. */
const FIRST_TENSES: TenseKey[] = ['present', 'aorist', 'future']

/**
 * В каком порядке сессии знакомят с формами: сначала «я» — сейчас, сделал, сделаю; потом те же три
 * времени для «он» и «ты»; потом остальные времена для «я»; и так расширяясь по лицам и временам.
 */
export function introOrder(items: LadderItem[]): LadderItem[] {
  const rank = (i: LadderItem) => {
    const person = PERSON_ORDER.indexOf(i.person)
    const first = FIRST_TENSES.includes(i.tense)
    // Круги: (я,он,ты × первые времена) → (я × остальные) → (мы,они,вы × первые) → всё остальное по лицам.
    const round = first ? (person < 3 ? 0 : 2) : (person === 0 ? 1 : 3)
    return round * 1000 + person * 10 + CARD_TENSES.indexOf(i.tense)
  }
  return [...items].sort((a, b) => rank(a) - rank(b))
}
