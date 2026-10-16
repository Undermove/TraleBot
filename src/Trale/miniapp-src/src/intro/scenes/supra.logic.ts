import { HERO, JOBS, NAMES, met, phrase, pick, shuffle, type GeoName, type Rng } from '../story'
import {
  ABROAD, BATUMI, P, TBILISI, andYou, hello, her, iAmCalled, iAmCountry, iAmFrom, iAmJob, iLiveCity, iLiveIn, no, note, ok, onlyKnown,
  type Exchange, type Line
} from './chatScripts'

// «Супра» — финал модуля. За длинным столом шесть гостей и тамада. Гости по очереди поворачиваются к тебе —
// у каждого своя тема модуля, 1–2 реплики. Никто не торопит: гость ждёт сколько нужно. Между гостями
// тамада поднимает тост: подними бокал вместе со всеми и ответь на тост. Ещё за столом угощают: Нино
// предлагает ხინკალი, бабушка — ჩურჩხელა; соглашаешься (კი), пробуешь и хвалишь — გემრიელია!

export const SUPRA_LESSON = 33

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

// ── Угощение ──────────────────────────────────────────────────────────────────────────────────────

export type Dish = 'khinkali' | 'churchkhela'
const DISH_RU: Record<Dish, { what: string; acc: string }> = {
  khinkali: { what: 'Хинкали?', acc: 'хинкали' },
  churchkhela: { what: 'Чурчхелу?', acc: 'чурчхелу' }
}

/** Гость угощает: «ხინკალი?» — ты соглашаешься, пробуешь и хвалишь. Слова сцены урока 33 (и გემრიელია! с урока 10). */
export function offer(dish: Dish, who: string, lessonId = SUPRA_LESSON): Exchange[] {
  if (!met(lessonId, dish)) return []
  const d = DISH_RU[dish]
  const ask: Exchange = {
    her: [her({ geo: `${phrase(dish).geo}?`, ru: d.what, ids: [dish] })],
    opts: [
      ok(P('ki'), 2, [note(`${who} кладёт тебе ${d.acc}. Попробуй!`)]),
      no(P('ara'), `${who}: «Как это нет? Это же ${d.acc}! Хоть попробуй».`),
      no(P('nakhvamdis'), `${who}: «Уходишь? Возьми хотя бы ${d.acc}!»`)
    ]
  }
  if (!met(lessonId, 'gemrielia')) return [ask]
  const taste: Exchange = {
    her: [note(`Ты пробуешь ${d.acc}. Скажи, как тебе!`)],
    opts: [
      ok(P('gemrielia'), 2),
      ok(P('madloba'), 1),
      no(P('bodishi'), `${who}: «За что извиняешься? Скажи лучше, вкусно ли!»`)
    ]
  }
  return [ask, taste]
}

/** Угощение звучит голосом гостя: записи вопросом («ხინკალი?») — public/audio/intro-story/supra2. */
export function dishUrl(geo: string, voice: 'm' | 'f' | 'hero'): string | undefined {
  if (voice === 'hero') return undefined
  const dish = (['khinkali', 'churchkhela'] as Dish[]).find(d => `${phrase(d).geo}?` === geo)
  return dish ? `/audio/intro-story/supra2/${voice}-${dish}.m4a` : undefined
}

/** «Меня зовут <гость>» — тот же шаблон მე მქვია. */
const nameLine = (geo: string): Line => ({ ...iAmCalled({ geo, base: geo, added: false, ru: NAMES[geo] }) })

const WOMEN = new Set(['ნინო', 'ანა', 'მარიამი', 'თამარი'])

export function guests(me: GeoName, rng: Rng = Math.random): Guest[] {
  // Первой — соседка Нино; остальные имена — из словарика, без повторов и без имени самого ученика.
  const rest = shuffle(Object.keys(NAMES).filter(n => n !== 'ნინო' && n !== me.geo), rng)
  const names = ['ნინო', ...rest].slice(0, THEMES.length)
  // Тема «семья» — у бабушки: ей нужно женское имя.
  const fam = THEMES.indexOf('family')
  const woman = names.slice(1).find(n => WOMEN.has(n)) ?? rest.find(n => WOMEN.has(n))
  if (woman && !WOMEN.has(names[fam])) { const k = names.indexOf(woman); if (k > 0) [names[fam], names[k]] = [names[k], names[fam]]; else names[fam] = woman }
  // Угощают двое: первая гостья (Нино) — хинкали, бабушка — чурчхелой.
  const dishOf: Partial<Record<Theme, Dish>> = { hello: 'khinkali', family: 'churchkhela' }
  return THEMES.map((theme, i) => {
    const dish = dishOf[theme]
    const treat = dish ? offer(dish, theme === 'family' ? 'Бабушка' : NAMES[names[i]]) : []
    return {
      name: names[i], ru: NAMES[names[i]], theme,
      talk: [...onlyKnown(talk(theme, names[i], me, rng), SUPRA_LESSON), ...treat].map(e => ({ ...e, opts: shuffle(e.opts, rng) }))
    }
  })
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

/** Тепло гостя: верно с первого раза — 2, после промахов — 1. */
export const guestWarmth = (missed: number) => (missed ? 1 : 2)
