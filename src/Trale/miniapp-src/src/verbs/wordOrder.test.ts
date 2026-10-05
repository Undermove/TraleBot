import { describe, it, expect } from 'vitest'
import { orderNote, sentenceWords, wordOrderVerdict } from './wordOrder'
import { verbByLemma } from './testing/catalog'

// Фраза — из каталога: первая фраза глагола «писать» из трёх и более слов.
const sentence = verbByLemma('წერს').sentences.find(s => sentenceWords(s.ka).length >= 3)!
const words = sentenceWords(sentence.ka)

describe('word order when a sentence is built from chips', () => {
  it('splits a sentence into words without punctuation', () => {
    expect(words.every(w => /^[ა-ჰ-]+$/.test(w))).toBe(true)
    expect(words.join(' ')).not.toBe(sentence.ka)
  })

  it('tells the source order from the same words in another order — and neither is a mistake', () => {
    expect(wordOrderVerdict(words, sentence.ka)).toBe('exact')
    expect(wordOrderVerdict([...words].reverse(), sentence.ka)).toBe('order')
  })

  it('answers another order by showing the source, without calling it right or wrong', () => {
    const note = orderNote(sentence.ka)

    expect(note).toContain('Засчитано')
    expect(note).toContain('гибкий, но не любой')
    expect(note.endsWith(sentence.ka)).toBe(true)
    expect(note).not.toMatch(/ошибк|неверн|неправильн|тоже правильно/i)
  })
})
