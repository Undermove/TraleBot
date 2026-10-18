import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { introLesson, newPhrases, sceneWords } from '../story'
import StoryFinale from './StoryFinale'

vi.mock('../../api', () => ({ api: { addIntroWords: vi.fn() } }))
import { api } from '../../api'
const addIntroWords = vi.mocked(api.addIntroWords)

describe('StoryFinale', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false); addIntroWords.mockReset() })

  it('слова урока уходят в словарь: счётчик растёт, в первых уроках — как его найти, кнопка открывает словарь', async () => {
    vi.useFakeTimers()
    const lesson = introLesson(3)
    const all = [...newPhrases(lesson), ...sceneWords(lesson)]
    addIntroWords.mockResolvedValue({ words: all.map(p => ({ word: p.geo, translation: p.ru, added: true })), added: all.length })
    const onVocabulary = vi.fn()
    render(<StoryFinale lesson={lesson} onNext={() => {}} onVocabulary={onVocabulary} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(addIntroWords).toHaveBeenCalledWith(3)
    expect(screen.getByTestId('finale-dict').textContent).toContain('в твоём словаре')
    expect(screen.getByTestId('dict-count').textContent).toBe(String(all.length))
    expect(screen.getByTestId('finale-dict-tip')).toBeTruthy()
    fireEvent.click(screen.getByTestId('finale-open-dict'))
    expect(onVocabulary).toHaveBeenCalled()
  })

  it('без сети — праздник как был, без словаря', async () => {
    addIntroWords.mockRejectedValue(new Error('offline'))
    render(<StoryFinale lesson={introLesson(10)} onNext={() => {}} onVocabulary={() => {}} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByTestId('finale-dict')).toBeNull()
    expect(screen.queryByTestId('finale-open-dict')).toBeNull()
  })
})
