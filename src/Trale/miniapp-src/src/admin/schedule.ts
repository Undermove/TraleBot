// Время отправки рассылки: владелец называет день и час «по часам» выбранного пояса, сервер хранит момент в UTC.

/** Пояса, которые предлагает экран; первый — по умолчанию. */
export const ZONES = [
  { id: 'Asia/Tbilisi', name: 'Тбилиси' },
  { id: 'Europe/Moscow', name: 'Москва' },
  { id: 'Europe/Berlin', name: 'Берлин' },
  { id: 'Europe/London', name: 'Лондон' },
  { id: 'UTC', name: 'UTC' }
]

export const zoneName = (id: string | null | undefined) => ZONES.find(z => z.id === id)?.name ?? id ?? 'UTC'

/** Пояс по названию из списка или по имени вида Asia/Tbilisi; null — такого нет. */
export function findZone(text: string): string | null {
  const t = text.trim().toLowerCase()
  const known = ZONES.find(z => z.name.toLowerCase() === t || z.id.toLowerCase() === t)
  if (known) return known.id
  try { return new Intl.DateTimeFormat('en-US', { timeZone: text.trim() }).resolvedOptions().timeZone } catch { return null }
}

/** Что показывают часы в этом поясе в данный момент — как число миллисекунд «будто это UTC». */
function wallMs(at: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(new Date(at))
  const n = (type: string) => Number(parts.find(p => p.type === type)!.value)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
}

/** Момент, когда часы в поясе покажут этот день (ГГГГ-ММ-ДД) и это время (ЧЧ:ММ); null — такой даты или времени нет. */
export function wallToUtc(date: string, time: string, zone: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  const [year, month, dayOf, hour, minute] = [+d[1], +d[2], +d[3], +t[1], +t[2]]
  if (hour > 23 || minute > 59) return null
  const wall = Date.UTC(year, month - 1, dayOf, hour, minute)
  const check = new Date(wall)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== dayOf) return null // 31 ноября
  try {
    // Сдвиг пояса берём в искомый момент: два шага хватает и на переводе часов.
    let at = wall - (wallMs(wall, zone) - wall)
    at = wall - (wallMs(at, zone) - at)
    return new Date(at)
  } catch { return null }
}

/** «28.11.2026 12:00 (Тбилиси)» — момент по часам пояса, в котором его назначали. */
export function scheduledText(iso: string, zone: string | null | undefined): string {
  const id = zone && findZone(zone) ? zone : 'UTC'
  const text = new Date(iso).toLocaleString('ru-RU', { timeZone: id, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
  return `${text} (${zoneName(id)})`
}

/** Завтрашний день по часам устройства, «2026-11-28» — с него начинается выбор дня отправки. */
export function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
