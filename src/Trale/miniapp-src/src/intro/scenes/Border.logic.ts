import { COUNTRIES, JOBS, NAME_LIST, knows, phrase, pick, shuffle, type Country, type Rng, type Word } from '../story'
import { randomLook, type Look } from '../ui'

// «Паспортный контроль» — чистая логика смены: кто стоит в очереди, что говорит, что в паспорте,
// кто врёт, какие вопросы можно задать, сколько монет за верное решение. Экран — Border.tsx.

export type BorderMode = 'names' | 'listen' | 'ask' | 'full'
export type Field = 'name' | 'country' | 'job'

export const SHIFT = 10

export interface Passport { name: string; country: Country; job: Word }

export interface Traveller {
  look: Look
  /** Что человек скажет о себе (правда). */
  name: string
  country: Country
  job: Word
  /** Что написано в паспорте. */
  pass: Passport
  /** Какое поле в паспорте не совпадает; null — всё честно. */
  lie: Field | null
  /** Что человек говорит сам, ещё до вопросов. */
  told: Field[]
  /** Кнопки-вопросы для этого человека (id фраз) в случайном порядке; пусто — спрашивать нечего. */
  asks: string[]
  purpose: string
}

/** Какие поля сверяем в этом режиме. */
export function fieldsOf(mode: BorderMode): Field[] {
  if (mode === 'names') return ['name']
  if (mode === 'full') return ['name', 'country', 'job']
  return ['name', 'country']
}

const COUNTRY_PHRASE: Record<Country['flag'], string> = { ge: 'sakartvelodan', es: 'espanetidan', fr: 'safrangetidan' }

/** Страны, которые человек уже слышал с -დან к этому уроку (Франция — только с урока 14). */
export function knownCountries(lessonId: number): Country[] {
  const list = COUNTRIES.filter(c => knows(lessonId, COUNTRY_PHRASE[c.flag]))
  return list.length >= 2 ? list : COUNTRIES.slice(0, 2)
}

/** Вопрос, который открывает поле. */
export const ASK_FOR: Record<Field, string> = { name: 'ra_gkvia', country: 'saidan', job: 'ra_profesia' }
/** Вопросы «мимо»: вежливо, но очередь стоит. */
export const WASTE = ['rogor', 'nakhvamdis']

/** Какой вопрос что открывает (или ничего). */
export function askField(id: string): Field | null {
  return (Object.keys(ASK_FOR) as Field[]).find(f => ASK_FOR[f] === id) ?? null
}

function asksFor(mode: BorderMode, lessonId: number): string[] {
  const own = fieldsOf(mode).map(f => ASK_FOR[f])
  const waste = mode === 'names' ? WASTE : ['rogor']
  return [...own, ...waste].filter(id => knows(lessonId, id))
}

/** Что человек рассказывает сам, без вопросов. */
function toldFor(mode: BorderMode, i: number, lessonId: number, rng: Rng): Field[] {
  const all = fieldsOf(mode)
  const canAsk = (f: Field) => knows(lessonId, ASK_FOR[f])
  if (mode === 'listen') return all
  if (mode === 'names') return i < SHIFT / 2 || !canAsk('name') ? all : []
  if (mode === 'ask') return all.filter(f => !canAsk(f))
  // Большая смена: первые двое рассказывают всё, дальше — кто как.
  if (i < 2) return all
  const r = rng()
  const told: Field[] = r < 0.3 ? all : r < 0.55 ? ['name', 'country'] : r < 0.8 ? ['name'] : []
  return all.filter(f => told.includes(f) || !canAsk(f))
}

const PURPOSES = ['туризм', 'в гости', 'работа', 'учёба']

/** План смены: 10 путешественников, примерно каждый третий с чужим паспортом (не первый). */
export function planShift(lessonId: number, mode: BorderMode, rng: Rng = Math.random): Traveller[] {
  const countries = knownCountries(lessonId)
  const fields = fieldsOf(mode)
  const liars = new Set(shuffle(Array.from({ length: SHIFT - 1 }, (_, k) => k + 1), rng).slice(0, rng() < 0.5 ? 3 : 4))
  const asks = asksFor(mode, lessonId)
  return Array.from({ length: SHIFT }, (_, i) => {
    const name = pick(NAME_LIST, rng)
    const country = pick(countries, rng)
    const job = pick(JOBS, rng)
    const told = toldFor(mode, i, lessonId, rng)
    const pass: Passport = { name, country, job }
    let lie: Field | null = null
    if (liars.has(i)) {
      lie = pick(fields, rng)
      if (lie === 'name') pass.name = pick(NAME_LIST.filter(n => n !== name), rng)
      else if (lie === 'country') pass.country = pick(countries.filter(c => c !== country), rng)
      else pass.job = pick(JOBS.filter(j => j !== job), rng)
    }
    return {
      look: randomLook(rng, { bag: rng() < 0.6 }),
      name, country, job, pass, lie, told,
      asks: told.length < fields.length ? shuffle(asks, rng) : [],
      purpose: pick(PURPOSES, rng)
    }
  })
}

/** Ответ человека про одно поле — по шаблонам из story.json. */
export function answer(t: Traveller, f: Field): string {
  if (f === 'name') return `მე მქვია ${t.name}.`
  if (f === 'country') return `მე ვარ ${t.country.from}.`
  return `მე ვარ ${t.job.geo}.`
}

/** Первые слова у окошка. */
export function firstLine(t: Traveller): string[] {
  return [`${phrase('gamarjoba').geo}!`, ...t.told.map(f => answer(t, f))]
}

/** Ответ на вопрос-кнопку: что человек скажет и открыл ли он поле. */
export function reply(t: Traveller, askId: string): { line: string | null; field: Field | null; waste: boolean } {
  const f = askField(askId)
  if (f) return { line: answer(t, f), field: f, waste: false }
  if (askId === 'rogor') return { line: `${phrase('kargad_madloba').geo}.`, field: null, waste: true }
  // «До свидания» человеку, который ещё у окошка, — он не понимает, что происходит.
  return { line: null, field: null, waste: true }
}

/** Верно ли решение: штамп — только если всё совпало. */
export const judge = (t: Traveller, stamp: boolean) => stamp === (t.lie === null)

/** Сколько ждёт человек у окошка, мс: дольше, если надо расспросить. */
export function patience(t: Traveller, mode: BorderMode): number {
  const toAsk = fieldsOf(mode).length - t.told.length
  return 10_000 + toAsk * 4_500 + (mode === 'full' ? 2_000 : 0)
}

/** Пустая болтовня стоит столько терпения. */
export const WASTE_MS = 2_500

/** Монеты за верное решение: 2 ₾, серия от трёх — +1, быстро (меньше половины терпения) — +1. */
export function reward(combo: number, spent: number): number {
  return 2 + (combo >= 3 ? 1 : 0) + (spent < 0.5 ? 1 : 0)
}

export const stars = (right: number) => (right >= 9 ? 3 : right >= 7 ? 2 : right >= 5 ? 1 : 0)

/** Сколько человек видно в очереди: чем дольше стоит текущий, тем длиннее хвост. */
export function queueSize(left: number, spent: number): number {
  return Math.max(0, Math.min(6, Math.min(left, 3) + Math.floor(Math.max(0, Math.min(1, spent)) * 4)))
}

/** Реплика начальника смены на серию. */
export function supervisorLine(combo: number): string | null {
  if (combo === 3) return 'Три подряд без ошибки. Хорошо идёшь!'
  if (combo === 5) return 'Пять подряд! Ещё немного — и на международный терминал.'
  if (combo === 8) return 'Восемь подряд. Я такого давно не видел.'
  return null
}

/** Что не так (для подсказки после решения): поле, что в паспорте, что сказал человек. */
export function mismatch(t: Traveller): { field: Field; pass: string; said: string } | null {
  if (!t.lie) return null
  if (t.lie === 'name') return { field: 'name', pass: t.pass.name, said: t.name }
  if (t.lie === 'country') return { field: 'country', pass: t.pass.country.base, said: t.country.from }
  return { field: 'job', pass: t.pass.job.geo, said: t.job.geo }
}
