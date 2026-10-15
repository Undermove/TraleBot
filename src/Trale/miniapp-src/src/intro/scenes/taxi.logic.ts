import { CITIES, HERO, JOBS, pick, shuffle, type City, type GeoName, type Rng } from '../story'
import {
  ABROAD, BATUMI, P, her, iAmCalled, iAmCountry, iAmFrom, iAmJob, iLiveCity, iLiveIn, no, note, ok, onlyKnown, toCity,
  type Exchange
} from './chatScripts'

// «Таксист спрашивает»: поездка по Батуми. Между поворотами маршрута таксист задаёт вопрос; ответишь —
// машина быстрее доезжает до поворота, и растёт скидка за разговор. Не успел — таксист пожимает плечами,
// едем дальше. Поездка конечна: на последнем повороте — чек.

export type TaxiMode = 'where' | 'work'

/** Сколько едем от поворота до поворота, если молчать (мс). */
export const SEG_MS = 8500
/** Сколько едем до поворота после хорошего ответа (мс). */
export const FAST_MS = 1100

export function taxiTurns(mode: TaxiMode, dest: City, me: GeoName, lessonId: number, rng: Rng = Math.random): Exchange[] {
  const country = pick(ABROAD, rng)
  const otherCity = pick(CITIES.filter(c => c !== dest), rng)
  const greet: Exchange = { her: [her(P('gamarjoba'))], opts: [
    ok(P('gagimarjos'), 2), ok(P('gamarjoba'), 1),
    no(P('nakhvamdis'), 'Таксист: «Уже выходишь? Мы ещё не поехали!»')
  ] }
  const confirm: Exchange = { her: [her(toCity(dest))], opts: [
    ok(P('ki'), 1),
    no(toCity(otherCity), `Таксист: «Так куда — в ${otherCity.ru}? Ты же сказал ${dest.ru}!»`),
    no(P('ara'), 'Таксист тормозит: «Как нет? Ты же сам сказал!»')
  ] }
  const name: Exchange = { her: [her(P('ra_gkvia'))], opts: [
    ok(iAmCalled(me), 2),
    no(P('ra_gkvia'), 'Таксист хохочет: «Я первый спросил!»')
  ] }
  const from: Exchange = { her: [her(P('saidan'))], opts: [
    ...ABROAD.map(c => ok(iAmFrom(c), 2)),
    no(iAmCountry(country), `Таксист: «Ты целая ${country.ru}?» Не хватает -დან — «из».`)
  ] }
  const live: Exchange = { her: [note('Таксист спрашивает, где ты живёшь')], opts: [
    ok(iLiveIn(BATUMI), 2),
    no(iLiveCity(BATUMI), 'Таксист: «Живу Батуми?» Нужно «в»: ბათუმი → ბათუმში.'),
    no(iAmFrom(country), 'Таксист: «Откуда — я понял. А живёшь где?»')
  ] }
  const how: Exchange = { her: [her(P('rogor'))], opts: [
    ok(P('kargad_shen'), 2, [her(P('kargad_madloba'))]),
    ok(P('kargad_madloba'), 1),
    no(P('nakhvamdis'), 'Таксист: «Рано прощаешься, ещё полдороги!»')
  ] }
  // Ты — студент (HERO), это видно на карточке «Ты» перед поездкой.
  const job = HERO.job
  const other = pick(JOBS.filter(j => j !== job), rng)
  const work: Exchange = { her: [her(P('ra_profesia'))], opts: [
    ok(iAmJob(job), 2, [note('Таксист кивает: «Хорошая работа!»')]),
    no(P('vmushaob'), 'Таксист: «Работаешь — молодец. А кем?» Скажи «я — …».'),
    no(iAmJob(other), `Таксист: «${other.ru[0].toUpperCase() + other.ru.slice(1)}? Ты же говорил, что студент!»`)
  ] }
  const bye: Exchange = { her: [note('Приехали!'), her(P('nakhvamdis'))], opts: [
    ok(P('nakhvamdis'), 1), ok(P('madloba'), 2),
    no(P('gamarjoba'), 'Таксист: «Здороваться надо было в начале!»')
  ] }
  const plan = mode === 'where'
    ? [greet, confirm, name, from, live, how, bye]
    : [greet, confirm, how, work, live, from, bye]
  return onlyKnown(plan, lessonId).map(e => ({ ...e, opts: shuffle(e.opts, rng) }))
}

// ── Маршрут ──────────────────────────────────────────────────────────────────────────────────────

export type Pt = [number, number]

/** Маршрут по сетке улиц карты 300×170: n отрезков, поворот на каждом стыке. Начало — у моря слева. */
export function route(n: number, rng: Rng = Math.random): Pt[] {
  const xs = [40, 80, 120, 160, 200, 240, 270]
  const ys = [30, 70, 110, 145]
  const pts: Pt[] = [[xs[0], ys[3]]]
  let xi = 0, yi = 3
  for (let k = 0; k < n; k++) {
    // По очереди: вправо / вверх-вниз, чтобы каждый стык был поворотом.
    if (k % 2 === 0) xi = Math.min(xs.length - 1, xi + 1 + (rng() < 0.3 && xi < xs.length - 2 ? 1 : 0))
    else yi = yi === 0 ? 1 + Math.floor(rng() * 3) : yi === 3 ? Math.floor(rng() * 3) : (rng() < 0.5 ? yi - 1 : yi + 1)
    pts.push([xs[xi], ys[yi]])
  }
  return pts
}

/** Где машина на маршруте: pos — сколько отрезков проехали (дробно). */
export function pointAt(pts: Pt[], pos: number): { x: number; y: number; angle: number } {
  const n = pts.length - 1
  const p = Math.max(0, Math.min(n, pos))
  const k = Math.min(n - 1, Math.floor(p))
  const f = p - k
  const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, angle: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI }
}

/** Счётчик: посадка 2 лари + 1 лари за отрезок, по 50 тетри. */
export const fareAt = (pos: number) => Math.round((2 + Math.max(0, pos)) * 2) / 2

/** Скидка за ответ: сразу — 1 лари, после промаха — 50 тетри. */
export const discountFor = (missed: boolean) => (missed ? 0.5 : 1)

/** Сдвиг машины за dt мс: медленно, пока молчишь, быстро — после ответа. Не дальше конца текущего отрезка, пока не ответил. */
export function advance(pos: number, dt: number, answered: boolean, total: number): number {
  const next = pos + dt / (answered ? FAST_MS : SEG_MS)
  return Math.min(total, next)
}

export const lari = (n: number) => `${n.toFixed(n % 1 ? 2 : 0).replace('.', ',')} лари`

// ── Ход поездки (чистая функция для тика) ─────────────────────────────────────────────────────────

export interface Ride {
  /** Сколько отрезков проехали, дробно. */
  pos: number
  /** Ответил ли на вопрос отрезка. */
  answered: boolean[]
  /** Промахнулся ли на вопросе отрезка. */
  missed: boolean[]
  /** Сколько вопросов прошло молча. */
  silent: number
  discount: number
  /** Реакция таксиста на промах или молчание. */
  note: string | null
}

export const newRide = (n: number): Ride => ({ pos: 0, answered: Array(n).fill(false), missed: Array(n).fill(false), silent: 0, discount: 0, note: null })

export const segOf = (r: Ride, n: number) => Math.min(n - 1, Math.floor(r.pos))

/** Тик: машина едет; на стыке без ответа таксист пожимает плечами, и начинается следующий вопрос. */
export function tickRide(r: Ride, dt: number, n: number): Ride {
  if (r.pos >= n) return r
  const k = segOf(r, n)
  const pos = advance(r.pos, dt, r.answered[k], n)
  if (Math.floor(pos) > k) {
    const silent = !r.answered[k]
    return {
      ...r,
      pos: k + 1,
      silent: r.silent + (silent ? 1 : 0),
      note: silent ? 'Таксист пожал плечами: «Ладно, помолчим». Едем дальше.' : null
    }
  }
  return { ...r, pos }
}

/** Ответ на вопрос текущего отрезка. */
export function answerRide(r: Ride, n: number, good: boolean, miss?: string): Ride {
  const k = segOf(r, n)
  if (r.answered[k]) return r
  if (!good) {
    const missed = [...r.missed]; missed[k] = true
    return { ...r, missed, note: miss ?? null }
  }
  const answered = [...r.answered]; answered[k] = true
  return { ...r, answered, discount: r.discount + discountFor(r.missed[k]), note: null }
}

export const rideOver = (r: Ride, n: number) => r.pos >= n
