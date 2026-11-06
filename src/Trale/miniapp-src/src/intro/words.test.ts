import { describe, expect, it } from 'vitest'
import story from './story.json'
import words from '../../../Lessons/GeorgianVocabIntro/words.json'

// Слова «Знакомства», которые сервер кладёт в словарь, — отдельные слова из фраз урока и слов сцены story.json,
// не сами фразы (файл собирает tools/intro_story.py; если тест упал — перезапусти скрипт).
describe('intro words.json', () => {
  const P = story.phrases as Record<string, { geo: string; ru: string }>
  const phrasesOf = (id: number) => {
    const l = story.lessons.find(x => x.id === id)!
    return [...l.new, ...((l as { scene?: string[] }).scene ?? [])].map(p => P[p].geo)
  }

  it('у каждого урока истории — свой список', () => {
    expect(words.wordLessons.map(l => l.id)).toEqual(story.lessons.map(l => l.id))
  })

  it('в словаре только отдельные слова, без фраз и знаков', () => {
    const all = words.wordLessons.flatMap(l => l.words)
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter(w => /[\s?!,.…]/.test(w.word) || !w.translation)).toEqual([])
  })

  it('каждое слово встречается во фразах своего урока (словарная форма — с тем же началом)', () => {
    const stray = words.wordLessons.flatMap(l =>
      l.words.filter(w => !phrasesOf(l.id).some(g => g.includes(w.word.length > 3 ? w.word.slice(0, -1) : w.word))).map(w => `${l.id}: ${w.word}`))
    expect(stray).toEqual([])
  })
})
