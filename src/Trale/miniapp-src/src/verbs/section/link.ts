import type { Screen } from '../../types'

// Прямая ссылка на раздел «Глаголы» — для рассылки и постов:
//   кнопка рассылки:   …/?screen=verbs&c=<имя кампании>   (c добавляет сервер; по нему же считается открытие и выдаётся подарок)
//   кнопка после /start verbs_<метка>:   …/?screen=verbs&src=verbs_<метка>
//   прямая ссылка на мини-апп, если она заведена у бота:   t.me/<бот>/<приложение>?startapp=verbs_<метка>
// Метка уходит на сервер вместе с открытием раздела (VerbSectionVisits) — в том числе у тех, кто
// пользуется приложением давно и чей «первый источник» уже записан.

const TAG = /^[A-Za-z0-9_-]{1,64}$/
const tag = (value: string | null | undefined) => (value && TAG.test(value) ? value.toLowerCase() : undefined)

/** Экран раздела, если адрес (или start_param Telegram) ведёт в него; иначе null. */
export function parseVerbsSectionLink(params: URLSearchParams, startParam?: string | null): Screen | null {
  if (params.get('screen') === 'verbs') {
    return { kind: 'verbs', source: tag(params.get('c')) ?? tag(params.get('src')) ?? 'link' }
  }
  const start = tag(startParam)
  if (start && (start === 'verbs' || start.startsWith('verbs_'))) return { kind: 'verbs', source: start }
  return null
}
