import { describe, it, expect } from 'vitest'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { readFileSync } from 'node:fs'
import { LESSON_LETTERS, LESSON_WORDS, SOUNDS } from './data'
import {
  assembleRounds, distractorsFor, hasOwnLetter, ladder, learnedLetters, lessonLetters, letterChoices,
  morphPieces, morphWords, readable, soundOf, wordCount, wordsLabel, wordsUpTo,
  lessonSteps, catchRounds, soundRounds, pairsDeck, EXAM_SIZE
} from './logic'
import { cafeReady } from '../cafe/products'
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
  })
})

describe('Morph rounds', () => {
  it.each(LESSONS)('lesson %i: real Georgian words only from opened letters, the lesson own words first', lesson => {
    const words = morphWords(lesson, 2, seeded(lesson))
    expect(words).toHaveLength(2)
    const known = wordsUpTo(lesson).map(w => w.geo)
    for (const w of words) {
      expect(known).toContain(w.geo)
      expect(readable(w.geo, lesson)).toBe(true)
      expect(morphPieces(w.geo).map(p => p.geo).join('')).toBe(w.geo)
    }
    expect(words.some(w => w.lesson === lesson || hasOwnLetter(w.geo, lesson))).toBe(true)
  })

  it('starts from the Cyrillic sound of the word: «дэда» → დედა', () => {
    expect(morphPieces('დედა').map(p => p.ru).join('')).toBe('дэда')
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

  it('every lesson word is buildable from the letters opened by its lesson', () => {
    for (const lesson of LESSONS) for (const w of ladder(lesson)) expect(readable(w.geo, lesson)).toBe(true)
    expect(ladder(1).map(w => w.geo)).toEqual(['და', 'არა', 'რა'])
  })

})

describe('lesson as a chain of games', () => {
  const letters = (l: number) => lessonSteps({ kind: 'letters', stage: l }, 0, () => true).map(s => s.kind === 'pairs' ? `pairs:${s.deck}` : s.kind)

  it('a letters lesson: three letter intros with letter games between them', () => {
    expect(letters(1)).toEqual(['intro', 'intro', 'catch', 'intro', 'pairs:letters'])
    expect(letters(2)).toEqual(['intro', 'intro', 'catch', 'intro', 'sound'])
    for (const l of LESSONS) {
      const st = lessonSteps({ kind: 'letters', stage: l }, 0, () => true)
      expect(st.filter(s => s.kind === 'intro').map(s => (s as any).letter)).toEqual(lessonLetters(l))
      expect(st.some(s => s.kind === 'words')).toBe(false)
    }
  })

  it('a words lesson: the new words first, then 2–3 word games that change from lesson to lesson', () => {
    const games = (i: number) => lessonSteps({ kind: 'words', stage: 6 }, i, () => true).map(s => s.kind === 'pairs' ? `pairs:${s.deck}` : s.kind)
    expect(games(0)).toEqual(['words', 'pairs:words', 'morph', 'dialogue'])
    expect(games(1)).toEqual(['words', 'assemble', 'dialogue', 'cafe'])
    expect(new Set([0, 1, 2, 3, 4].map(i => games(i).join())).size).toBe(5)
    // Игре не хватает слов — её место занимает другая.
    expect(lessonSteps({ kind: 'words', stage: 1 }, 1, g => g !== 'cafe' && g !== 'dialogue').map(s => s.kind)).toEqual(['words', 'assemble', 'pairs', 'morph'])
    expect(EXAM_SIZE).toBe(4)
  })

  it.each(LESSONS)('lesson %i: «Поймай букву», «Звук → буква» and «Пары» use only opened letters and real words', lesson => {
    const known = learnedLetters(lesson)
    for (const r of catchRounds(lessonLetters(lesson).slice(0, 2), lesson, seeded(lesson))) {
      expect(r.bubbles.filter(b => b === r.target)).toHaveLength(3)
      const shown = [...(lesson > 1 ? learnedLetters(lesson - 1) : []), ...lessonLetters(lesson).slice(0, 2)]
      for (const b of r.bubbles) expect(shown).toContain(b)
      for (const b of r.bubbles) if (b !== r.target) expect(distractorsFor(r.target, lesson).length === 0 || distractorsFor(r.target, lesson).includes(b)).toBe(true)
    }
    for (const r of soundRounds(lesson, seeded(lesson))) {
      expect(r.choices).toContain(r.letter)
      expect(r.choices).toHaveLength(3)
      for (const c of r.choices) expect(known).toContain(c)
    }
    const words = pairsDeck('words', lesson, seeded(lesson)).filter(c => c.kind === 'geo').map(c => c.face)
    for (const w of words) { expect(readable(w, lesson)).toBe(true); expect(wordsUpTo(lesson).map(x => x.geo)).toContain(w) }
    expect(pairsDeck('letters', lesson, seeded(1))).toHaveLength(6)
  })
})
