import type { VerbDto, VerbFormHitDto } from '../types'

// Данные для тестов. Все грузинские формы взяты из каталога src/Trale/Verbs/verbs.json (глагол წერს).

export const writeVerb: VerbDto = {
  id: 'წერს', title: 'წერა', ru: 'писать', kind: 'pattern', present: ['ვწერ'],
  masdarWithPreverb: ['დაწერა'], reason: 'Будущее и прошедшее «сделал» = приставка + основа настоящего.',
  root: 'წერ', oddTenses: [], model: { id: 'აკეთებს', title: 'კეთება', ru: 'делать' },
  tenses: {
    present: [['ვწერ'], ['წერ'], ['წერს'], ['ვწერთ'], ['წერთ'], ['წერენ']],
    aorist: [['დავწერე'], ['დაწერე'], ['დაწერა'], ['დავწერეთ'], ['დაწერეთ'], ['დაწერეს']],
    imperfect: [['ვწერდი'], ['წერდი'], ['წერდა'], ['ვწერდით'], ['წერდით'], ['წერდნენ']]
  },
  sentences: [],
  source: 'https://en.wiktionary.org/wiki/x'
}

export const hit = (form: string, tense: VerbFormHitDto['tense'], person: number): VerbFormHitDto =>
  ({ form, verbId: 'წერს', title: 'წერა', ru: 'писать', tense, person })

export const goHit: VerbFormHitDto =
  { form: 'მიდის', verbId: 'მიდის', title: 'სვლა', ru: 'идти, уходить', tense: 'present', person: 2 }
