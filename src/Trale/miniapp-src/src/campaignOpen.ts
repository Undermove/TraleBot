import { reportCampaignOpen, type CampaignGiftDto } from './api'

// Кнопка в рассылке владельца открывает мини-апп с ?c=<имя кампании>. Сообщаем об этом серверу
// один раз за запуск — так считается, сколько людей открыли мини-апп по рассылке, и в этот же
// момент сервер выдаёт подарок кампании (дни доступа), если он есть.
// Ошибка здесь не должна мешать запуску, поэтому всё проглатывается.

export function campaignKeyFromUrl(search: string): string | null {
  const key = new URLSearchParams(search).get('c')
  return key && /^[a-z0-9][a-z0-9_-]{2,47}$/.test(key) ? key : null
}

/** Сколько ждём ответа, прежде чем грузить профиль без него: запуск не должен зависеть от этой отметки. */
const WAIT_MS = 2500

let settled: Promise<void> = Promise.resolve()
let gift: CampaignGiftDto | null = null

export function reportCampaignOpenFromUrl(search: string = window.location.search) {
  try {
    const key = campaignKeyFromUrl(search)
    if (!key) return
    const report = reportCampaignOpen(key).then(r => { gift = r.gift ?? null }).catch(() => {})
    settled = Promise.race([report, new Promise<void>(resolve => setTimeout(resolve, WAIT_MS))])
  } catch {}
}

/**
 * Отметка об открытии по рассылке дошла (или её не было). Профиль грузим после неё: подарок
 * открывает доступ, и первый же экран должен это знать.
 */
export const campaignOpenSettled = () => settled

/** Подарок, выданный в этот запуск; отдаётся один раз — раздел показывает о нём одну строку. */
export function takeCampaignGift(): CampaignGiftDto | null {
  const taken = gift
  gift = null
  return taken
}

/** «до 10 октября» — по часам человека. */
export function giftUntilText(dto: CampaignGiftDto): string {
  return new Date(dto.accessUntilUtc).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function pluralDays(n: number): string {
  const mod100 = n % 100, mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}
