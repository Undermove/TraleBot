import { describe, expect, it } from 'vitest'
import { ATTESTED, flip, formFor, hasWhoWhom, objectCaseOf, possible, sameSpelling } from './logic'

// Таблицы из каталога (src/Trale/Verbs/verbs.json).
const see = { tenses: {
  present: [['ვხედავ'], ['ხედავ'], ['ხედავს'], ['ვხედავთ'], ['ხედავთ'], ['ხედავენ']],
  aorist: [['დავინახე'], ['დაინახე'], ['დაინახა'], ['დავინახეთ'], ['დაინახეთ'], ['დაინახეს']],
  future: [['დავინახავ'], ['დაინახავ'], ['დაინახავს'], ['დავინახავთ'], ['დაინახავთ'], ['დაინახავენ']]
} }
const wake = { tenses: {
  present: [['ვაღვიძებ'], ['აღვიძებ'], ['აღვიძებს'], ['ვაღვიძებთ'], ['აღვიძებთ'], ['აღვიძებენ']],
  aorist: [['გავაღვიძე'], ['გააღვიძე'], ['გააღვიძა'], ['გავაღვიძეთ'], ['გააღვიძეთ'], ['გააღვიძეს']]
} }
// Карточки, собранные агентом на проде (16.10.2026).
const search = { tenses: {
  present: [['ვეძებ'], ['ეძებ'], ['ეძებს'], ['ვეძებთ'], ['ეძებთ'], ['ეძებენ']],
  aorist: [['მოვძებნე'], ['მოძებნე'], ['მოძებნა'], ['მოვძებნეთ'], ['მოძებნეთ'], ['მოძებნეს']]
} }
const meet = { tenses: {
  present: [['ვხვდები'], ['ხვდები'], ['ხვდება'], ['ვხვდებით'], ['ხვდებით'], ['ხვდებიან']],
  aorist: [['შევხვდი'], ['შეხვდი'], ['შეხვდა'], ['შევხვდით'], ['შეხვდით'], ['შეხვდნენ']]
} }
const f = (v: { tenses: Record<string, string[][]> }, t: 'present' | 'aorist' | 'future', who: number, whom: Parameters<typeof formFor>[3]) => formFor(v, t, who, whom)?.form

describe('кто кого', () => {
  it('puts the mark of «whom» where ვ- of «I» stands', () => {
    expect(f(see, 'present', 1, 'me')).toBe('მხედავ')
    expect(f(see, 'present', 0, 'you')).toBe('გხედავ')
    expect(f(see, 'present', 2, 'me')).toBe('მხედავს')
    expect(f(see, 'present', 2, 'us')).toBe('გვხედავს')
    expect(f(see, 'aorist', 2, 'me')).toBe('დამინახა')
    expect(f(see, 'aorist', 0, 'you')).toBe('დაგინახე')
    expect(f(wake, 'aorist', 1, 'me')).toBe('გამაღვიძე')
    expect(f(wake, 'present', 0, 'you')).toBe('გაღვიძებ')
  })

  it('works on «искать» and «встречаться» too', () => {
    expect(f(search, 'present', 0, 'you')).toBe('გეძებ')
    expect(f(search, 'present', 2, 'us')).toBe('გვეძებს')
    expect(f(search, 'aorist', 2, 'me')).toBe('მომძებნა')
    expect(f(meet, 'present', 1, 'me')).toBe('მხვდები')
    expect(f(meet, 'present', 0, 'you')).toBe('გხვდები')
    expect(f(meet, 'aorist', 2, 'me')).toBe('შემხვდა')
  })

  it('«you (plural)» adds -თ, which pushes out -ს of «he»; «they» keep their own ending', () => {
    expect(f(see, 'present', 0, 'youpl')).toBe('გხედავთ')
    expect(f(see, 'present', 2, 'youpl')).toBe('გხედავთ')
    expect(f(see, 'present', 5, 'youpl')).toBe('გხედავენ')
    expect(f(see, 'aorist', 0, 'youpl')).toBe('დაგინახეთ')
  })

  it('keeps the table form for «him» and refuses «I → me»', () => {
    expect(f(see, 'present', 0, 'him')).toBe('ვხედავ')
    expect(possible(0, 'me')).toBe(false)
    expect(f(see, 'present', 3, 'us')).toBeUndefined()
    expect(f(see, 'present', 1, 'youpl')).toBeUndefined()
  })

  it('agrees with the sentences we found', () => {
    expect(ATTESTED[f(see, 'present', 0, 'youpl')!]).toBeTruthy()
    expect(ATTESTED[f(see, 'aorist', 2, 'me')!]).toBeTruthy()
  })

  it('flips the sides and names forms spelled the same', () => {
    expect(flip(0, 'him')).toEqual({ who: 2, whom: 'me' })
    expect(flip(2, 'you')).toEqual({ who: 1, whom: 'him' })
    expect(sameSpelling(see, 'present', 0, 'youpl')).toEqual(expect.arrayContaining(['он → вас', 'мы → тебя', 'мы → вас']))
  })

  it('takes «кто кого» and its Russian case from the card', () => {
    expect(objectCaseOf({ id: 'x', objectPerson: 'dat' })).toBe('dat')
    expect(hasWhoWhom({ id: 'x', objectPerson: null })).toBe(false)
    // Собраны агентом до того, как он стал ставить отметку.
    expect(objectCaseOf({ id: 'ხვდება' })).toBe('with')
    expect(sameSpelling(see, 'present', 0, 'youpl', 'dat')).toContain('он → вам')
  })
})
