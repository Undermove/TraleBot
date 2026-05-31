import { describe, it, expect } from 'vitest'
import { parseDeepLinkParams } from './deepLink'

describe('parseDeepLinkParams', () => {
  it('returns moduleId and lessonId when both present', () => {
    const result = parseDeepLinkParams('?moduleId=alphabet&lessonId=3')
    expect(result).toEqual({ moduleId: 'alphabet', lessonId: 3 })
  })

  it('returns null when only moduleId is present', () => {
    const result = parseDeepLinkParams('?moduleId=alphabet')
    expect(result).toBeNull()
  })

  it('returns null when only lessonId is present', () => {
    const result = parseDeepLinkParams('?lessonId=3')
    expect(result).toBeNull()
  })

  it('returns null when no params', () => {
    const result = parseDeepLinkParams('')
    expect(result).toBeNull()
  })

  it('returns null for empty string params', () => {
    const result = parseDeepLinkParams('?moduleId=&lessonId=')
    expect(result).toBeNull()
  })

  it('returns null when lessonId is not a valid number', () => {
    const result = parseDeepLinkParams('?moduleId=alphabet&lessonId=abc')
    expect(result).toBeNull()
  })

  it('ignores unrelated params', () => {
    const result = parseDeepLinkParams('?playwright=1&moduleId=alphabet-progressive&lessonId=5&foo=bar')
    expect(result).toEqual({ moduleId: 'alphabet-progressive', lessonId: 5 })
  })
})
