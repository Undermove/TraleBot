import story from './story.json'
import { transliterateToGeorgian } from '../utils/georgianizerName'

// Модуль «Знакомство» — одна история в шести актах (story.json). Урок — цепочка сцен: новая фраза, находка
// правила, игра урока; потом короткая проверка вопросами урока с сервера. Прогресс считается как у остальных
// модулей: completeLesson с correct/total проверки, урок засчитан только без ошибок.

export const INTRO_MODULE = 'intro'

export interface Phrase {
  id: string
  geo: string
  ru: string
  /** Где эта фраза есть в проверенном содержании (урок TraleBot или страница Викисловаря). */
  src: string
  /** Разбор фразы по словам: [грузинское слово, перевод]. */
  words?: [string, string][]
}

export type RuleId = 'time' | 'echo' | 'name' | 'from' | 'in' | 'da' | 'have'

export type IntroStep =
  | { kind: 'phrase' }
  | { kind: 'rule'; rule: RuleId }
  | { kind: 'yard'; mode: 'hello' | 'day' | 'full' }
  | { kind: 'elevator'; mode: 'howareyou' | 'echo' | 'polite' | 'mix' }
  | { kind: 'party'; mode: 'names' | 'full' | 'who' | 'jobs' }
  | { kind: 'magnets'; set: 'name' | 'from' | 'in' | 'both' }
  | { kind: 'border'; mode: 'names' | 'listen' | 'ask' | 'full' }
  | { kind: 'detective'; mode: 'from' | 'jobs' }
  | { kind: 'chat'; script: 'act2' | 'act3' | 'act4' | 'act6' }
  | { kind: 'taxi'; mode: 'where' | 'work' }
  | { kind: 'family'; mode: 'parents' | 'siblings' | 'full' | 'album' }
  | { kind: 'havesort'; mode: 'people' | 'full' }
  | { kind: 'aboutme' }
  | { kind: 'supra' }

export type StepKindName = IntroStep['kind']

export interface IntroLesson {
  id: number
  act: number
  title: string
  goal: string
  /** Новые фразы урока (id из phrases). */
  new: string[]
  steps: IntroStep[]
}

export interface Act { id: number; title: string; story: string }

export const PHRASES: Record<string, Phrase> = Object.fromEntries(
  Object.entries(story.phrases as unknown as Record<string, Omit<Phrase, "id">>).map(([id, p]) => [id, { id, ...p }])
)
export const ACTS: Act[] = story.acts
export const INTRO_LESSONS: IntroLesson[] = story.lessons as IntroLesson[]
export const INTRO_TOTAL = INTRO_LESSONS.length

export function introLesson(id: number): IntroLesson {
  return INTRO_LESSONS.find(l => l.id === id) ?? INTRO_LESSONS[0]
}

export function actOf(lesson: IntroLesson): Act {
  return ACTS.find(a => a.id === lesson.act) ?? ACTS[0]
}

/** Фраза по id; неизвестный id — ошибка в story.json, её ловит тест. */
export function phrase(id: string): Phrase {
  const p = PHRASES[id]
  if (!p) throw new Error(`intro: unknown phrase ${id}`)
  return p
}

/** Новые фразы урока. */
export const newPhrases = (lesson: IntroLesson): Phrase[] => lesson.new.map(phrase)

/** Всё, что человек уже встретил к концу этого урока (включая его новые фразы). */
export function knownPhrases(lessonId: number): Phrase[] {
  return INTRO_LESSONS.filter(l => l.id <= lessonId).flatMap(l => l.new).map(phrase)
}

export const knows = (lessonId: number, id: string) => INTRO_LESSONS.some(l => l.id <= lessonId && l.new.includes(id))

/** Сколько вопросов в проверке в конце урока. */
export const EXAM_SIZE = 5

/** Проверка урока — последние вопросы файла урока (генератор кладёт их туда). */
export function introExam<T>(questions: T[]): T[] {
  return questions.slice(-EXAM_SIZE)
}

// ── Имя ученика по-грузински ───────────────────────────────────────────────────────────────────────
// Берём имя из Telegram (или то, что человек ввёл сам) и пишем грузинскими буквами — теми, что он выучил
// в алфавите. Иностранное имя на согласную грузины договаривают гласной ი: Карлос → კარლოსი
// (MiniAppContentProvider.cs, Знакомство: «მე მქვია კარლოსი»).

const NAME_KEY = 'intro_name'
const VOWELS = '\u10D0\u10D4\u10D8\u10DD\u10E3' // гласные: a, e, i, o, u

export interface GeoName {
  /** Как имя звучит в «მე მქვია …». */
  geo: string
  /** Буквы как есть, до правила ი. */
  base: string
  /** Добавили ли ი. */
  added: boolean
  /** Имя по-русски (или как в Telegram). */
  ru: string
}

export function geoName(raw: string): GeoName {
  const ru = raw.trim() || 'Нино'
  const t = transliterateToGeorgian(ru)
  const base = (t?.geo ?? 'ნინო').replace(/[\s-]+/g, '')
  const added = !VOWELS.includes(base.slice(-1))
  return { geo: added ? base + 'ი' : base, base, added, ru }
}

export function telegramFirstName(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name as string | undefined
  } catch { return undefined }
}

export function savedName(): string {
  try { return localStorage.getItem(NAME_KEY) || telegramFirstName() || '' } catch { return telegramFirstName() || '' }
}

export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name) } catch { /* без хранилища — имя на один урок */ }
}

export const myName = (): GeoName => geoName(savedName())

// ── Мелочи для игр ────────────────────────────────────────────────────────────────────────────────

export type Rng = () => number
export const pick = <T,>(a: readonly T[], rng: Rng = Math.random): T => a[Math.floor(rng() * a.length)]
export function shuffle<T>(a: readonly T[], rng: Rng = Math.random): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

/** Русское склонение: 1 улыбка, 2 улыбки, 5 улыбок. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// ── Словарик для игр (story.json → vocab): имена, страны, города, люди и вещи — каждое с источником ──────

export interface Country { base: string; from: string; ru: string; ruFrom: string; flag: 'ge' | 'es' | 'fr'; src: string }
export interface City { base: string; in: string; ru: string; src: string }
export interface Word { geo: string; ru: string; src: string }

const V = story.vocab as unknown as {
  names: Record<string, string>
  countries: Country[]; cities: City[]; jobs: Word[]; alive: Word[]; things: Word[]; people: Word[]; small: Word[]
}
/** Грузинские имена → как по-русски. */
export const NAMES: Record<string, string> = Object.fromEntries(Object.entries(V.names).filter(([k]) => !k.startsWith('_')))
export const NAME_LIST = Object.keys(NAMES)
export const COUNTRIES: Country[] = V.countries
export const CITIES: City[] = V.cities
export const JOBS: Word[] = V.jobs
/** Живое (люди, животные) — с ними «у меня есть» — მყავს. */
export const ALIVE: Word[] = V.alive
/** Вещи — с ними მაქვს. */
export const THINGS: Word[] = V.things
export const PEOPLE: Word[] = V.people
export const SMALL: Word[] = V.small
