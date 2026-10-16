import { CITIES, HERO, JOBS, pick, shuffle, type City, type GeoName, type Rng } from '../story'
import {
  ABROAD, BATUMI, P, her, iAmCalled, iAmCountry, iAmFrom, iAmJob, iLiveCity, iLiveIn, no, note, ok, onlyKnown, toCity,
  type Exchange
} from './chatScripts'

// «Таксист спрашивает»: поездка по Батуми с заднего сиденья. Болтливый таксист расспрашивает по дороге —
// по шагам, без таймеров: спросил, ты ответил, он отреагировал, едем дальше. За разговор — скидка: верно с
// первого раза — лари, со второго — 50 тетри. В конце — чек.

export type TaxiMode = 'where' | 'work'

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
