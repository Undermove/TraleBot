import { describe, expect, it } from 'vitest'
import { lessonAudio } from './lessonAudio'

describe('lessonAudio', () => {
  it('у фраз «Знакомства» и слов алфавита в словаре есть запись урока, у остальных — нет', () => {
    expect(lessonAudio('გამარჯობა')).toBe('/audio/intro-story/gamarjoba.m4a')
    expect(lessonAudio(' კარგად, შენ? ')).toMatch(/^\/audio\/intro-story\//)
    expect(lessonAudio('ჩაი')).toMatch(/\.m4a$/)
    expect(lessonAudio('ტელევიზორი-ა-რა')).toBeUndefined()
  })
})
