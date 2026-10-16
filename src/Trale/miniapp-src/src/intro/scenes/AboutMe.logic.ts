import { CITIES, COUNTRIES, PHRASES, type City, type Country, type GeoName, type Word, JOBS } from '../story'

// «Обо мне» — чистая логика карточки: пять строк, в слоты «откуда» и «где» сначала ставишь слово, потом
// цепляешь магнит. Экран — AboutMe.tsx. Все строки — по проверенным образцам: მე მქვია <имя>, მე ვარ <-დან>,
// ვცხოვრობ <-ში>, მე ვარ <профессия>, მიყვარს <город | საქართველო>.

export type Slot = 'country' | 'city' | 'job' | 'love'
export type Mag = 'ში' | 'დან'

export interface Love { geo: string; ru: string }

const GEORGIA = COUNTRIES.find(c => c.flag === 'ge') ?? COUNTRIES[0]
/** Что можно любить: Грузию или город (винительный по-русски). */
export const LOVES: Love[] = [{ geo: GEORGIA.base, ru: 'Грузию' }, ...CITIES.map(c => ({ geo: c.base, ru: c.ru }))]

export interface Card {
  country: Country | null
  countryOk: boolean
  city: City | null
  cityOk: boolean
  job: Word | null
  love: Love | null
  active: Slot | null
}

export const emptyCard = (): Card => ({ country: null, countryOk: false, city: null, cityOk: false, job: null, love: null, active: 'country' })

export function nextEmpty(c: Card): Slot | null {
  if (!c.countryOk) return 'country'
  if (!c.cityOk) return 'city'
  if (!c.job) return 'job'
  if (!c.love) return 'love'
  return null
}

/** Сколько строк готово (имя — всегда). */
export const filled = (c: Card) => 1 + [c.countryOk, c.cityOk, !!c.job, !!c.love].filter(Boolean).length
export const complete = (c: Card) => filled(c) === 5

export const optionsFor = (slot: Slot): { geo: string; ru: string; value: Country | City | Word | Love }[] =>
  slot === 'country' ? COUNTRIES.map(c => ({ geo: c.base, ru: c.ru, value: c }))
    : slot === 'city' ? CITIES.map(c => ({ geo: c.base, ru: c.ru, value: c }))
      : slot === 'job' ? JOBS.map(j => ({ geo: j.geo, ru: j.ru, value: j }))
        : LOVES.map(l => ({ geo: l.geo, ru: l.ru, value: l }))

/** Поставить слово в слот. Страна и город встают «голыми» — им ещё нужен магнит. */
export function choose(c: Card, slot: Slot, value: Country | City | Word | Love): Card {
  switch (slot) {
    case 'country': return { ...c, country: value as Country, countryOk: false, active: 'country' }
    case 'city': return { ...c, city: value as City, cityOk: false, active: 'city' }
    case 'job': { const n = { ...c, job: value as Word }; return { ...n, active: nextEmpty(n) } }
    case 'love': { const n = { ...c, love: value as Love }; return { ...n, active: nextEmpty(n) } }
  }
}

/** Нужен ли сейчас магнит: в активном слоте стоит слово без окончания. */
export const needsMagnet = (c: Card) =>
  (c.active === 'country' && !!c.country && !c.countryOk) || (c.active === 'city' && !!c.city && !c.cityOk)

export function magnet(c: Card, m: Mag): { card: Card; ok: boolean; tip: string } {
  if (c.active === 'country' && c.country && !c.countryOk) {
    if (m === 'დან') {
      const n = { ...c, countryOk: true }
      return { card: { ...n, active: nextEmpty(n) }, ok: true, tip: `${c.country.base} → ${c.country.from}. «Из», слово целиком.` }
    }
    return { card: c, ok: false, tip: '-ში — «в». А ты рассказываешь, откуда ты: нужно «из».' }
  }
  if (c.active === 'city' && c.city && !c.cityOk) {
    if (m === 'ში') {
      const n = { ...c, cityOk: true }
      return { card: { ...n, active: nextEmpty(n) }, ok: true, tip: `${c.city.base} → ${c.city.in}. ი ушла, ში прилип.` }
    }
    return { card: c, ok: false, tip: '-დან — «из». А ты рассказываешь, где живёшь сейчас: нужно «в».' }
  }
  return { card: c, ok: false, tip: 'Сначала поставь слово в слот.' }
}

export interface Line { geo: string; ru: string; /** id фразы, если такая фраза есть в story.json, — её можно проиграть. */ phrase?: string }

const bare = (s: string) => s.replace(/[.!?…,]/g, '').trim()
const BY_GEO: Record<string, string> = Object.fromEntries(Object.values(PHRASES).map(p => [bare(p.geo), p.id]))

/** Рассказ — пять строк по-грузински и по-русски. Только для готовой карточки. */
export function storyLines(c: Card, me: GeoName): Line[] {
  if (!complete(c)) return []
  const raw: [string, string][] = [
    [`მე მქვია ${me.geo}`, `Меня зовут ${me.ru}.`],
    [`მე ვარ ${c.country!.from}`, `Я ${c.country!.ruFrom}.`],
    [`ვცხოვრობ ${c.city!.in}`, `Живу в ${c.city!.ru}.`],
    [`მე ვარ ${c.job!.geo}`, `Я ${c.job!.ru}.`],
    [`მიყვარს ${c.love!.geo}`, `Люблю ${c.love!.ru}.`]
  ]
  return raw.map(([geo, ru]) => ({ geo: `${geo}.`, ru, phrase: BY_GEO[geo] }))
}

export const STORY_KEY = 'intro_story_card'

export function saveStory(lines: Line[], at = Date.now()) {
  try { localStorage.setItem(STORY_KEY, JSON.stringify({ geo: lines.map(l => l.geo), ru: lines.map(l => l.ru), savedAt: at })) } catch { /* без хранилища — рассказ на один раз */ }
}

export function loadStory(): { geo: string[]; ru: string[]; savedAt: number } | null {
  try { const s = localStorage.getItem(STORY_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
