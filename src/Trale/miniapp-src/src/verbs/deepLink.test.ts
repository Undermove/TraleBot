import { describe, it, expect } from 'vitest'
import { parseVerbLink } from './deepLink'

describe('parseVerbLink', () => {
  it('reads the verb with the tense and person of the form the bot parsed', () => {
    const link = parseVerbLink(`?screen=verb&verb=${encodeURIComponent('წერს')}&tense=aorist&person=3`)

    expect(link).toEqual({ verbId: 'წერს', highlight: { tense: 'aorist', person: 3 } })
  })

  it('opens just the verb when the link has no form', () => {
    expect(parseVerbLink(`?screen=verb&verb=${encodeURIComponent('წერს')}`)).toEqual({ verbId: 'წერს' })
  })

  it('drops an unknown tense or an out-of-range person instead of highlighting a wrong row', () => {
    const verb = encodeURIComponent('წერს')

    expect(parseVerbLink(`?screen=verb&verb=${verb}&tense=nonsense&person=1`)).toEqual({ verbId: 'წერს' })
    expect(parseVerbLink(`?screen=verb&verb=${verb}&tense=aorist&person=9`)).toEqual({ verbId: 'წერს' })
    expect(parseVerbLink(`?screen=verb&verb=${verb}&tense=aorist`)).toEqual({ verbId: 'წერს' })
  })

  it('is not a verb link without the screen or the verb', () => {
    expect(parseVerbLink('?screen=vocabulary')).toBeNull()
    expect(parseVerbLink('?screen=verb')).toBeNull()
    expect(parseVerbLink('')).toBeNull()
  })
})
