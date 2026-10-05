import type { Screen } from '../types'
import { TENSES, type TenseKey } from './types'

// Прямая ссылка на карточку глагола — её ставит бот под разбором формы:
//   ?screen=verb&verbId=<лемма>&tense=<ключ времени>&person=<0..5>
// verbId — id глагола из каталога (то же, что в /api/miniapp/verbs/{id}).
// tense и person необязательны, но работают только вместе: карточка откроется на этом лице
// и подсветит строку времени. Отдельного экрана у глагола нет — под шторкой лежит словарь.

export interface VerbLink {
  verbId: string
  highlight?: { tense: TenseKey; person: number }
}

export function parseVerbDeepLink(params: URLSearchParams): VerbLink | null {
  if (params.get('screen') !== 'verb') return null
  const verbId = (params.get('verbId') ?? '').trim()
  if (!verbId) return null

  const tense = params.get('tense')
  const personRaw = params.get('person')
  const person = personRaw !== null && /^[0-5]$/.test(personRaw) ? Number(personRaw) : null
  if (tense && Object.keys(TENSES).includes(tense) && person !== null) {
    return { verbId, highlight: { tense: tense as TenseKey, person } }
  }
  return { verbId }
}

/**
 * Куда ведёт ссылка на глагол и что оставить в адресной строке.
 * Без триала/Pro карточка недоступна — вместо сломанной шторки открываем главную с пейволом
 * (её `?paywall=1` уже понимает Dashboard).
 */
export function resolveVerbDeepLink(
  params: URLSearchParams,
  hasAccess: boolean
): { screen: Screen; search: string } | null {
  const verb = parseVerbDeepLink(params)
  if (!verb) return null
  if (!hasAccess) return { screen: { kind: 'dashboard' }, search: '?paywall=1' }
  return { screen: { kind: 'vocabulary-list', filter: 'verbs', verb }, search: '' }
}
