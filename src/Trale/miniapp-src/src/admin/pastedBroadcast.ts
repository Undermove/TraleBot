import type { CampaignAudience } from '../api'
import { AUDIENCES } from './words'

// Готовая рассылка одним куском текста — чтобы не набирать её по шагам. Сверху параметры «ключ: значение»,
// после строки «---» — само сообщение:
//
//   имя: myday-back
//   кому: inactiveLong
//   проба: 50
//   подарок: 7
//   кнопка: Посмотреть первую серию
//   адрес: moduleId=my-day&lessonId=1
//   ---
//   Текст сообщения, сколько угодно абзацев.
//
// Обязательны «кому» и текст. Без «кнопки» — сообщение без кнопки; без «пробы» — сразу всем.

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
}

const KEYS: Record<string, keyof PastedBroadcast> = {
  'имя': 'name', 'кому': 'audience', 'проба': 'sample', 'подарок': 'giftDays', 'кнопка': 'button', 'адрес': 'query'
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

  const fields: Partial<Record<keyof PastedBroadcast, string>> = {}
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

  return { name, audience, sample, giftDays, button, query, message }
}
