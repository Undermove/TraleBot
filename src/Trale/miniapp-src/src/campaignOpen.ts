import { reportCampaignOpen } from './api'

// Кнопка в рассылке владельца открывает мини-апп с ?c=<имя кампании>. Сообщаем об этом серверу
// один раз за запуск — так считается, сколько людей открыли мини-апп по рассылке.
// Ошибка здесь не должна мешать запуску, поэтому всё проглатывается.

export function campaignKeyFromUrl(search: string): string | null {
  const key = new URLSearchParams(search).get('c')
  return key && /^[a-z0-9][a-z0-9_-]{2,47}$/.test(key) ? key : null
}

export function reportCampaignOpenFromUrl(search: string = window.location.search) {
  try {
    const key = campaignKeyFromUrl(search)
    if (key) void reportCampaignOpen(key).catch(() => {})
  } catch {}
}
