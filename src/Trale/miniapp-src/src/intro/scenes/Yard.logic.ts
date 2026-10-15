import { knows, phrase, type Rng } from '../story'
import { randomLook, type Look, type Mood } from '../ui'

// «Дворик» — чистый движок: один день во дворе батумской многоэтажки. Часы идут от 0 до dayMs; соседи
// выходят из подъезда (уходят по делам) или приходят с улицы; каждый останавливается и ждёт ответа.
// Экран только рисует состояние и зовёт yardTick / yardAnswer. Случай и время — снаружи, для тестов.

export type YardMode = 'hello' | 'day' | 'full'
export type Part = 'morning' | 'day' | 'evening'
/** Что сосед ждёт: приветствие/прощание от тебя, ответ на его «გამარჯობა!», ответ на «как дела?». */
export type Need = 'greet' | 'first' | 'ask'

export interface Visitor {
  n: number
  /** in — пришёл с улицы домой, out — вышел из подъезда и уходит. */
  dir: 'in' | 'out'
  part: Part
  needs: Need[]
  look: Look
}

export type Stage = 'walk' | 'wait' | 'react' | 'gone'

export interface Active {
  v: Visitor
  stage: Stage
  /** Когда началась стадия (время дня, мс). */
  at: number
  /** Какая по счёту просьба соседа сейчас. */
  need: number
  waitMs: number
  mood: Mood
  /** Что сосед говорит сейчас (id фразы). */
  line?: string
  /** После реакции: следующая просьба или уходит. */
  then?: 'next' | 'leave'
  /** Ошибок на этой просьбе. */
  misses: number
  happy?: boolean
}

export interface YardState {
  lessonId: number
  mode: YardMode
  dayMs: number
  t: number
  nextAt: number
  seq: number
  active: Active | null
  smiles: number
  /** Настроение двора, 0..1. */
  mood: number
  combo: number
  best: number
  /** Сколько раз ответил верно (в том числе «годится, но…»). */
  correct: number
  misses: number
  timeouts: number
  /** Русские подсказки под кнопками. */
  hints: boolean
  tip: string
  over: boolean
}

export const WALK_MS = 1200
export const REACT_MS = 900
export const GONE_MS = 1100
/** Сколько верных ответов, прежде чем убрать русские подсказки. */
export const HINTS_OFF_AFTER = 6

export const dayLength = (mode: YardMode) => (mode === 'hello' ? 40_000 : 54_000)

export function partAt(mode: YardMode, p: number): Part {
  if (mode === 'hello') return 'day'
  return p < 0.34 ? 'morning' : p < 0.67 ? 'day' : 'evening'
}

export const PART_RU: Record<Part, string> = { morning: 'утро', day: 'день', evening: 'вечер' }
const PART_WHEN: Record<Part, string> = { morning: 'утром', day: 'днём', evening: 'вечером' }

/** Как здороваются в это время суток (из того, что человек уже знает). */
export function greetFor(lessonId: number, part: Part): string {
  if (part === 'morning' && knows(lessonId, 'dila')) return 'dila'
  if (part === 'evening' && knows(lessonId, 'saghamo')) return 'saghamo'
  return 'gamarjoba'
}

/** Что сосед говорит сам (или ничего — тогда начинаешь ты). */
export const lineFor = (need: Need): string | undefined => (need === 'first' ? 'gamarjoba' : need === 'ask' ? 'rogor' : undefined)

/** Кнопки-реплики под двором для этой просьбы. Порядок постоянный — чтобы рука запоминала. */
export function panelFor(lessonId: number, mode: YardMode, need: Need): string[] {
  const ids = need === 'first' ? ['gagimarjos', 'gamarjoba', 'dila', 'nakhvamdis']
    : need === 'ask' ? ['kargad_madloba', 'kargad_shen', 'gagimarjos', 'nakhvamdis']
      : mode === 'hello' ? ['gamarjoba', 'nakhvamdis'] : ['dila', 'gamarjoba', 'saghamo', 'nakhvamdis']
  return ids.filter(id => knows(lessonId, id))
}

export function expectedFor(lessonId: number, v: Visitor, need: Need): string {
  if (need === 'first') return 'gagimarjos'
  if (need === 'ask') return 'kargad_madloba'
  return v.dir === 'out' ? 'nakhvamdis' : greetFor(lessonId, v.part)
}

export type Result = 'right' | 'bonus' | 'soft' | 'miss'
export interface Verdict { res: Result; hint: string; /** Что сосед отвечает (id фразы). */ react?: string }

const g = (id: string) => phrase(id).geo

export function judge(lessonId: number, v: Visitor, need: Need, id: string): Verdict {
  if (need === 'first') {
    if (id === 'gagimarjos') return { res: 'right', hint: '' }
    if (id === 'gamarjoba') return { res: 'miss', hint: `Тебе уже сказали ${g('gamarjoba')}. В ответ говорят ${g('gagimarjos')} — «и тебе».` }
    if (id === 'nakhvamdis') return { res: 'miss', hint: 'Сосед только поздоровался, а ты уже прощаешься.' }
    return { res: 'miss', hint: 'Сосед поздоровался первым — ответь на его приветствие.' }
  }
  if (need === 'ask') {
    if (id === 'kargad_shen') return { res: 'bonus', hint: 'Ещё и спросил в ответ — сосед расцвёл.', react: 'kargad_madloba' }
    if (id === 'kargad_madloba') return { res: 'right', hint: '' }
    return { res: 'miss', hint: `Сосед спросил, как дела. Ответь: ${g('kargad_madloba')}.` }
  }
  if (v.dir === 'out') {
    if (id === 'nakhvamdis') return { res: 'right', hint: '', react: 'nakhvamdis' }
    return { res: 'miss', hint: `Сосед уходит — ему говорят ${g('nakhvamdis')}.` }
  }
  const want = greetFor(lessonId, v.part)
  // Сосед отвечает на приветствие: на გამარჯობა — გაგიმარჯოს (если человек это уже встречал), иначе тем же.
  const react = (said: string) => (said === 'gamarjoba' && knows(lessonId, 'gagimarjos') ? 'gagimarjos' : said)
  if (id === want) return { res: 'right', hint: '', react: react(id) }
  if (id === 'gamarjoba') return { res: 'soft', hint: `Годится в любое время. Но ${PART_WHEN[v.part]} соседям приятнее ${g(want)}.`, react: react(id) }
  if (id === 'nakhvamdis') return { res: 'miss', hint: 'Сосед только пришёл, а ты прощаешься.' }
  return { res: 'miss', hint: `Сейчас ${PART_RU[v.part]}. Посмотри на небо.` }
}

// ── Ход дня ───────────────────────────────────────────────────────────────────────────────────────

export function yardStart(lessonId: number, mode: YardMode): YardState {
  return {
    lessonId, mode, dayMs: dayLength(mode), t: 0, nextAt: 600, seq: 0, active: null,
    smiles: 0, mood: 0.55, combo: 0, best: 0, correct: 0, misses: 0, timeouts: 0, hints: true,
    tip: mode === 'hello' ? 'Пришёл с улицы — поздоровайся. Уходит — попрощайся.' : 'Смотри на небо: солнце показывает время суток.',
    over: false
  }
}

/** Терпение соседа: первый ждёт долго, дальше всё быстрее, но не быстрее трёх с половиной секунд. */
export function patience(seq: number, mode: YardMode): number {
  if (seq <= 1) return 9000
  return Math.max(3500, (mode === 'hello' ? 6500 : 6000) - seq * 160)
}

export function newVisitor(s: Pick<YardState, 'lessonId' | 'mode' | 'dayMs' | 'seq'>, t: number, rng: Rng): Visitor {
  const part = partAt(s.mode, t / s.dayMs)
  // Утром чаще уходят на работу, вечером чаще возвращаются.
  const leaveP = part === 'morning' ? 0.55 : part === 'evening' ? 0.25 : 0.4
  const dir: Visitor['dir'] = rng() < leaveP ? 'out' : 'in'
  const needs: Need[] = []
  const full = s.mode === 'full'
  if (dir === 'in' && full && knows(s.lessonId, 'gagimarjos') && rng() < 0.3) needs.push('first')
  else needs.push('greet')
  if (dir === 'in' && full && knows(s.lessonId, 'rogor') && rng() < 0.35) needs.push('ask')
  const r = rng()
  const look = randomLook(rng, { bag: dir === 'out' ? rng() < 0.75 : rng() < 0.3, age: r < 0.15 ? 'old' : r < 0.25 ? 'kid' : 'adult' })
  return { n: s.seq + 1, dir, part, needs, look }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))

/** Время идёт: соседи приходят, ждут, уходят; день кончается. */
export function yardTick(s: YardState, t: number, rng: Rng): YardState {
  if (s.over) return s
  let n: YardState = { ...s, t }
  const a = n.active
  if (a) {
    const since = t - a.at
    if (a.stage === 'walk' && since >= WALK_MS) {
      const need = a.v.needs[a.need]
      n.active = { ...a, stage: 'wait', at: t, line: lineFor(need) }
    } else if (a.stage === 'wait' && since >= a.waitMs) {
      n = { ...n, combo: 0, mood: clamp(n.mood - 0.08), timeouts: n.timeouts + 1, tip: 'Сосед ушёл, так и не дождавшись ответа.' }
      n.active = { ...a, stage: 'react', at: t, mood: 'sad', then: 'leave', happy: false, line: undefined }
    } else if (a.stage === 'react' && since >= REACT_MS) {
      if (a.then === 'next') {
        const need = a.v.needs[a.need + 1]
        n.active = { ...a, stage: 'wait', at: t, need: a.need + 1, line: lineFor(need), misses: 0, mood: 'smile', waitMs: patience(n.seq, n.mode) }
      } else n.active = { ...a, stage: 'gone', at: t, line: undefined }
    } else if (a.stage === 'gone' && since >= GONE_MS) {
      n.active = null
      n.nextAt = t + 400 + Math.floor(rng() * 800)
    }
  }
  if (!n.active) {
    if (t >= n.dayMs) return { ...n, over: true }
    // Последний сосед выходит не позже, чем за 4 секунды до заката: успеет договорить.
    if (t >= n.nextAt && t < n.dayMs - 4000) {
      const v = newVisitor(n, t, rng)
      n.seq += 1
      n.active = { v, stage: 'walk', at: t, need: 0, waitMs: patience(n.seq, n.mode), mood: 'smile', misses: 0 }
    }
  }
  return n
}

/** Можно ли сейчас отвечать. */
export const canAnswer = (s: YardState) => !!s.active && s.active.stage === 'wait' && !s.over

/** Ответ кнопкой-репликой. Без ожидающего соседа — ничего не меняет. */
export function yardAnswer(s: YardState, id: string): { s: YardState; verdict: Verdict | null } {
  const a = s.active
  if (!a || a.stage !== 'wait' || s.over) return { s, verdict: null }
  const need = a.v.needs[a.need]
  const verdict = judge(s.lessonId, a.v, need, id)
  let n: YardState = { ...s }
  if (verdict.res === 'miss') {
    const misses = a.misses + 1
    const want = expectedFor(s.lessonId, a.v, need)
    // Два промаха подряд — подсказываем прямо, что сказать.
    const tip = misses >= 2 ? `${verdict.hint} Нажми ${g(want)}.` : verdict.hint
    n = { ...n, combo: 0, mood: clamp(n.mood - 0.06), misses: n.misses + 1, tip }
    n.active = { ...a, mood: 'huh', misses }
    return { s: n, verdict }
  }
  const combo = verdict.res === 'soft' ? 0 : n.combo + 1
  const gain = verdict.res === 'soft' ? 1 : (combo >= 3 ? 2 : 1) + (verdict.res === 'bonus' ? 1 : 0)
  const correct = n.correct + 1
  const hintsOff = n.hints && correct >= HINTS_OFF_AFTER
  const tip = hintsOff ? 'Подсказки под кнопками убраны — дальше сам. Ты справишься.'
    : verdict.hint || (combo >= 3 ? `Серия ${combo}: соседи улыбаются вдвойне.` : '')
  n = {
    ...n, combo, best: Math.max(n.best, combo), smiles: n.smiles + gain, correct, hints: n.hints && !hintsOff, tip,
    mood: clamp(n.mood + (verdict.res === 'soft' ? 0.02 : verdict.res === 'bonus' ? 0.1 : 0.08))
  }
  const more = a.need + 1 < a.v.needs.length
  n.active = { ...a, stage: 'react', at: s.t, mood: verdict.res === 'bonus' ? 'wow' : 'smile', then: more ? 'next' : 'leave', happy: true, line: verdict.react }
  return { s: n, verdict }
}

export function moodVerdict(mood: number): string {
  if (mood >= 0.75) return 'Двор тебя полюбил. Завтра соседка с третьего этажа сама с тобой заговорит.'
  if (mood >= 0.45) return 'Двор к тебе привыкает. Ещё пара таких дней — и тебя будут звать на чай.'
  return 'Соседи пока присматриваются. Попробуй ещё один день — они добрые.'
}
