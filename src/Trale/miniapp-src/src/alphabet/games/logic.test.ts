import { describe, it, expect } from 'vitest'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { readFileSync } from 'node:fs'
import { LESSON_LETTERS, LESSON_WORDS, RU_WORDS, SOUNDS } from './data'
import {
  assembleRounds, distractorsFor, learnedLetters, lessonGamePlan, lessonLetters, letterChoices, mixed, mixPieces,
  morphWords, readable, soundOf, wordCount, wordsLabel, wordsUpTo
} from './logic'
import { GEORGIAN_ALPHABET } from '../../components/AlphaIndex'
import { seeded } from '../../verbs/testing/catalog'

const LESSONS = Array.from({ length: 11 }, (_, i) => i + 1)
const LATIN = /[a-z]/i

describe('alphabet game data', () => {
  it('teaches each of the 33 letters exactly once, three per lesson', () => {
    const all = LESSON_LETTERS.flat()
    expect(all).toHaveLength(33)
    expect(new Set(all)).toEqual(new Set(GEORGIAN_ALPHABET))
    for (const l of all) expect(SOUNDS[l]).toBeTruthy()
  })

  it('uses only letters learned by its lesson in every word of the base vocabulary', () => {
    LESSON_WORDS.forEach((words, i) => {
      for (const [geo] of words) expect(readable(geo, i + 1), `${geo} in lesson ${i + 1}`).toBe(true)
    })
    expect(wordCount(11)).toBe(69)
  })

  it('takes the words and translations from the lesson theory', () => {
    // Теория уроков — источник слов и переводов (только чтение).
    const theory: string = readFileSync(`${(globalThis as any).process.cwd()}/../MiniApp/MiniAppContentProvider.cs`, 'utf8')
    const alphabet = theory.slice(theory.indexOf('ModuleDto BuildAlphabetProgressiveModule()'), theory.indexOf('ModuleDto BuildNumbersModule()'))
    const items = [...alphabet.matchAll(/"([^"]+)"/g)].map(m => m[1])
    for (const [geo, ru] of LESSON_WORDS.flat())
      expect(items.some(i => i.startsWith(`${geo} — `) && i.includes(ru)), `${geo} — ${ru}`).toBe(true)
  })

  it('has no Latin letters anywhere a learner reads', () => {
    for (const [geo, ru] of LESSON_WORDS.flat()) expect(LATIN.test(geo + ru)).toBe(false)
    for (const w of RU_WORDS) expect(LATIN.test(w)).toBe(false)
  })
})

describe('mixed words', () => {
  it('turns only the learned Russian letters into Georgian', () => {
    expect(mixed('мама', 1)).toBe('мაмა')
    expect(mixed('мама', 3)).toBe('მამა')
    expect(mixed('вода', 1)).toBe('воდა')
    expect(mixed('банан', 6)).toBe('ბანან')
  })

  it('writes «дж» and «дз» as one Georgian letter once it is learned', () => {
    expect(mixed('дзюдо', 9)).toBe('ძюდო')
    expect(mixed('дзюдо', 8)).toBe('დზюდო'.replace('ზ', 'з'))
    expect(mixed('джинсы', 11)).toBe('ჯინსы')
    expect(mixPieces('джинсы', 11)[0]).toEqual({ ru: 'дж', geo: 'ჯ' })
  })

  it('keeps the short letter for «к», «т», «п» as in the lessons (კინო, მეტრო, პასპორტ)', () => {
    expect(mixed('кино', 7)).toBe('კინო')
    expect(mixed('метро', 8)).toBe('მეტრო')
    expect(mixed('кино', 6)).toBe('кინო')
  })
})

describe('Morph rounds', () => {
  it.each(LESSONS)('lesson %i: every word has a letter of this lesson and at least two letters to turn', lesson => {
    const words = morphWords(lesson, 2, seeded(lesson))
    expect(words).toHaveLength(2)
    const own = new Set(lessonLetters(lesson))
    for (const w of words) {
      const ps = mixPieces(w, lesson)
      expect(ps.some(p => p.geo && own.has(p.geo))).toBe(true)
      expect(ps.filter(p => p.geo).length).toBeGreaterThanOrEqual(2)
      for (const p of ps) if (p.geo) expect(learnedLetters(lesson)).toContain(p.geo)
    }
  })

  it('never offers a similar-sounding letter as a wrong choice', () => {
    for (let s = 1; s < 30; s++) {
      const c = letterChoices('კ', 10, seeded(s))
      expect(c).toContain('კ')
      expect(c).not.toContain('ქ')
      expect(c).not.toContain('ყ')
      for (const l of c) expect(learnedLetters(10)).toContain(l)
    }
    expect(distractorsFor('თ', 8)).not.toContain('ტ')
  })
})

describe('Assemble rounds', () => {
  it.each(LESSONS)('lesson %i: words come from the learned vocabulary, spare tiles are learned and not look-alikes', lesson => {
    const rounds = assembleRounds(lesson, 2, seeded(lesson * 3))
    expect(rounds.length).toBe(2)
    const known = wordsUpTo(lesson).map(w => w.geo)
    for (const r of rounds) {
      expect(known).toContain(r.word.geo)
      expect([...r.tiles].sort()).toEqual(expect.arrayContaining([...r.letters].sort()))
      const spare = r.tiles.filter(t => !r.letters.includes(t))
      expect(spare.length).toBeGreaterThanOrEqual(1)
      for (const t of r.tiles) expect(learnedLetters(lesson)).toContain(t)
      for (const t of spare) for (const l of r.letters) expect(distractorsFor(l, lesson)).toContain(t)
    }
    expect(rounds[0].letters.length).toBeLessThanOrEqual(rounds[1].letters.length)
  })

  it('prefers the words of the lesson itself', () => {
    expect(assembleRounds(4, 2, seeded(1)).every(r => r.word.lesson === 4)).toBe(true)
  })
})

describe('sounds and labels', () => {
  it('says «к» while only one к-letter is known, and tells them apart later', () => {
    expect(soundOf('ქ', 6)).toBe('«к»')
    expect(soundOf('ქ', 7)).toBe('«к» с выдохом')
    expect(soundOf('ა', 1)).toBe('«а»')
  })

  it('counts words in Russian', () => {
    expect(wordsLabel(3)).toBe('3 грузинских слова')
    expect(wordsLabel(9)).toBe('9 грузинских слов')
    expect(wordsLabel(21)).toBe('21 грузинское слово')
    expect(wordsLabel(12)).toBe('12 грузинских слов')
  })

  it('plans Morph after the sixth question and Assemble at the end', () => {
    expect(lessonGamePlan(1, 10)).toEqual({ midAfter: 6, mid: 'morph', end: 'assemble' })
    expect(lessonGamePlan(2, 4)?.midAfter).toBe(2)
    expect(lessonGamePlan(12, 10)).toBeNull()
  })
})
