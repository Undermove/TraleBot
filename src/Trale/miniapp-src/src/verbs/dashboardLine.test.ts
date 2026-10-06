import { describe, it, expect } from 'vitest'
import { pickVerbsLine, pluralVerbs } from './dashboardLine'

const regular = { newcomer: false, onboardingActive: false }

describe('pickVerbsLine', () => {
  it('offers the dictionary verbs, opening the dictionary on the «глаголы» filter', () => {
    const line = pickVerbsLine({ ...regular, summary: { dictionaryVerbs: 5 } })

    expect(line).toEqual({
      id: 'dictionary',
      text: 'В твоём словаре 5 глаголов — посмотри формы',
      screen: { kind: 'vocabulary-list', filter: 'verbs' }
    })
  })

  it('a verb being learned comes first: «продолжить глагол X» opens that verb straight away', () => {
    const summary = { dictionaryVerbs: 5, continueVerb: { id: 'verb-id', title: 'title', ru: 'писать', level: 'recognising' as const } }

    expect(pickVerbsLine({ ...regular, summary })).toEqual({
      id: 'continue',
      text: 'Продолжить глагол «писать» · узнаю',
      screen: { kind: 'vocabulary-list', filter: 'verbs', verb: { verbId: 'verb-id' } }
    })
    expect(pickVerbsLine({ ...regular, summary: { dictionaryVerbs: 5, continueVerb: null } })!.id).toBe('dictionary')
  })

  it('says nothing when the dictionary has no verbs', () => {
    expect(pickVerbsLine({ ...regular, summary: { dictionaryVerbs: 0 } })).toBeNull()
  })

  it('says nothing without a summary — not loaded, or no access to verbs', () => {
    expect(pickVerbsLine({ ...regular, summary: null })).toBeNull()
  })

  it('never shows up for a newcomer: the first lesson stays the only suggestion', () => {
    expect(pickVerbsLine({ newcomer: true, onboardingActive: false, summary: { dictionaryVerbs: 5 } })).toBeNull()
  })

  it('stays out of the way while an onboarding hint is on screen', () => {
    expect(pickVerbsLine({ newcomer: false, onboardingActive: true, summary: { dictionaryVerbs: 5 } })).toBeNull()
  })

  it('agrees the noun with the number', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 111].map(pluralVerbs)).toEqual([
      'глагол', 'глагола', 'глагола', 'глаголов', 'глаголов', 'глаголов', 'глагол', 'глагола', 'глаголов', 'глаголов'
    ])
    expect(pickVerbsLine({ ...regular, summary: { dictionaryVerbs: 1 } })!.text)
      .toBe('В твоём словаре 1 глагол — посмотри его формы')
  })
})
