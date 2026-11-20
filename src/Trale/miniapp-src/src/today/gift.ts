import { ApiError, fetchDailyGift } from '../api'

// Подарок дня: коробка в конце задания (и вторая — за ещё один раунд), внутри приз одной из четырёх
// редкостей. Проиграть нельзя — что-то выпадает всегда; серия сдвигает шансы к редким, каждый 7-й день
// серии — минимум эпический. Разыгрывает сервер (DailyGiftService), здесь — показ.

export interface DailyGiftBox {
  /** 0 — за задание дня, 1 — за ещё один раунд. */
  box: number
  ready: boolean
  opened: boolean
  rarity: number | null
  prize: Prize | null
  /** Сколько бесплатных дней дал приз «days». */
  days: number | null
}

/** friend — позвать друга по своей реферальной ссылке; days — бесплатные дни себе (редко, не чаще раза в месяц). */
export type Prize = 'churchkhela' | 'freeze' | 'boost' | 'friend' | 'days'

export interface DailyGiftDto {
  day: string
  /** Серия, за которую подарок: с сегодняшним днём. */
  streak: number
  odds: number[]
  /** Дней до гарантированного эпического (0 — сегодня). */
  guaranteedIn: number
  boxes: DailyGiftBox[]
  freezes: number
  boostToday: boolean
  burnsAtUtc: string
  /** Обычная рефералка: ссылка, сколько дней получит друг и сколько — ты, когда он начнёт заниматься. */
  invite: { link: string; friendDays: number; myDays: number }
}

export const RARITY = [
  { name: 'Обычный', color: '#1B5FB0', ink: '#FDFAEF' },
  { name: 'Редкий', color: '#7B33C2', ink: '#FDFAEF' },
  { name: 'Эпический', color: '#D0173A', ink: '#FDFAEF' },
  { name: 'Легендарный', color: '#E8A70D', ink: '#15100A' }
]

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}
export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

export function prizeText(prize: Prize, gift: DailyGiftDto, box?: DailyGiftBox): { title: string; line: string } {
  switch (prize) {
    case 'churchkhela': return { title: 'Чурчхела для Бомборы', line: 'Любимое лакомство — Бомбора уже уплетает. В лавке она стоит 100 опыта' }
    case 'freeze': return { title: 'Заморозка серии', line: `Пропустишь день — серия не сгорит. Заморозок у тебя: ${gift.freezes}` }
    case 'boost': return { title: '×2 опыта на завтра', line: 'Завтра задание дня и раунды считаются вдвойне' }
    case 'friend': return { title: 'Позови друга', line: `Ему — ${days(gift.invite.friendDays)} бесплатно, тебе — ${gift.invite.myDays === 7 ? 'неделя' : days(gift.invite.myDays)}, когда он начнёт заниматься` }
    case 'days': return { title: `+${days(box?.days ?? 1)} бесплатно`, line: 'Полный доступ ко всему — уже действует' }
  }
}

/** «сгорит через 06:18:36» — до конца дня задания (полночь UTC, как у серии). */
export function burnsIn(burnsAtUtc: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((Date.parse(burnsAtUtc) - now) / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`
}

/** Лесенка редкостей по тапам: каждый тап может поднять — до выпавшей. */
export const ladder = (final: number) => [0, Math.min(1, final), final]

// Кэш, как у задания дня: главная и распаковка видят одно и то же.
let cached: DailyGiftDto | null = null
const listeners = new Set<(g: DailyGiftDto | null) => void>()
export const cachedGift = () => cached
export function setGift(g: DailyGiftDto | null) {
  cached = g
  listeners.forEach(l => l(g))
}
export function onGift(l: (g: DailyGiftDto | null) => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
/** null — подарка дня нет (задание дня пока не всем). */
export async function loadGift(): Promise<DailyGiftDto | null> {
  try {
    setGift(await fetchDailyGift())
  } catch (e) {
    if (e instanceof ApiError && (e.status === 402 || e.status === 404)) setGift(null)
    else throw e
  }
  return cached
}
