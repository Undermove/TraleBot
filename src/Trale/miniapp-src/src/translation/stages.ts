import type { TranslateProgress, TranslateStage } from '../api'

// Что показать человеку, пока слово переводится. Шаги приходят с сервера — это то место, где перевод
// на самом деле сейчас; здесь только слова для них. Шаги глагола показываются только глаголу.

const ORDER: TranslateStage[] = ['started', 'base', 'recognizing', 'verb-source', 'verb-forms', 'verb-review', 'dictionaries', 'saving']

/** Из двух шагов — тот, что дальше: назад ход не показываем. Незнакомый или пустой шаг ничего не меняет. */
export function furtherStage(known: TranslateStage | null, next: unknown): TranslateStage | null {
  const rank = ORDER.indexOf(next as TranslateStage)
  if (rank < 0) return known
  return known === null || rank > ORDER.indexOf(known) ? (next as TranslateStage) : known
}

const TEXT: Record<TranslateStage, string> = {
  started: 'Ищу перевод',
  base: 'Смотрю в нашей базе',
  recognizing: 'Разбираюсь, что за слово',
  'verb-source': 'Ищу этот глагол в словарях',
  'verb-forms': 'Собираю формы глагола',
  'verb-review': 'Перепроверяю каждую форму',
  dictionaries: 'Ищу перевод в словарях',
  saving: 'Сохраняю в твой словарь'
}

/** Путь глагола, которого у нас ещё нет: база → словари → формы → проверка → словарь. */
export const VERB_STEPS = 5
const VERB_STEP: Record<TranslateStage, number> = {
  started: 1,
  base: 1,
  recognizing: 1,
  'verb-source': 2,
  'verb-forms': 3,
  'verb-review': 4,
  dictionaries: 4,
  saving: 5
}

export interface ProgressView {
  text: string
  /** Номер шага из VERB_STEPS; null — обычное слово, шагов не считаем. */
  step: number | null
  note: string
}

export function isVerbPath(p: TranslateProgress): boolean {
  return p.verbLookup || (p.stage !== null && p.stage.startsWith('verb-'))
}

export function progressView(p: TranslateProgress): ProgressView {
  const stage = p.stage ?? 'started'
  if (isVerbPath(p)) {
    // Сервер, который сам этот перевод не ведёт, шага не знает, но что ищется глагол — знаем.
    const known = VERB_STEP[stage] >= 2
    return {
      text: known ? TEXT[stage] : TEXT['verb-source'],
      step: known ? VERB_STEP[stage] : 2,
      note: 'Это может занять до минуты. Перевод появится здесь и в словаре.'
    }
  }
  return {
    text: TEXT[stage],
    step: null,
    note: p.slow ? 'Чуть дольше обычного, ещё немного…' : 'Обычно это пара секунд.'
  }
}
