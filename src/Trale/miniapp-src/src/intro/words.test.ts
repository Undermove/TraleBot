import { describe, expect, it } from 'vitest'
import story from './story.json'
import words from '../../../Lessons/GeorgianVocabIntro/words.json'

// Слова «Знакомства», которые сервер кладёт в словарь, — это фразы урока и слова сцены из story.json
// (файл собирает tools/intro_story.py; если тест упал — перезапусти скрипт).
describe('intro words.json', () => {
  it('у каждого урока — его фразы и слова сцены, с переводом из истории', () => {
    const P = story.phrases as Record<string, { geo: string; ru: string }>
    const want = story.lessons.map(l => ({
      id: l.id,
      words: [...new Set([...l.new, ...((l as { scene?: string[] }).scene ?? [])])].map(id => ({ word: P[id].geo.replace('…', '').trim(), translation: P[id].ru }))
    }))
    expect(words.wordLessons.map(l => ({ id: l.id, words: l.words }))).toEqual(want)
  })
})
