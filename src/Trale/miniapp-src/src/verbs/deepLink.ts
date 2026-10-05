// Ссылка из бота на карточку глагола: ?screen=verb&verb=<id>&tense=<время>&person=<0..5>.
// Её строит VerbReplyFormatter.Button на бэкенде — кнопка «Все формы» под переводом в чате.
import { TENSES, type TenseKey } from './types'

export interface VerbLink {
  verbId: string
  /** Форма, с которой пришли: карточка откроется на её лице и подсветит строку. */
  highlight?: { tense: TenseKey; person: number }
}

export function parseVerbLink(search: string): VerbLink | null {
  const p = new URLSearchParams(search)
  if (p.get('screen') !== 'verb') return null
  const verbId = p.get('verb')?.trim()
  if (!verbId) return null

  const tense = p.get('tense')
  const person = Number.parseInt(p.get('person') ?? '', 10)
  // Время и лицо — только вместе и только известные: с чужой ссылкой карточка откроется просто на «я».
  const known = tense != null && tense in TENSES && Number.isInteger(person) && person >= 0 && person <= 5
  return known ? { verbId, highlight: { tense: tense as TenseKey, person } } : { verbId }
}
