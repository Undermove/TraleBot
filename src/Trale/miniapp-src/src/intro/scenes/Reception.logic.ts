import { COUNTRIES, JOBS, NAMES, NAME_LIST, knows, met, phrase, pick, shuffle, type Country, type Rng, type Word } from '../story'
import { DRINKS, drinksAudio, drinksLine, offerAudio, offerLine, pleaseAudio, pleaseLine, wantAudio, wantLine, type Treat } from './party/Treats'

// «Ресепшн» — чистая логика смены. Ты подрабатываешь администратором маленького гестхауса в Батуми.
// Гости заходят с чемоданами и представляются; на стойке — карточки броней. Найди бронь гостя и выдай
// ему ключ. Отказов нет: заселяются все, вопрос только — в какой номер. Брони похожи (два Карлоса, два
// гостя из Испании), поэтому слушать надо внимательно; не сказал гость сам — спроси.
// Экран — Reception.tsx.

export type ReceptionMode = 'names' | 'listen' | 'ask' | 'full'
export type Field = 'name' | 'country' | 'job'

export const GUESTS = 8

export interface Booking {
  name: string
  country: Country
  job: Word
  room: number
}

export interface Guest {
  /** Как гость себя назовёт (правда — это его бронь). */
  booking: Booking
  /** Карточки на стойке: его бронь и похожие, перемешаны. */
  desk: Booking[]
  /** Что гость говорит сам, с порога. */
  told: Field[]
  /** Кнопки-вопросы (id фраз) — если гость рассказал не всё. */
  asks: string[]
  voice: 'f' | 'm'
  /** Паспорт, напиток, угощение — свой поворот смены. */
  extra: Extra
  look: { coat: string; skin: string; hair: string; extra: 'bag' | 'glasses' | 'cap' | 'none'; kind: 'woman' | 'man' }
}

export function fieldsOf(mode: ReceptionMode): Field[] {
  if (mode === 'names') return ['name']
  if (mode === 'full') return ['name', 'country', 'job']
  return ['name', 'country']
}

const COUNTRY_PHRASE: Record<Country['flag'], string> = { ge: 'sakartvelodan', es: 'espanetidan', fr: 'safrangetidan' }

/** Страны, которые человек уже слышал с -დან к этому уроку. */
export function knownCountries(lessonId: number): Country[] {
  const list = COUNTRIES.filter(c => knows(lessonId, COUNTRY_PHRASE[c.flag]))
  return list.length >= 2 ? list : COUNTRIES.slice(0, 2)
}

/** Вопрос, который открывает поле. */
export const ASK_FOR: Record<Field, string> = { name: 'ra_gkvia', country: 'saidan', job: 'ra_profesia' }
export const askField = (id: string): Field | null => (Object.keys(ASK_FOR) as Field[]).find(f => ASK_FOR[f] === id) ?? null

/** Женские имена — по ним и голос гостя. */
const WOMEN = new Set(['ნინო', 'ანა', 'მარიამი', 'თამარი'])
export const voiceOf = (name: string): 'f' | 'm' => (WOMEN.has(name) ? 'f' : 'm')

function toldFor(mode: ReceptionMode, i: number, lessonId: number, rng: Rng): Field[] {
  const all = fieldsOf(mode)
  const canAsk = (f: Field) => knows(lessonId, ASK_FOR[f])
  if (mode === 'listen') return all
  if (mode === 'names') return i < GUESTS / 2 || !canAsk('name') ? all : []
  if (mode === 'ask') return all.filter(f => !canAsk(f))
  if (i < 2) return all
  const r = rng()
  const told: Field[] = r < 0.3 ? all : r < 0.55 ? ['name', 'country'] : r < 0.8 ? ['name'] : []
  return all.filter(f => told.includes(f) || !canAsk(f))
}

/**
 * Похожие брони: отличаются от брони гостя ровно одним полем — тем, что нужно расслышать.
 * В «именах» — другое имя; дальше — то же имя из другой страны, другое имя из той же, другая профессия.
 */
function lookAlikes(b: Booking, mode: ReceptionMode, countries: Country[], rng: Rng): Omit<Booking, 'room'>[] {
  const otherName = () => pick(NAME_LIST.filter(n => n !== b.name), rng)
  const otherCountry = () => pick(countries.filter(c => c !== b.country), rng)
  if (mode === 'names') return [{ ...b, name: otherName() }, { ...b, name: otherName() }]
  const out: Omit<Booking, 'room'>[] = [{ ...b, country: otherCountry() }, { ...b, name: otherName() }]
  if (mode === 'full') out.push({ ...b, job: pick(JOBS.filter(j => j !== b.job), rng) })
  return out
}

const COATS = ['#1B5FB0', '#E01A3C', '#4E8A5B', '#C68F10', '#7A4E9A', '#D4563B', '#2F7F86']
const SKIN = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D7BC']
const HAIR = ['#2A1F18', '#5A3A22', '#9A6A3A', '#15100A']

/** Смена: восемь гостей; у каждого на стойке — его бронь и две-три похожих. Номера не повторяются. */
export function planShift(lessonId: number, mode: ReceptionMode, rng: Rng = Math.random): Guest[] {
  const countries = knownCountries(lessonId)
  // Четыре этажа по десять номеров — хватает на всех гостей и похожие брони без повторов.
  const rooms = shuffle(Array.from({ length: 4 }, (_, f) => Array.from({ length: 10 }, (_, k) => (f + 1) * 100 + k + 1)).flat(), rng)
  let r = 0
  const asksBase = [...fieldsOf(mode).map(f => ASK_FOR[f]), 'rogor'].filter(id => knows(lessonId, id))
  return Array.from({ length: GUESTS }, (_, i) => {
    const booking: Booking = { name: pick(NAME_LIST, rng), country: pick(countries, rng), job: pick(JOBS, rng), room: rooms[r++] }
    const desk = shuffle([booking, ...lookAlikes(booking, mode, countries, rng).map(b => ({ ...b, room: rooms[r++] }))], rng)
    const told = toldFor(mode, i, lessonId, rng)
    const voice = voiceOf(booking.name)
    const p = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]
    return {
      booking, desk, told,
      asks: told.length < fieldsOf(mode).length ? shuffle(asksBase, rng) : [],
      voice,
      extra: extrasFor(lessonId, i),
      look: { coat: p(COATS), skin: p(SKIN), hair: p(HAIR), extra: p(['bag', 'glasses', 'cap', 'none'] as const), kind: voice === 'f' ? 'woman' : 'man' }
    }
  })
}

/** Ответ гостя про поле — шаблонами из story.json. */
export function answer(g: Guest, f: Field): string {
  if (f === 'name') return `მე მქვია ${g.booking.name}.`
  if (f === 'country') return `მე ვარ ${g.booking.country.from}.`
  return `მე ვარ ${g.booking.job.geo}.`
}

export type Verdict = { ok: true } | { ok: false; hint: string }

/** Та ли карточка: если нет — чем она отличается от гостя (по-русски, с грузинским словом). */
export function judge(g: Guest, card: Booking, heard: Field[]): Verdict {
  const b = g.booking
  if (card === b || card.room === b.room) return { ok: true }
  const ru = NAMES[card.name] ?? card.name
  if (card.name !== b.name) {
    return { ok: false, hint: heard.includes('name') ? `Это бронь ${ru} — ${card.name}. А гость назвал другое имя.` : 'Сначала узнай, как гостя зовут.' }
  }
  if (card.country !== b.country) {
    return { ok: false, hint: heard.includes('country') ? `Тут ${ru} ${card.country.ruFrom}. А гость сказал ${b.country.from}.` : `Две брони на ${ru}. Узнай, откуда гость.` }
  }
  return { ok: false, hint: heard.includes('job') ? `Тут ${ru} — ${card.job.ru}. А гость — ${b.job.ru}.` : `Узнай, кем гость работает: брони отличаются профессией.` }
}

/** Звёзды отзыва: верная карточка с первой попытки — пять звёзд, со второй — четыре. */
export const reviewStars = (misses: number) => Math.max(3, 5 - misses)

export function shiftVerdict(stars: number[]): string {
  const avg = stars.reduce((a, b) => a + b, 0) / Math.max(1, stars.length)
  if (avg >= 4.8) return 'Все заселены в свои номера с первого раза. Хозяйка гестхауса хочет оставить тебя на всё лето.'
  if (avg >= 4.2) return 'Все гости заселены, отзывы отличные. Пару раз пришлось переспросить — так и надо.'
  return 'Все заселены — а с именами и странами уже гораздо увереннее, чем утром.'
}

/**
 * Запись ответа гостя его голосом (public/audio/intro-story/rc: имя — по месту в списке имён,
 * страна — по флагу, профессия — по месту в списке профессий).
 */
export function answerAudio(g: Guest, f: Field): string | undefined {
  const base = '/audio/intro-story/rc/'
  if (f === 'name') { const k = NAME_LIST.indexOf(g.booking.name); return k >= 0 ? `${base}n${k}.m4a` : undefined }
  if (f === 'country') return `${base}c-${g.booking.country.flag}-${g.voice}.m4a`
  const k = JOBS.indexOf(g.booking.job)
  return k >= 0 ? `${base}j${k}-${g.voice}.m4a` : undefined
}

// ── У каждой смены свой поворот ───────────────────────────────────────────────────────────────────
// Ресепшн повторяется в пяти уроках, поэтому смены разные. В уроке 9 появляются паспорт, ключ и комната
// (слова сцены). Дальше гости то просят с дороги воды или чаю, то угощают хачапури, то ты сам предлагаешь
// напитки ночным гостям. Главное в смене по-прежнему — имя и страна; это короткие живые моменты между.

export interface Extra {
  /** Перед бронью спроси паспорт: «პასპორტი, გთხოვთ». */
  passport?: boolean
  /** После ключа: гость просит напиток (ты подаёшь) или ты предлагаешь сам («ჩაი? ყავა? წყალი?»). */
  drink?: { treat: Treat; offer: boolean }
  /** После ключа: гость угощает тем, что привёз. */
  gift?: Treat
}

const PLAN_EXTRAS: Record<number, Record<number, Extra>> = {
  9: { 0: { passport: true }, 3: { passport: true }, 6: { passport: true } },
  12: { 1: { drink: { treat: 'tskali', offer: false } }, 2: { passport: true }, 5: { drink: { treat: 'chai', offer: false } } },
  13: { 2: { gift: 'khachapuri' }, 4: { passport: true }, 6: { drink: { treat: 'qava', offer: false } } },
  15: { 1: { drink: { treat: 'chai', offer: true } }, 3: { gift: 'puri' }, 5: { drink: { treat: 'tskali', offer: true } }, 7: { passport: true } },
  24: { 0: { passport: true }, 2: { drink: { treat: 'qava', offer: false } }, 4: { gift: 'ghvino' }, 6: { drink: { treat: 'chai', offer: true } } }
}

/** Что ещё случится с гостем смены (кроме брони) — только со словами, которые человек уже встречал. */
export function extrasFor(lessonId: number, i: number): Extra {
  const e = PLAN_EXTRAS[lessonId]?.[i] ?? {}
  return {
    ...(e.passport && met(lessonId, 'pasporti') ? { passport: true } : {}),
    ...(e.drink && met(lessonId, e.drink.treat) && met(lessonId, 'minda') ? { drink: e.drink } : {}),
    ...(e.gift && met(lessonId, e.gift) && met(lessonId, 'gemrielia') ? { gift: e.gift } : {})
  }
}

export const SHIFT_INTRO: Record<number, string> = {
  9: 'Новое на смене: попроси у гостя паспорт и выдай ключ от комнаты.',
  12: 'Вечерняя смена: гости устали с дороги и попросят что-нибудь попить.',
  13: 'Утренняя смена: кто-то хочет кофе, а кто-то привёз хачапури на всех.',
  15: 'Ночная смена: гости с позднего рейса — предложи им чай, кофе или воду.',
  24: 'Большой заезд: паспорта, напитки и даже вино в подарок.'
}

export interface ROption { geo: string; ok: boolean; why?: string; treat?: Treat; audio?: string }
export interface RBeat { says: string | null; audio?: string; who: 'guest' | 'you'; word?: string; options: ROption[]; echo?: string }

/** Реплики момента после ключа: просьба, угощение или твоё предложение. */
export function extraBeats(e: Extra, voice: 'f' | 'm', rng: Rng = Math.random): RBeat[] {
  const serve = (t: Treat): RBeat => ({
    says: wantLine(t), audio: wantAudio(t, voice), who: 'guest', word: 'minda', echo: `${phrase('madloba').geo}!`,
    options: shuffle(DRINKS.map(d => ({ geo: phrase(d).geo, treat: d, ok: d === t, why: d === t ? undefined : `Это ${phrase(d).ru}. Гость сказал «${wantLine(t)}».` })), rng)
  })
  if (e.drink && !e.drink.offer) return [serve(e.drink.treat)]
  if (e.drink) return [{
    says: null, who: 'you', options: shuffle([
      { geo: drinksLine(), ok: true, audio: drinksAudio('hero') },
      { geo: `${phrase('nakhvamdis').geo}!`, ok: false, why: 'Гость только заселился. Предложи ему чай, кофе или воду.' }
    ], rng)
  }, serve(e.drink.treat)]
  if (e.gift) return [
    {
      says: offerLine(e.gift), audio: offerAudio(e.gift, voice), who: 'guest', word: e.gift,
      options: shuffle([
        { geo: pleaseLine('ki'), ok: true, audio: pleaseAudio('ki') },
        { geo: phrase('bodishi').geo, ok: false, why: 'Извиняться не за что — тебя угощают. Скажи «да, пожалуйста».' },
        { geo: `${phrase('nakhvamdis').geo}!`, ok: false, why: 'Гость угощает! Скажи «да, пожалуйста».' }
      ], rng)
    },
    {
      says: null, who: 'you', word: 'gemrielia', echo: `${phrase('madloba').geo}!`,
      options: shuffle([
        { geo: phrase('gemrielia').geo, ok: true },
        { geo: phrase('ara').geo, ok: false, why: 'Гость старался! Похвали угощение.' },
        { geo: phrase('bodishi').geo, ok: false, why: 'Вкусно же! Скажи «вкусно!».' }
      ], rng)
    }
  ]
  return []
}
