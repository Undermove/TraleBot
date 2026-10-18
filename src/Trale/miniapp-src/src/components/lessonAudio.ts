import story from '../intro/story.json'
import { INTRO_AUDIO } from '../intro/audio'
import { WORD_AUDIO } from '../alphabet/games/data'

// Запись к слову из словаря, если это слово урока: фраза «Знакомства» (её голос из уроков) или слово
// алфавита. Слова в словарь уроки кладут как есть (POST vocabulary/intro-words, alphabet-words), так
// что ищем по тексту. У переведённых слов записи нет — тогда и кнопки нет.

const key = (geo: string) => geo.replace('…', '').trim().toLowerCase()

const BY_WORD: ReadonlyMap<string, string> = new Map([
  ...Object.entries(WORD_AUDIO).map(([geo, url]) => [key(geo), url] as const),
  ...Object.entries(story.phrases as Record<string, { geo: string }>)
    .filter(([id]) => INTRO_AUDIO[id])
    .map(([id, p]) => [key(p.geo), INTRO_AUDIO[id]] as const)
])

export const lessonAudio = (word: string): string | undefined => BY_WORD.get(key(word))
