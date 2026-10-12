import { CATALOG } from './catalog'
import { cyr, type TenseKey, type VerbCardDto, type VerbCardLineDto, type VerbCardVerbDto, type VerbDto } from '../types'

// Только для тестов: карточка перевода в том виде, в каком её отдаёт сервер (VerbCardDto), собранная
// из настоящего каталога. Формы и русские фразы — каталога; подписи — те же, что пишет сервер.

const WHO = ['я', 'ты', 'он/она', 'мы', 'вы', 'они']
const TIME: Partial<Record<TenseKey, string>> = {
  present: 'настоящее время', aorist: 'прошедшее время: сделал один раз', imperfect: 'прошедшее время: делал долго или часто', future: 'будущее время'
}

export const captionOf = (tense: TenseKey, person: number) =>
  tense === 'optative' ? `«чтобы ${WHO[person]}…» — так говорят после «надо», «хочу»` : `${WHO[person]}, ${TIME[tense] ?? ''}`

export function lineOf(verb: VerbDto, tense: TenseKey, person: number, only?: string): VerbCardLineDto {
  const forms = only ? [only] : verb.tenses[tense]![person]
  return {
    forms: forms.map(form => ({ form, transcription: cyr(form) })), tense, person,
    meaning: verb.meanings?.[tense]?.[person] ?? null, note: verb.meaningChips?.[tense] ?? null, caption: captionOf(tense, person)
  }
}

const keyForms = (verb: VerbDto): VerbCardLineDto[] =>
  ([['present', 0], ['present', 2], ['future', 0], [verb.tenses.aorist ? 'aorist' : 'imperfect', 0]] as [TenseKey, number][])
    .filter(([tense]) => verb.tenses[tense])
    .map(([tense, person]) => lineOf(verb, tense, person))

export function cardVerb(verb: VerbDto, lines: VerbCardLineDto[] = keyForms(verb)): VerbCardVerbDto {
  const actionName = verb.title === verb.id ? null : verb.title
  return {
    verbId: verb.id, lemma: verb.id, lemmaTranscription: cyr(verb.id),
    actionName, actionNameTranscription: actionName && cyr(actionName), ru: verb.ru, lines
  }
}

/** Карточка русского инфинитива: все глаголы каталога с таким значением (или переданные — для случая, которого в каталоге нет). */
export function infinitiveCard(ru: string, verbs: VerbDto[] = CATALOG.filter(v => v.ru.split(', ').includes(ru))): VerbCardDto {
  if (!verbs.length) throw new Error(`В каталоге нет глагола «${ru}»`)
  return { kind: 'infinitive', text: ru, transcription: null, moreVerbs: 0, related: [], verbs: verbs.map(v => cardVerb(v)) }
}

/** Карточка грузинской формы: её прочтения в одном глаголе. */
export function formCard(verb: VerbDto, cells: [TenseKey, number][]): VerbCardDto {
  const form = verb.tenses[cells[0][0]]![cells[0][1]][0]
  return {
    kind: 'form', text: form, transcription: cyr(form), moreVerbs: 0, related: [],
    verbs: [cardVerb(verb, cells.map(([tense, person]) => lineOf(verb, tense, person, form)))]
  }
}
