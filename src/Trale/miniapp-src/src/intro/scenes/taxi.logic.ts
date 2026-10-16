import { CITIES, HERO, JOBS, NUMBERS, met, phrase, pick, shuffle, type City, type GeoName, type Rng } from '../story'
import {
  ABROAD, BATUMI, P, her, iAmCalled, iAmCountry, iAmFrom, iAmJob, iLiveCity, iLiveIn, no, note, ok, onlyKnown, toCity,
  type Exchange
} from './chatScripts'

// «Таксист спрашивает»: поездка по Батуми с заднего сиденья. Болтливый таксист расспрашивает по дороге —
// по шагам, без таймеров: спросил, ты ответил, он отреагировал, едем дальше. На перекрёстках навигатор в
// телефоне показывает, куда ехать, — говоришь таксисту მარჯვნივ / მარცხნივ / პირდაპირ, у дома — გააჩერე.
// В уроке 22 в конце спрашиваешь რამდენი ღირს? — и таксист называет цену в лари. За разговор — скидка:
// верно с первого раза — лари, со второго — 50 тетри. В конце — чек.

export type TaxiMode = 'where' | 'work'

/** Что показывает навигатор: поворот, прямо или «приехали — останови». */
export type Nav = 'right' | 'left' | 'straight' | 'stop'

/** Ход поездки: обмен репликами, иногда — с навигатором (nav) или вопросом о цене (price). */
export interface TaxiTurn extends Exchange { nav?: Nav; price?: boolean }

const DIR: Record<Exclude<Nav, 'stop'>, string> = { right: 'marjvniv', left: 'marcxniv', straight: 'pirdapir' }
export const NAV_RU: Record<Nav, string> = { right: 'направо', left: 'налево', straight: 'прямо', stop: 'останови здесь' }

/** Перекрёсток: навигатор показывает поворот — скажи таксисту, куда. */
function navTurn(d: Exclude<Nav, 'stop'>): TaxiTurn {
  const others = (Object.keys(DIR) as Exclude<Nav, 'stop'>[]).filter(x => x !== d)
  return {
    nav: d,
    her: [note('Перекрёсток. Навигатор показывает, куда ехать, — скажи таксисту.')],
    opts: [
      ok(P(DIR[d]), 2, [note(d === 'straight' ? 'Таксист кивает и едет прямо.' : `Таксист кивает и поворачивает ${NAV_RU[d]}.`)]),
      ...others.map(x => no(P(DIR[x]), `Таксист: «${cap(NAV_RU[x])}? Навигатор же показывает ${NAV_RU[d]}!»`))
    ]
  }
}

/** Твой дом: попроси остановить. */
const stopTurn = (): TaxiTurn => ({
  nav: 'stop',
  her: [note('Вот твой дом! Попроси таксиста остановить.')],
  opts: [
    ok(P('gaachere'), 2),
    no(P('pirdapir'), 'Таксист: «Прямо? Так мы проедем мимо твоего дома!»'),
    no(P('nakhvamdis'), 'Таксист: «До свидания? Сначала давай остановимся!»')
  ]
})

/** Приехали: спроси, сколько с тебя. Цену таксист назовёт по счётчику (экран: priceLine). */
const priceTurn = (): TaxiTurn => ({
  price: true,
  her: [note('Приехали! Узнай, сколько с тебя.')],
  opts: [
    ok(P('ramdeni_ghirs'), 2),
    no(P('madloba'), 'Таксист: «Пожалуйста! А платить будем?» Спроси, сколько стоит.'),
    no(P('nakhvamdis'), 'Таксист смеётся: «Эй, а заплатить?»')
  ]
})

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Цена словами: «ხუთი ლარი» — число из словарика и ლარი. Сумма — целые лари от 1 до 10. */
export function priceLine(n: number): { geo: string; ru: string; ids: string[] } {
  const k = Math.max(1, Math.min(10, Math.round(n)))
  return { geo: `${NUMBERS[k - 1].geo} ${phrase('lari').geo}`, ru: `${k} лари`, ids: ['lari'] }
}

/** Таксист называет цену — запись его голосом. */
export const priceAudio = (n: number) => `/audio/intro-story/taxi2/m-lari-${Math.max(1, Math.min(10, Math.round(n)))}.m4a`

/** Что таксист берёт по факту: счётчик минус скидка, вниз до целых лари (в твою пользу), от 1 до 10. */
export const cashFare = (fare: number, discount: number) => Math.max(1, Math.min(10, Math.floor(toPay(fare, discount))))

export function taxiTurns(mode: TaxiMode, dest: City, me: GeoName, lessonId: number, rng: Rng = Math.random): TaxiTurn[] {
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
  const bye: Exchange = { her: mode === 'where' ? [note('Приехали!'), her(P('nakhvamdis'))] : [her(P('nakhvamdis'))], opts: [
    ok(P('nakhvamdis'), 1), ok(P('madloba'), 2),
    no(P('gamarjoba'), 'Таксист: «Здороваться надо было в начале!»')
  ] }
  // Где это уже можно: слова навигатора и цены — слова сцены (уроки 19 и 22).
  const can = (id: string) => met(lessonId, id)
  const known = (e: Exchange): Exchange | null => onlyKnown([e], lessonId)[0] ?? null
  // Урок 19 — три перекрёстка (каждое слово впервые) и остановка у дома. Урок 22 — один поворот наугад
  // (слова уже знакомы) и в конце вопрос о цене.
  const turn = (d: Exclude<Nav, 'stop'>) => (can(DIR[d]) ? navTurn(d) : null)
  const randomTurn = () => turn(pick(['right', 'left', 'straight'] as const, rng))
  const stop = can('gaachere') ? stopTurn() : null
  const price = can('ramdeni_ghirs') ? priceTurn() : null
  const plan: (TaxiTurn | null)[] = mode === 'where'
    ? [known(greet), known(confirm), turn('right'), known(from), turn('left'), known(live), turn('straight'), known(name), stop, known(bye)]
    : [known(greet), known(confirm), known(how), randomTurn(), known(work), known(live), stop, price, known(bye)]
  return plan.filter((e): e is TaxiTurn => !!e).map(e => ({ ...e, opts: shuffle(e.opts, rng) }))
}

// ── Счётчик ───────────────────────────────────────────────────────────────────────────────────────

/** Счётчик: посадка 2 лари + 1 лари за каждый вопрос в пути. */
export const fareAt = (asked: number) => 2 + Math.max(0, asked)

/** Скидка за ответ: сразу — 1 лари, после промаха — 50 тетри. */
export const discountFor = (missed: boolean) => (missed ? 0.5 : 1)

export const lari = (n: number) => `${n.toFixed(n % 1 ? 2 : 0).replace('.', ',')} лари`

/** К оплате: не меньше лари. */
export const toPay = (fare: number, discount: number) => Math.max(1, fare - discount)

// ── Голоса ────────────────────────────────────────────────────────────────────────────────────────
// Реплики, собранные из слов (вопросы таксиста и твои ответы), записаны целиком: public/audio/intro-story/taxi.

const T = '/audio/intro-story/taxi/'
const DRIVER_AUDIO: Record<string, string> = {
  'რა გქვია?': `${T}d-ra_gkvia.m4a`, 'საიდან ხარ?': `${T}d-saidan.m4a`, 'შენ რა პროფესია გაქვს?': `${T}d-ra_profesia.m4a`,
  'თბილისში?': `${T}d-to-tbilisi.m4a`, 'ბათუმში?': `${T}d-to-batumi.m4a`, 'ქუთაისში?': `${T}d-to-kutaisi.m4a`
}
const HERO_AUDIO: Record<string, string> = {
  'მე ვარ ესპანეთიდან': `${T}h-from-es.m4a`, 'მე ვარ საფრანგეთიდან': `${T}h-from-fr.m4a`,
  'ვცხოვრობ ბათუმში': `${T}h-live-batumi.m4a`, 'მე ვარ სტუდენტი': `${T}h-job-student.m4a`
}
export const driverAudio = (geo: string): string | undefined => DRIVER_AUDIO[geo]
export const heroAudio = (geo: string): string | undefined => HERO_AUDIO[geo]
