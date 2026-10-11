import type { SurveyQuestionDto } from '../../api'

// Главная цифра вопроса — доля одного варианта среди ответивших без другого («Очень расстроюсь» без
// «Уже не пользуюсь»). Она привязана не к тексту кнопок, а к их устойчивым именам (optionKeys): кнопку
// можно переименовать — цифра останется. Пропадает она, только если один из двух вариантов убрать;
// тогда конструктор говорит об этом прямо.

const optionOf = (q: SurveyQuestionDto, key: string | null | undefined) => {
  const index = key ? (q.optionKeys ?? []).indexOf(key) : -1
  return index >= 0 ? q.options[index]?.trim() || null : null
}

export type HeadlineState =
  | { kind: 'none' }
  /** Цифра будет: что на что делится, словами, как кнопки названы сейчас. */
  | { kind: 'ok'; option: string; without: string | null }
  /** Вопрос задуман с цифрой, но её не будет. */
  | { kind: 'lost'; why: string }

export function headlineOf(q: SurveyQuestionDto): HeadlineState {
  if (!q.headlineOption) return { kind: 'none' }
  if (q.kind !== 'choice') return { kind: 'lost', why: 'вопрос стал свободным' }
  const option = optionOf(q, q.headlineOption)
  const without = q.headlineWithout ? optionOf(q, q.headlineWithout) : null
  if (!option || (q.headlineWithout && !without)) return { kind: 'lost', why: 'убран один из двух вариантов, по которым она считается' }
  return { kind: 'ok', option, without }
}

/** Те же варианты и их имена после правки: имя остаётся при своём варианте, у нового варианта имени нет. */
export const withOptions = (q: SurveyQuestionDto, options: string[], keys: string[]): SurveyQuestionDto =>
  ({ ...q, options, optionKeys: keys.some(Boolean) ? keys : q.optionKeys ? keys : undefined })

export const keysOf = (q: SurveyQuestionDto) => q.options.map((_, i) => q.optionKeys?.[i] ?? '')
