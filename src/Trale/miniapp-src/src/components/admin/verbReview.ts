import type { MissingTenseDto, ModelMadeVerbDto } from '../../api'
import { TENSES, type TenseKey } from '../../verbs/types'

// Общее для экрана проверки глаголов: порядок очереди и слова.

export type ReviewFilter = 'waiting' | 'unverified' | 'approved' | 'all'

/** 0 — есть непроверенные времена; 1 — времена проверены, глагол целиком ещё не отмечен; 2 — отмечен проверенным. */
export const rank = (v: ModelMadeVerbDto) => (v.unverifiedTenses.length > 0 ? 0 : v.ownerApprovedAtUtc ? 2 : 1)

export const needsAttention = (v: ModelMadeVerbDto) => rank(v) < 2

/** Очередь: сначала то, что требует внимания; внутри группы порядок сервера (новые сверху). */
export const inQueueOrder = (verbs: ModelMadeVerbDto[]) =>
  verbs.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map(x => x.v)

export const matchesFilter = (v: ModelMadeVerbDto, filter: ReviewFilter) =>
  filter === 'all' || (filter === 'waiting' ? needsAttention(v) : filter === 'unverified' ? rank(v) === 0 : rank(v) === 2)

/** Поиск по русскому переводу, грузинской лемме или названию действия. */
export const matchesSearch = (v: ModelMadeVerbDto, query: string) => {
  const q = query.trim().toLowerCase()
  return !q || v.translation.toLowerCase().includes(q) || v.lemma.includes(q) || v.title.includes(q) || v.askedText.toLowerCase().includes(q)
}

export const tenseName = (tense: string) => TENSES[tense as TenseKey]?.name ?? tense

const WHY: Record<MissingTenseDto['why'], string> = {
  'verb-lacks-it': 'у глагола его нет',
  'not-sure': 'модель не уверена',
  'removed-by-owner': 'убрано вручную'
}

export const missingText = (m: MissingTenseDto) =>
  `${tenseName(m.tense)} — ${WHY[m.why] ?? m.why}${m.reviewerDisagrees ? ', проверяющая считает, что есть' : ''}`

export const statusText = (v: ModelMadeVerbDto) =>
  rank(v) === 0 ? `непроверенных времён: ${v.unverifiedTenses.length}` : rank(v) === 1 ? 'времена проверены, ждёт отметки' : 'проверен'

export const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
