import { describe, it, expect } from 'vitest'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { readFileSync } from 'node:fs'
import { LESSON_LETTERS, LESSON_WORDS, SOUNDS } from './data'
import {
  assembleRounds, distractorsFor, hasOwnLetter, ladder, learnedLetters, lessonLetters, letterChoices,
  morphPieces, morphWords, readable, soundOf, wordCount, wordIntroPlan, wordsLabel, wordsUpTo,
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

  it('introduces the lesson words after the letters, before the first question about a word and before the mid-lesson game', () => {
    for (const lesson of LESSONS) {
      // Вопросы — настоящие из уроков.
      const file = `${(globalThis as any).process.cwd()}/../Lessons/GeorgianAlphabetProgressive/questions${lesson === 1 ? '' : lesson}.json`
      const lemmas: string[] = JSON.parse(readFileSync(file, 'utf8')).questions.slice(0, 10).map((q: any) => q.lemma)
      const plan = { midAfter: 6 }
      const words = wordIntroPlan(lesson, lemmas, plan.midAfter)!
      const own = LESSON_WORDS[lesson - 1].map(([g]) => g)
      // Сцена — не позже игры в середине и до первого вопроса о слове урока.
      expect(words.before, `lesson ${lesson}`).toBeLessThanOrEqual(plan.midAfter)
      const firstAsked = lemmas.findIndex(l => own.includes(l))
      if (firstAsked >= 0) expect(words.before).toBeLessThanOrEqual(firstAsked)
      // Все буквы урока уже показаны.
      for (const l of lessonLetters(lesson)) expect(lemmas.indexOf(l), `${l} in lesson ${lesson}`).toBeLessThan(words.before)
      // Каждое слово урока — либо своей сценой, либо в списке; о чём спрашивают — сценой, если влезает.
      expect([...words.featured, ...words.rest].map(w => w.geo).sort()).toEqual([...own].sort())
      expect(words.featured.length).toBeLessThanOrEqual(3)
      const asked = [...new Set(lemmas.filter(l => own.includes(l)))]
      expect(words.featured.map(w => w.geo)).toEqual(expect.arrayContaining(asked.slice(0, 3)))
    }
  })

  it('every lesson word is buildable from the letters opened by its lesson', () => {
    for (const lesson of LESSONS) for (const w of ladder(lesson)) expect(readable(w.geo, lesson)).toBe(true)
    expect(ladder(1).map(w => w.geo)).toEqual(['და', 'არა', 'რა'])
  })

})

describe('lesson as a chain of games', () => {
  const steps = (l: number) => lessonSteps(l, cafeReady).map(s => s.kind === 'pairs' ? `pairs:${s.deck}` : s.kind)

  it('opens mechanics one by one and keeps the cafe for lessons with real food words', () => {
    expect(steps(1)).toEqual(['intro', 'intro', 'catch', 'intro', 'pairs:letters', 'words', 'morph'])
    expect(steps(2)).toEqual(['intro', 'intro', 'catch', 'intro', 'sound', 'words', 'assemble'])
    expect(steps(3)).toEqual(['intro', 'intro', 'catch', 'intro', 'sound', 'words', 'morph', 'pairs:words'])
    expect(steps(5)).toEqual(['intro', 'intro', 'catch', 'intro', 'sound', 'words', 'morph', 'cafe'])
    for (const l of LESSONS) {
      const st = lessonSteps(l, cafeReady)
      // Каждая буква урока — знакомство раньше любой игры с ней.
      expect(st.filter(s => s.kind === 'intro').map(s => (s as any).letter)).toEqual(lessonLetters(l))
      expect(st.findIndex(s => s.kind === 'words')).toBeGreaterThan(st.map(s => s.kind).lastIndexOf('intro'))
    }
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
