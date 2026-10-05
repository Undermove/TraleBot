import { describe, it, expect } from 'vitest'
import { parseVerbDeepLink, resolveVerbDeepLink } from './deepLink'

const q = (s: string) => new URLSearchParams(s)

describe('parseVerbDeepLink', () => {
  it('reads the verb with the form to highlight', () => {
    expect(parseVerbDeepLink(q('?screen=verb&verbId=მიდის&tense=future&person=0')))
      .toEqual({ verbId: 'მიდის', highlight: { tense: 'future', person: 0 } })
  })

  it('reads a percent-encoded verb id', () => {
    expect(parseVerbDeepLink(q(`?screen=verb&verbId=${encodeURIComponent('წერს')}`))).toEqual({ verbId: 'წერს' })
  })

  it('opens the verb without a highlight when tense or person is missing or wrong', () => {
    expect(parseVerbDeepLink(q('?screen=verb&verbId=წერს&tense=aorist'))).toEqual({ verbId: 'წერს' })
    expect(parseVerbDeepLink(q('?screen=verb&verbId=წერს&person=2'))).toEqual({ verbId: 'წერს' })
    expect(parseVerbDeepLink(q('?screen=verb&verbId=წერს&tense=nonsense&person=2'))).toEqual({ verbId: 'წერს' })
    expect(parseVerbDeepLink(q('?screen=verb&verbId=წერს&tense=aorist&person=6'))).toEqual({ verbId: 'წერს' })
    expect(parseVerbDeepLink(q('?screen=verb&verbId=წერს&tense=toString&person=1'))).toEqual({ verbId: 'წერს' })
  })

  it('ignores links that are not about a verb or name none', () => {
    expect(parseVerbDeepLink(q('?screen=vocabulary'))).toBeNull()
    expect(parseVerbDeepLink(q('?verbId=წერს'))).toBeNull()
    expect(parseVerbDeepLink(q('?screen=verb'))).toBeNull()
    expect(parseVerbDeepLink(q('?screen=verb&verbId=%20'))).toBeNull()
    expect(parseVerbDeepLink(q(''))).toBeNull()
  })
})

describe('resolveVerbDeepLink', () => {
  it('opens the dictionary on its verbs with the card on top, and clears the address bar', () => {
    expect(resolveVerbDeepLink(q('?screen=verb&verbId=წერს&tense=aorist&person=2'), true)).toEqual({
      screen: { kind: 'vocabulary-list', filter: 'verbs', verb: { verbId: 'წერს', highlight: { tense: 'aorist', person: 2 } } },
      search: ''
    })
  })

  it('sends a learner without trial or Pro to the paywall instead of a card that cannot load', () => {
    expect(resolveVerbDeepLink(q('?screen=verb&verbId=წერს'), false))
      .toEqual({ screen: { kind: 'dashboard' }, search: '?paywall=1' })
  })

  it('leaves other deep links alone', () => {
    expect(resolveVerbDeepLink(q('?screen=practice&moduleId=aorist&lessonId=1'), true)).toBeNull()
  })
})
