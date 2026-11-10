import type { CampaignAudience } from '../api'
import { AUDIENCES } from './words'
import { findZone, wallToUtc, ZONES } from './schedule'

// Готовая рассылка одним куском текста — чтобы не набирать её по шагам. Сверху параметры «ключ: значение»,
// после строки «---» — само сообщение:
//
//   имя: myday-back
//   кому: inactiveLong
//   проба: 50
//   подарок: 7
//   кнопка: Посмотреть первую серию
//   адрес: moduleId=my-day&lessonId=1
//   когда: 28.11.2026 12:00
//   пояс: Тбилиси
//   ---
//   Текст сообщения, сколько угодно абзацев.
//
// Обязательны «кому» и текст. Без «кнопки» — сообщение без кнопки; без «пробы» — сразу всем.
// «когда» — день и час, в который рассылка уйдёт сама (на экране отправки останется нажать «Запланировать»);
// без «пояса» время считается по Тбилиси.

export interface PastedBroadcast {
  name: string
  audience: CampaignAudience
  /** Размер пробной группы; null — сразу всем. */
  sample: number | null
  giftDays: number
  /** Текст кнопки; null — без кнопки. */
  button: string | null
  query: string
  message: string
  /** Когда отправить саму: день (ГГГГ-ММ-ДД), время (ЧЧ:ММ) и пояс; null — время не задано. */
  when: { date: string; time: string; zone: string } | null
}

type Field = keyof PastedBroadcast | 'zone'

const KEYS: Record<string, Field> = {
  'имя': 'name', 'кому': 'audience', 'проба': 'sample', 'подарок': 'giftDays', 'кнопка': 'button', 'адрес': 'query',
  'когда': 'when', 'пояс': 'zone'
}

/** Текст из буфера обмена; '' — если клиент Telegram читать буфер не даёт (тогда вставляют долгим нажатием в поле). */
export async function readClipboard(): Promise<string> {
  try { return (await navigator.clipboard.readText()) ?? '' } catch { return '' }
}

/** Разбирает вставленный текст; строка — что не так, одной фразой. */
export function parsePastedBroadcast(raw: string): PastedBroadcast | string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const cut = lines.findIndex(l => l.trim() === '---')
  if (cut < 0) return 'Нет строки «---» между параметрами и текстом сообщения.'

  const fields: Partial<Record<Field, string>> = {}
  for (const line of lines.slice(0, cut)) {
    if (!line.trim()) continue
    const m = /^\s*([^:]+?)\s*:\s*(.*?)\s*$/.exec(line)
    const field = m && KEYS[m[1].toLowerCase()]
    if (!m || !field) return `Непонятная строка: «${line.trim()}». Бывают: ${Object.keys(KEYS).join(', ')}.`
    fields[field] = m[2]
  }

  const message = lines.slice(cut + 1).join('\n').trim()
  if (!message) return 'Нет текста сообщения после «---».'
  if (message.length > 4000) return 'Сообщение длиннее 4000 символов.'

  const who = (fields.audience ?? '').toLowerCase()
  const audience = AUDIENCES.find(a => a.id !== 'owner' && (a.id.toLowerCase() === who || a.name === who))?.id
  if (!audience) return `Кому — одна из групп: ${AUDIENCES.filter(a => a.id !== 'owner').map(a => a.id).join(', ')}.`

  const name = fields.name ?? ''
  if (name && !/^[a-z0-9][a-z0-9_-]{2,47}$/.test(name)) return 'Имя кампании: 3–48 символов, латиница в нижнем регистре, цифры, «-» и «_».'

  const sample = fields.sample ? Number(fields.sample) : null
  if (sample !== null && !(Number.isInteger(sample) && sample >= 1 && sample <= 1000)) return 'Проба — число людей от 1 до 1000.'

  const button = fields.button || null
  if (button && button.length > 64) return 'Текст кнопки длиннее 64 символов.'
  const query = (fields.query ?? '').replace(/^\?/, '')
  if (!/^[A-Za-z0-9_.~%=&-]{0,256}$/.test(query)) return 'Адрес — только параметры вида screen=verbs, без пробелов.'
  if (query && !button) return 'Адрес есть, а кнопки нет — добавь строку «кнопка: …».'

  const giftDays = fields.giftDays ? Number(fields.giftDays) : 0
  if (!(Number.isInteger(giftDays) && giftDays >= 0 && giftDays <= 30)) return 'Подарок — число дней от 0 до 30.'
  if (giftDays > 0 && !button) return 'Подарок получают по кнопке — добавь строку «кнопка: …».'

  let when: PastedBroadcast['when'] = null
  if (fields.zone && !fields.when) return 'Пояс есть, а времени нет — добавь строку «когда: 28.11.2026 12:00».'
  if (fields.when) {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(fields.when)
    const zone = fields.zone ? findZone(fields.zone) : ZONES[0].id
    if (!zone) return `Пояс — один из: ${ZONES.map(z => z.name).join(', ')} — или имя вида Europe/Paris.`
    const date = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
    const time = m ? `${m[4].padStart(2, '0')}:${m[5]}` : ''
    if (!m || !wallToUtc(date, time, zone)) return 'Когда — день и время вида 28.11.2026 12:00.'
    if (sample !== null) return 'По расписанию рассылка уходит всей группе — убери строку «проба».'
    when = { date, time, zone }
  }

  return { name, audience, sample, giftDays, button, query, message, when }
}
