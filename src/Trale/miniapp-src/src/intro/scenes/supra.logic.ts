import { HERO, JOBS, NAMES, pick, shuffle, type GeoName, type Rng } from '../story'
import {
  ABROAD, BATUMI, P, TBILISI, andYou, hello, her, iAmCalled, iAmCountry, iAmFrom, iAmJob, iLiveCity, iLiveIn, no, ok, onlyKnown,
  type Exchange, type Line
} from './chatScripts'

// «Супра» — финал модуля. За длинным столом шесть гостей и тамада. Гости по очереди поворачиваются к тебе —
// у каждого своя тема модуля, 1–2 реплики на короткий таймер. Между гостями тамада поднимает тост:
// поймай момент «поднять бокал» и ответь на тост.

export const SUPRA_LESSON = 33
/** Сколько ждёт гость (мс). */
export const GUEST_MS = 9000
/** Полный ход стрелки тоста (мс): стрелка бежит 0→1 и обратно сначала. */
export const TOAST_LOOP_MS = 2400
/** Зона «сейчас!» на шкале тоста. */
export const TOAST_ZONE: [number, number] = [0.62, 0.86]
/** После стольких промахов бокал поднимается сам — тост не застревает. */
export const TOAST_TRIES = 3

export type Theme = 'hello' | 'name' | 'from' | 'live' | 'job' | 'family'

export interface Guest { name: string; ru: string; theme: Theme; talk: Exchange[] }

export interface Toast { ru: string; opts: ReturnType<typeof ok>[] }

const THEMES: Theme[] = ['hello', 'name', 'from', 'live', 'job', 'family']

export const THEME_RU: Record<Theme, string> = {
  hello: 'приветствие', name: 'имя', from: 'откуда ты', live: 'где живёшь', job: 'работа', family: 'семья и Грузия'
}

function talk(theme: Theme, guest: string, me: GeoName, rng: Rng): Exchange[] {
  const country = pick(ABROAD, rng)
  switch (theme) {
    case 'hello': return [
      { her: [her(hello(me.geo, me.ru))], opts: [ok(P('gagimarjos'), 2), no(P('nakhvamdis'), 'Гостья: «Уже уходишь? Супра только началась!»')] },
      { her: [her(P('rogor'))], opts: [ok(P('kargad_shen'), 2, [her(P('kargad_madloba'))]), ok(P('kargad_madloba'), 1), no(P('ara'), 'Гостья растерялась: «Нет» — не ответ на «как дела».')] }
    ]
    case 'name': return [
      { her: [her(P('ra_gkvia'))], opts: [ok(iAmCalled(me), 2), no(P('ar_vici'), 'Гость хохочет: «Не знаешь, как тебя зовут? Тамада, ему хватит!»')] },
      { her: [her(nameLine(guest))], opts: [ok(P('sasiamovnoa'), 2), no(P('vin_aris'), 'Гость: «Кто это? Это я, только что же сказал!»')] }
    ]
    case 'from': return [
      { her: [her(P('saidan'))], opts: [ok(iAmFrom(country), 2), ...ABROAD.filter(c => c !== country).map(c => ok(iAmFrom(c), 2)), no(iAmCountry(country), `Гость: «Ты целая ${country.ru}?» Не хватает -დან — «из».`)] }
    ]
    case 'live': return [
      { her: [her(P('tbilisshi')), her(andYou())], opts: [ok(iLiveIn(BATUMI), 2), no(iLiveCity(BATUMI), 'Гостья: «Живу Батуми?» Нужно -ში: ბათუმში.'), no(iLiveIn(TBILISI), 'Гостья: «Это я живу в Тбилиси. А ты?»')] }
    ]
    case 'job': {
      // Ты — студент (HERO), это сказано на карточке «Ты» перед супрой.
      const other = pick(JOBS.filter(j => j !== HERO.job), rng)
      return [
        { her: [her(P('ra_profesia'))], opts: [ok(iAmJob(HERO.job), 2), no(iAmJob(other), `Гость: «${other.ru[0].toUpperCase() + other.ru.slice(1)}? Ты же студент, приехал учиться!»`), no(P('vmushaob'), 'Гость: «Работаешь — а кем?» Скажи «я — …».')] }
      ]
    }
    case 'family': return [
      { her: [her(P('myavs_dzma_da')), her(andYou())], opts: [ok(P('myavs_da'), 2), ok(P('myavs_dzaghli'), 1), no(P('makvs_manqana'), 'Бабушка: «Машина — не родня!» Про людей и зверей говорят მყავს.')] },
      { her: [her(P('mogcons'))], opts: [ok(P('miyvars_sakartvelo'), 2), ok(P('lamazia'), 2), no(P('ara'), 'Бабушка ахает. Дай Грузии шанс!')] }
    ]
  }
}

/** «Меня зовут <гость>» — тот же шаблон მე მქვია. */
const nameLine = (geo: string): Line => ({ ...iAmCalled({ geo, base: geo, added: false, ru: NAMES[geo] }) })

export function guests(me: GeoName, rng: Rng = Math.random): Guest[] {
  // Первой — соседка Нино; остальные имена — из словарика, без повторов и без имени самого ученика.
  const rest = shuffle(Object.keys(NAMES).filter(n => n !== 'ნინო' && n !== me.geo), rng)
  const names = ['ნინო', ...rest].slice(0, THEMES.length)
  return THEMES.map((theme, i) => ({
    name: names[i], ru: NAMES[names[i]], theme,
    talk: onlyKnown(talk(theme, names[i], me, rng), SUPRA_LESSON).map(e => ({ ...e, opts: shuffle(e.opts, rng) }))
  }))
}

export const TOASTS: { ru: string; georgia?: boolean }[] = [
  { ru: 'За знакомство!' },
  { ru: 'За соседей и наш двор!' },
  { ru: 'За Грузию!', georgia: true }
]

export function toastOpts(georgia: boolean, rng: Rng = Math.random) {
  const opts = georgia
    ? [ok(P('gaumarjos_sakartvelos'), 2), ok(P('gaumarjos'), 1), no(P('nakhvamdis'), 'Тамада: «Рано уходить, ещё хачапури несут!»')]
    : [ok(P('gaumarjos'), 2), no(P('madloba'), 'Тамада улыбается: спасибо — мило, но на тост отвечают «გაუმარჯოს!» (гаумарджос).'), no(P('nakhvamdis'), 'Тамада: «Рано уходить, ещё хачапури несут!»')]
  return shuffle(opts, rng)
}

/** Порядок вечера: двое гостей — тост, двое — тост, двое — тост за Грузию. */
export type Beat = { kind: 'guest'; g: number } | { kind: 'toast'; t: number }
export const BEATS: Beat[] = [
  { kind: 'guest', g: 0 }, { kind: 'guest', g: 1 }, { kind: 'toast', t: 0 },
  { kind: 'guest', g: 2 }, { kind: 'guest', g: 3 }, { kind: 'toast', t: 1 },
  { kind: 'guest', g: 4 }, { kind: 'guest', g: 5 }, { kind: 'toast', t: 2 }
]

/** Где стрелка тоста через t мс: 0..1. */
export const needle = (t: number) => (Math.max(0, t) % TOAST_LOOP_MS) / TOAST_LOOP_MS

export type Raise = 'early' | 'ok' | 'late'
export function raiseAt(t: number): Raise {
  const p = needle(t)
  return p < TOAST_ZONE[0] ? 'early' : p > TOAST_ZONE[1] ? 'late' : 'ok'
}

export const RAISE_MISS: Record<Exclude<Raise, 'ok'>, string> = {
  early: 'Рано! Тамада ещё говорит — дослушай.',
  late: 'Поздно — все уже выпили. Лови, когда тамада договорит.'
}

/** Тепло гостя: верно с первого раза — 2, после промаха — 1, не дождался — 0. */
export const guestWarmth = (missed: number, timedOut: boolean) => (timedOut ? 0 : missed ? 1 : 2)
