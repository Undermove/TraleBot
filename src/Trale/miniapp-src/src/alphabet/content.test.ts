import { describe, it, expect } from 'vitest'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { readFileSync } from 'node:fs'
import { LESSON_WORDS, VERIFIED_WORDS } from './games/data'
import { assembleRounds, isGeorgian, lessonLetters, learnedLetters, morphWords, readable, wordIntroPlan } from './games/logic'
import { availableProducts, orderText } from './cafe/products'
import { cafePlan } from './cafe/engine'
import { INTROS } from './intro/letters'
import { seeded } from '../verbs/testing/catalog'

// Правило модуля «Алфавит»: всё, что написано целиком грузинскими буквами, — настоящее грузинское слово
// со сверенным значением. Русские слова грузинскими буквами допустимы только как мост, пока в слове
// остаётся хоть одна русская буква («воდა»), — никогда целиком («სახარ»).

const LESSONS = Array.from({ length: 11 }, (_, i) => i + 1)
const root = `${(globalThis as any).process.cwd()}/..`
const lessonFile = (n: number) => readFileSync(`${root}/Lessons/GeorgianAlphabetProgressive/questions${n === 1 ? '' : n}.json`, 'utf8')
const theory = (() => {
  const all: string = readFileSync(`${root}/MiniApp/MiniAppContentProvider.cs`, 'utf8')
  return all.slice(all.indexOf('ModuleDto BuildAlphabetProgressiveModule()'), all.indexOf('ModuleDto BuildNumbersModule()'))
})()

const VERIFIED = new Set([
  ...LESSON_WORDS.flat().map(([geo]) => geo),
  ...VERIFIED_WORDS.map(w => w.geo),
  ...INTROS.map(i => i.word)
])

/** Слова, написанные целиком грузинскими буквами (одиночная буква — это буква, не слово). */
const georgianTokens = (text: string) =>
  (text.match(/[ა-ჿА-Яа-яЁё]+/g) ?? []).filter(t => t.length > 1 && [...t].every(isGeorgian))

describe('alphabet content: fully Georgian means a real word', () => {
  it('every verified extra word has its dictionary source', () => {
    for (const w of VERIFIED_WORDS) expect(w.source, w.geo).toBe(`https://en.wiktionary.org/wiki/${w.geo}`)
  })

  it.each(LESSONS)('lesson %i: questions and options', lesson => {
    const bad = georgianTokens(lessonFile(lesson)).filter(t => !VERIFIED.has(t))
    expect(bad).toEqual([])
  })

  it('lesson theory', () => {
    expect(georgianTokens(theory).filter(t => !VERIFIED.has(t))).toEqual([])
  })

  it.each(LESSONS)('lesson %i: games and cafe orders', lesson => {
    const shown: string[] = []
    for (let s = 1; s <= 5; s++) {
      shown.push(...morphWords(lesson, 2, seeded(s)).map(w => w.geo))
      shown.push(...assembleRounds(lesson, 2, seeded(s)).map(r => r.word.geo))
      shown.push(...cafePlan(lesson, seeded(s)).shelf.map(p => orderText(p, lesson)!))
    }
    shown.push(...availableProducts(lesson).map(p => orderText(p, lesson)!))
    for (const text of shown) for (const t of georgianTokens(text)) expect(VERIFIED.has(t), `«${t}» in lesson ${lesson}`).toBe(true)
  })
})

describe('alphabet content: only opened letters', () => {
  it.each(LESSONS)('lesson %i: every game word and order uses only letters opened by the lesson', lesson => {
    const known = new Set(learnedLetters(lesson))
    const texts = [
      ...morphWords(lesson, 5, seeded(lesson)).map(w => w.geo),
      ...assembleRounds(lesson, 2, seeded(lesson)).flatMap(r => [r.word.geo, ...r.tiles]),
      ...availableProducts(lesson).map(p => orderText(p, lesson)!),
      ...(wordIntroPlan(lesson, [], null)?.featured ?? []).map(w => w.geo)
    ]
    for (const t of texts) for (const ch of t) if (isGeorgian(ch)) expect(known.has(ch), `${ch} in «${t}», lesson ${lesson}`).toBe(true)
  })

  it.each(LESSONS)('lesson %i: the lesson words are readable and most carry a new letter', lesson => {
    const own = LESSON_WORDS[lesson - 1].map(([g]) => g)
    for (const g of own) expect(readable(g, lesson), g).toBe(true)
    expect(own.some(g => lessonLetters(lesson).some(l => g.includes(l)))).toBe(true)
  })
})

describe('one word list for the games and the dictionary', () => {
  it('the mini-app copy is exactly the server list (words.json) the dictionary is filled from', () => {
    const server = JSON.parse(readFileSync(`${root}/Lessons/GeorgianAlphabetProgressive/words.json`, 'utf8'))
    const fromServer = server.lessons.map((l: any) => l.words.map((w: any) => [w.word, w.translation]))
    expect(fromServer).toEqual(LESSON_WORDS.map(ws => ws.map(([g, r]) => [g, r])))
  })
})
