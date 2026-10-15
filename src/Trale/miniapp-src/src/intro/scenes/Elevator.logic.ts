import { knows, phrase, pick, shuffle, type Rng } from '../story'
import { randomLook, type Look } from '../ui'

// «Лифт» — чистая логика. Ты живёшь на последнем, 12-м этаже. Каждая поездка — с одним соседом от первого
// этажа до его этажа: счётчик щёлкает, двери откроются на его этаже — это и есть время на светскую беседу.
// Поездка — 1–3 реплики соседа или ситуации; ты отвечаешь кнопкой-репликой.

export type ElevMode = 'howareyou' | 'echo' | 'polite' | 'mix'
/** greet — сосед здоровается; rogor — спрашивает, как дела; door/foot/button/thanks — вежливые ситуации. */
export type ExKind = 'greet' | 'rogor' | 'door' | 'foot' | 'button' | 'thanks'

export interface Ex {
  kind: ExKind
  /** Что говорит сосед (id фразы). */
  line?: string
  /** Ситуация словами, по-русски. */
  say?: string
  /** Кнопки-реплики (id фраз), уже перемешаны. */
  options: string[]
  /** Для кнопки лифта: горит ли уже твоя 12. */
  pressed?: boolean
}

export interface Ride {
  /** Этаж соседа: тут двери и откроются. */
  floor: number
  look: Look
  ex: Ex[]
  /** Сколько мс на этаж. */
  tickMs: number
  /** Лифт битком (для ситуации с ногой). */
  crowd: boolean
}

export const FLOORS = 12
export const MY_FLOOR = 12
export const RIDES = 7
/** Сколько времени закладываем на одну реплику. */
export const EX_MS = 4200
export const BOARD_MS = 900
/** Когда всё сказано, лифт доезжает быстро. */
export const FAST_TICK_MS = 260

export type Result = 'right' | 'bonus' | 'soft' | 'miss'
export interface Verdict { res: Result; hint: string; /** Что сосед отвечает (id фразы). */ react?: string }

const g = (id: string) => phrase(id).geo
const known = (lessonId: number, ids: string[]) => ids.filter(id => knows(lessonId, id))

/** Как правильно ответить на приветствие соседа. */
/** Время суток поездки — по тому, как сосед здоровается (показываем на табло лифта). */
export function rideTime(ride: Ride): 'morning' | 'day' | 'evening' {
  const line = ride.ex.find(e => e.kind === 'greet')?.line
  return line === 'dila' ? 'morning' : line === 'saghamo' ? 'evening' : 'day'
}

export function greetAnswer(lessonId: number, line: string): string {
  return line === 'gamarjoba' && knows(lessonId, 'gagimarjos') ? 'gagimarjos' : line
}

export function judgeEx(lessonId: number, mode: ElevMode, ex: Ex, id: string): Verdict {
  switch (ex.kind) {
    case 'greet': {
      const line = ex.line ?? 'gamarjoba'
      const want = greetAnswer(lessonId, line)
      if (id === want) return { res: 'right', hint: '' }
      if (id === 'gamarjoba') {
        return line === 'gamarjoba'
          ? { res: 'soft', hint: `Годится. Но на ${g('gamarjoba')} отвечают ${g('gagimarjos')} — «и тебе».` }
          : { res: 'soft', hint: `Годится в любое время. Но сосед сказал ${g(line)} — ответь тем же.` }
      }
      if (id === 'nakhvamdis') return { res: 'miss', hint: 'Вы только вошли в лифт, а ты уже прощаешься.' }
      if (id === 'kargad_madloba' || id === 'kargad_shen') return { res: 'miss', hint: 'Сосед ещё не спрашивал, как дела. Сначала поздоровайся.' }
      if (id === 'dila' || id === 'saghamo') return { res: 'miss', hint: `Сосед сказал ${g(line)} — ответь тем же. Время суток видно на табло.` }
      return { res: 'miss', hint: 'Сосед поздоровался — ответь на приветствие.' }
    }
    case 'rogor': {
      if (id === 'kargad_shen') return { res: 'bonus', hint: 'Спросил в ответ — сосед доволен.', react: 'kargad_madloba' }
      if (id === 'kargad_madloba') {
        return mode === 'howareyou' || !knows(lessonId, 'kargad_shen')
          ? { res: 'right', hint: '' }
          : { res: 'soft', hint: `Сосед ждёт, что ты спросишь в ответ: ${g('kargad_shen')}` }
      }
      if (id === 'gamarjoba' || id === 'gagimarjos' || id === 'dila' || id === 'saghamo') return { res: 'miss', hint: 'Вы уже поздоровались. Сосед спросил, как дела.' }
      if (id === 'nakhvamdis') return { res: 'miss', hint: 'Рано прощаться — сосед спросил, как дела.' }
      return { res: 'miss', hint: `Сосед спросил, как дела. Ответь: ${g('kargad_madloba')}.` }
    }
    case 'door':
    case 'thanks':
      if (id === 'madloba') return { res: 'right', hint: '' }
      if (id === 'bodishi') return { res: 'miss', hint: 'Ты ничего плохого не сделал. Сосед помог — скажи спасибо.' }
      return { res: 'miss', hint: 'Сосед сделал тебе приятное — скажи спасибо.' }
    case 'foot':
      if (id === 'bodishi') return { res: 'right', hint: '' }
      if (id === 'madloba') return { res: 'miss', hint: 'За отдавленную ногу не благодарят. Тут нужно «извините».' }
      return { res: 'miss', hint: 'Ты наступил соседу на ногу — извинись.' }
    case 'button': {
      const want = ex.pressed ? 'ara' : 'ki'
      if (id === want) return { res: 'right', hint: '' }
      return ex.pressed
        ? { res: 'miss', hint: `Посмотри на кнопки: твоя ${MY_FLOOR} уже горит. Значит, ${g('ara')} — нет, спасибо.` }
        : { res: 'miss', hint: `Твоя ${MY_FLOOR} не горит. Скажи ${g('ki')} — и сосед нажмёт.` }
    }
  }
}

/** Верный (лучший) ответ — для подсказки после двух промахов. */
export function bestAnswer(lessonId: number, ex: Ex): string {
  switch (ex.kind) {
    case 'greet': return greetAnswer(lessonId, ex.line ?? 'gamarjoba')
    case 'rogor': return knows(lessonId, 'kargad_shen') ? 'kargad_shen' : 'kargad_madloba'
    case 'door': case 'thanks': return 'madloba'
    case 'foot': return 'bodishi'
    case 'button': return ex.pressed ? 'ara' : 'ki'
  }
}

/** Три кнопки: верная, «почти» и мимо — только из того, что человек уже знает. */
function options(lessonId: number, ex: Omit<Ex, 'options'>, rng: Rng): string[] {
  let ids: string[]
  switch (ex.kind) {
    case 'greet': {
      const want = greetAnswer(lessonId, ex.line ?? 'gamarjoba')
      // Отвечают тем же приветствием. Утреннее и вечернее среди вариантов — только когда сосед сказал
      // именно его (тогда გამარჯობა — «почти»); на გამარჯობა других приветствий в кнопках нет.
      const near = want === 'dila' || want === 'saghamo' ? 'gamarjoba'
        : want === 'gagimarjos' ? 'gamarjoba'
        : pick(known(lessonId, ['kargad_madloba', 'nakhvamdis']), rng) ?? 'nakhvamdis'
      const far = pick(known(lessonId, ['nakhvamdis', 'kargad_madloba']).filter(x => x !== near), rng)
      ids = [want, near, far]
      break
    }
    case 'rogor':
      ids = knows(lessonId, 'kargad_shen') ? ['kargad_shen', 'kargad_madloba', 'nakhvamdis'] : ['kargad_madloba', 'gamarjoba', 'nakhvamdis']
      break
    case 'door': case 'thanks': ids = ['madloba', 'bodishi', 'ara']; break
    case 'foot': ids = ['bodishi', 'madloba', 'ki']; break
    case 'button': ids = ['ki', 'ara', 'madloba']; break
  }
  return shuffle([...new Set(ids.filter(Boolean))].filter(id => knows(lessonId, id)), rng)
}

const SITUATION: Record<'door' | 'foot' | 'button' | 'thanks', string> = {
  door: 'Сосед придержал тебе дверь лифта.',
  foot: 'Лифт битком. Ты нечаянно наступил соседу на ногу.',
  button: `Сосед показывает на кнопки: нажать тебе ${MY_FLOOR}?`,
  thanks: `Сосед нажал тебе ${MY_FLOOR}.`
}

type Plan = 'talk' | 'door' | 'foot' | 'button' | 'hello'

function greetLine(lessonId: number, mode: ElevMode, rng: Rng): string {
  const pool = known(lessonId, mode === 'mix' ? ['gamarjoba', 'gamarjoba', 'dila', 'saghamo'] : ['gamarjoba', 'dila', 'saghamo'])
  return pick(pool.length ? pool : ['gamarjoba'], rng)
}

function rideKinds(lessonId: number, mode: ElevMode, plan: Plan, rng: Rng): Omit<Ex, 'options'>[] {
  const greet = (): Omit<Ex, 'options'> => ({ kind: 'greet', line: greetLine(lessonId, mode, rng) })
  const sit = (k: 'door' | 'foot' | 'button' | 'thanks', pressed?: boolean): Omit<Ex, 'options'> => ({ kind: k, say: SITUATION[k], pressed })
  switch (plan) {
    case 'hello': return [greet()]
    case 'talk': return [greet(), { kind: 'rogor', line: 'rogor' }]
    case 'door': return [sit('door'), greet()]
    case 'foot': return [greet(), sit('foot')]
    case 'button': {
      const pressed = rng() < 0.4
      // Сказал «да» — сосед нажал, и за это — спасибо.
      return pressed ? [greet(), sit('button', true)] : [greet(), sit('button', false), sit('thanks')]
    }
  }
}

function plans(lessonId: number, mode: ElevMode, rng: Rng): Plan[] {
  const polite = knows(lessonId, 'madloba') && knows(lessonId, 'bodishi') && knows(lessonId, 'ki') && knows(lessonId, 'ara')
  const talk = knows(lessonId, 'rogor') && knows(lessonId, 'kargad_madloba')
  if ((mode === 'polite' || mode === 'mix') && polite) {
    const list: Plan[] = mode === 'polite'
      ? ['door', 'foot', 'button', 'button', 'door', 'foot', 'button']
      : ['talk', 'talk', 'talk', 'door', 'foot', 'button', 'button']
    return shuffle(list, rng)
  }
  return Array.from({ length: RIDES }, () => (talk ? 'talk' : 'hello'))
}

/**
 * Поездки игры: 7 соседей с разных этажей. Этаж подбираем под длину разговора — чтобы на него хватало
 * времени примерно по секунде на этаж; первая поездка медленнее, пока человек осваивается.
 */
export function planRides(lessonId: number, mode: ElevMode, rng: Rng): Ride[] {
  const free = Array.from({ length: FLOORS - 3 }, (_, i) => i + 3) // 3..11
  return plans(lessonId, mode, rng).map((plan, i) => {
    const ex = rideKinds(lessonId, mode, plan, rng).map(e => ({ ...e, options: options(lessonId, e, rng) }))
    const budget = (BOARD_MS + ex.length * EX_MS) * (i === 0 ? 1.6 : 1)
    const target = 1 + budget / 1300
    const near = [...free].sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 3)
    const floor = pick(near, rng)
    free.splice(free.indexOf(floor), 1)
    const tickMs = Math.round(Math.max(800, Math.min(2400, budget / (floor - 1))))
    const look = randomLook(rng, { bag: rng() < 0.4, age: rng() < 0.2 ? 'old' : 'adult' })
    return { floor, look, ex, tickMs, crowd: plan === 'foot' }
  })
}

/**
 * На каком этаже лифт через elapsed мс после того, как закрылись двери. Если всё уже сказано (doneAt),
 * дальше едет быстро. Не выше этажа соседа.
 */
export function floorAt(ride: Ride, elapsed: number, doneAt?: number): number {
  const slow = (ms: number) => 1 + Math.max(0, ms) / ride.tickMs
  const f = doneAt === undefined || elapsed <= doneAt ? slow(elapsed) : slow(doneAt) + (elapsed - doneAt) / FAST_TICK_MS
  return Math.min(ride.floor, Math.floor(f))
}

/** Очки симпатии за поездку: верный ответ — 1, «спросил в ответ» — 2, договорили до дверей — ещё 1. */
export function ridePoints(results: Result[], total: number): number {
  const talk = results.reduce((n, r) => n + (r === 'bonus' ? 2 : r === 'right' || r === 'soft' ? 1 : 0), 0)
  return talk + (results.length >= total ? 1 : 0)
}

/** Максимум очков за игру — для полоски «соседи тебя любят». */
export function maxPoints(lessonId: number, rides: Ride[]): number {
  return rides.reduce((n, r) => n + 1 + r.ex.reduce((m, e) => m + (e.kind === 'rogor' && knows(lessonId, 'kargad_shen') ? 2 : 1), 0), 0)
}

export function elevatorVerdict(remembered: number, total: number): string {
  if (remembered >= total - 1) return 'Весь подъезд тебя знает. Теперь в лифте не молчат — с тобой здороваются.'
  if (remembered >= Math.ceil(total / 2)) return 'Половина подъезда уже здоровается с тобой первой. Ещё пара поездок — и все.'
  return 'Соседи пока присматриваются. Лифт ходит каждый день — попробуй ещё.'
}

// ── Ход игры ─────────────────────────────────────────────────────────────────────────────────────

export type Stage = 'board' | 'ride' | 'doors'
export const REACT_MS = 800
export const DOORS_MS = 1900
export const HINTS_OFF_AFTER = 6

export interface ElevState {
  lessonId: number
  mode: ElevMode
  rides: Ride[]
  /** Номер поездки. */
  ri: number
  stage: Stage
  /** Когда началась стадия (мс игры). */
  at: number
  t: number
  /** Номер реплики в поездке. */
  exI: number
  /** Сосед реагирует на ответ (id фразы или просто улыбка) до момента until. */
  react: { line?: string; until: number } | null
  /** Принятые ответы этой поездки. */
  results: Result[]
  exMisses: number
  /** Когда (от старта поездки) всё было сказано. */
  doneAt?: number
  likes: number
  max: number
  correct: number
  hints: boolean
  tip: string
  mood: 'smile' | 'sad' | 'huh' | 'wow'
  /** Этажи, где сосед тебя запомнил. */
  remembered: number[]
  over: boolean
}

export function elevStart(lessonId: number, mode: ElevMode, rides: Ride[]): ElevState {
  return {
    lessonId, mode, rides, ri: 0, stage: 'board', at: 0, t: 0, exI: 0, react: null, results: [], exMisses: 0,
    likes: 0, max: maxPoints(lessonId, rides), correct: 0, hints: true, mood: 'smile', remembered: [], over: false,
    tip: 'Договори, пока лифт едет: на этаже соседа двери откроются.'
  }
}

export const currentRide = (s: ElevState): Ride => s.rides[Math.min(s.ri, s.rides.length - 1)]
/** Реплика, на которую сейчас надо ответить (во время реакции соседа — нет). */
export const currentEx = (s: ElevState): Ex | null => {
  const r = currentRide(s)
  return !s.over && s.stage !== 'doors' && !s.react && s.exI < r.ex.length ? r.ex[s.exI] : null
}
export function currentFloor(s: ElevState): number {
  const r = currentRide(s)
  if (s.stage === 'board') return 1
  if (s.stage === 'doors') return r.floor
  return floorAt(r, s.t - s.at, s.doneAt)
}

export function elevTick(s: ElevState, t: number): ElevState {
  if (s.over) return s
  let n: ElevState = { ...s, t }
  if (n.react && t >= n.react.until) n.react = null
  const r = currentRide(n)
  if (n.stage === 'board' && t - n.at >= BOARD_MS) n = { ...n, stage: 'ride', at: t }
  else if (n.stage === 'ride' && floorAt(r, t - n.at, n.doneAt) >= r.floor) {
    const all = n.results.length >= r.ex.length
    n = {
      ...n, stage: 'doors', at: t, react: null,
      likes: n.likes + ridePoints(n.results, r.ex.length),
      remembered: all ? [...n.remembered, r.floor] : n.remembered,
      mood: all ? 'smile' : 'sad',
      tip: all ? `Этаж ${r.floor}: + сосед запомнил тебя.` : `Этаж ${r.floor}: двери открылись — сосед вышел, не договорив.`
    }
  } else if (n.stage === 'doors' && t - n.at >= DOORS_MS) {
    if (n.ri + 1 >= n.rides.length) return { ...n, over: true }
    n = { ...n, ri: n.ri + 1, stage: 'board', at: t, exI: 0, results: [], exMisses: 0, doneAt: undefined, mood: 'smile', react: null }
  }
  return n
}

export function elevAnswer(s: ElevState, id: string): { s: ElevState; verdict: Verdict | null } {
  const ex = currentEx(s)
  if (!ex) return { s, verdict: null }
  const verdict = judgeEx(s.lessonId, s.mode, ex, id)
  if (verdict.res === 'miss') {
    const exMisses = s.exMisses + 1
    const tip = exMisses >= 2 ? `${verdict.hint} Нажми ${g(bestAnswer(s.lessonId, ex))}.` : verdict.hint
    return { s: { ...s, exMisses, tip, mood: 'huh' }, verdict }
  }
  const r = currentRide(s)
  const exI = s.exI + 1
  const correct = s.correct + 1
  const hintsOff = s.hints && correct >= HINTS_OFF_AFTER
  const done = exI >= r.ex.length
  const tip = hintsOff ? 'Подсказки под кнопками убраны — дальше сам.' : verdict.hint || (done ? 'Всё сказано — едем без пауз.' : '')
  return {
    s: {
      ...s, exI, correct, hints: s.hints && !hintsOff, tip, exMisses: 0,
      results: [...s.results, verdict.res],
      react: { line: verdict.react, until: s.t + REACT_MS },
      mood: verdict.res === 'bonus' ? 'wow' : verdict.res === 'soft' ? 'huh' : 'smile',
      doneAt: done ? (s.stage === 'ride' ? s.t - s.at : 0) : s.doneAt
    },
    verdict
  }
}
