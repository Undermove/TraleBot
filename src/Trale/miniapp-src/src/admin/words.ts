import type { AdminUserAccess, CampaignAudience } from '../api'

// Слова админки, общие для разделов: названия аудиторий и доступа, даты, склонения.

export const AUDIENCES: { id: CampaignAudience; name: string }[] = [
  { id: 'accessEnded', name: 'доступ закончился' },
  { id: 'onTrial', name: 'пробный период идёт' },
  { id: 'paying', name: 'платят' },
  { id: 'proLapsed', name: 'подписка закончилась' },
  { id: 'activeLately', name: 'занимались за последние 30 дней' },
  { id: 'inactiveLong', name: 'не занимались больше 30 дней' },
  { id: 'owner', name: 'только я (посмотреть)' }
]

export const audienceName = (id: CampaignAudience) => AUDIENCES.find(a => a.id === id)?.name ?? id

export const ACCESS: Record<AdminUserAccess, string> = {
  paying: 'платит', trial: 'пробный период', ended: 'доступ закончился', lapsed: 'подписка закончилась'
}

export const PLAN: Record<string, string> = {
  Month: '1 месяц', Quarter: '3 месяца', HalfYear: '6 месяцев', Year: '1 год', Lifetime: 'навсегда'
}

export const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
export const dayYear = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
export const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** «сегодня», «вчера», «5 дн. назад», дальше — дата. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'нет занятий'
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  return days < 60 ? `${days} дн. назад` : dayYear(iso)
}

export const fmt = (n: number) => n.toLocaleString('ru-RU')

/** Откуда человек пришёл — словами: ref_… — по приглашению, seo_… — с сайта, остальное — метка как есть. */
export function sourceName(source: string | null | undefined): string {
  if (!source) return 'неизвестно'
  if (source.startsWith('ref_')) return `по приглашению (${source.slice(4)})`
  if (source.startsWith('seo_')) return `с сайта (${source.slice(4)})`
  if (source.startsWith('verbs')) return `ссылка на глаголы (${source})`
  return source
}
