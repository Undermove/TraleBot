import { knows, phrase, type Rng } from '../story'
import { PART_RU, greetFor, type Part } from './Walk.logic'

// «Пекарня» — чистая логика. Каждое утро (а иногда вечером) ты заходишь за шоти в пекарню у дома.
// Пекарша — уже знакомая: здоровается, спрашивает, как дела, — или ждёт, что начнёшь ты. Визит — короткий
// разговор по шагам: поздороваться по времени суток, поговорить о делах, забрать хлеб, попрощаться.
// Экран — Bakery.tsx.

export type BakeryMode = 'howareyou'

/** Шаг визита: кто говорит, что нужно ответить тебе, что скажет пекарша после. */
export interface Step {
  cue: string
  /** Реплика пекарши до твоего ответа (нет — начинаешь ты). */
  line?: string
  want: string
  soft?: string[]
  react?: string
  /** После этого шага пекарша выносит хлеб. */
  bread?: boolean
}

export interface Visit { day: string; part: Part; steps: Step[] }

const DAYS = ['понедельник', 'вторник', 'среда', 'четверг']
const PARTS: Part[] = ['morning', 'morning', 'day', 'evening']

/** Четыре визита: в первом пекарша сама начинает всё, дальше — по-разному, чтобы не по шаблону. */
export function plan(lessonId: number, rng: Rng = Math.random): Visit[] {
  return DAYS.map((day, i) => {
    const part = PARTS[i]
    const greet = greetFor(lessonId, part)
    const steps: Step[] = []
    const theyGreet = i === 0 || rng() < 0.5
    steps.push(theyGreet
      ? { cue: 'Пекарша поздоровалась первой. Ответь.', line: greet, want: greet, soft: greet === 'gamarjoba' ? [] : ['gamarjoba'] }
      : { cue: 'Пекарша занята тестом. Поздоровайся первым.', want: greet, soft: greet === 'gamarjoba' ? [] : ['gamarjoba'], react: greet })
    // «Как дела?» — то спрашивают тебя, то спрашиваешь ты.
    const youAsk = i > 0 && (i === 2 || rng() < 0.4)
    steps.push(youAsk
      ? { cue: 'Пекарша выглядит уставшей. Спроси, как у неё дела.', want: 'rogor', react: 'kargad_madloba', bread: true }
      : { cue: 'Пекарша спрашивает, как дела.', line: 'rogor', want: 'kargad_madloba', bread: true })
    steps.push({ cue: 'Хлеб у тебя. Попрощайся.', want: 'nakhvamdis', react: 'nakhvamdis' })
    return { day, part, steps }
  })
}

export type Result = 'right' | 'soft' | 'miss'
export interface Verdict { res: Result; hint: string }

const g = (id: string) => phrase(id).geo
const WHEN: Record<Part, string> = { morning: 'утром', day: 'днём', evening: 'вечером' }

export function judge(lessonId: number, v: Visit, s: Step, id: string): Verdict {
  if (id === s.want) return { res: 'right', hint: '' }
  if (s.soft?.includes(id)) return { res: 'soft', hint: `${g('gamarjoba')} годится всегда. Но ${WHEN[v.part]} говорят ${g(s.want)}.` }
  if (s.want === 'nakhvamdis') return { res: 'miss', hint: `Ты уходишь — скажи ${g('nakhvamdis')}.` }
  if (s.want === 'rogor') return { res: 'miss', hint: `Спроси её саму: ${g('rogor')} — как дела?` }
  if (s.want === 'kargad_madloba') {
    return id === 'rogor'
      ? { res: 'miss', hint: 'Тебя уже спросили, как дела. Ответь — потом можно спросить в ответ.' }
      : { res: 'miss', hint: `Спросили, как дела. Ответь: ${g('kargad_madloba')}.` }
  }
  if (id === 'nakhvamdis') return { res: 'miss', hint: 'Ты только пришёл, а уже прощаешься.' }
  return { res: 'miss', hint: lessonId >= 2 ? `Посмотри в окно: сейчас ${PART_RU[v.part]}.` : 'Сначала поздоровайся.' }
}

/** Кнопки — всегда одни и те же, в одном порядке. */
export const replies = (lessonId: number) =>
  ['dila', 'gamarjoba', 'saghamo', 'rogor', 'kargad_madloba', 'nakhvamdis'].filter(id => knows(lessonId, id))

export const HINTS_OFF_AFTER = 6
