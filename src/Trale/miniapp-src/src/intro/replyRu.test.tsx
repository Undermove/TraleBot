import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntroLessonId, Reply } from './ui'
import { RU_UNDER_REPLIES_UNTIL, phrase } from './story'

// Перевод под кнопками ответа не пропадает разом в 7-м уроке: весь второй акт он есть, дальше — кириллица.
describe('Reply: перевод под кнопкой', () => {
  const geo = phrase('rogor').geo
  const hintIn = (lessonId: number) => {
    const { unmount } = render(<IntroLessonId.Provider value={lessonId}><Reply geo={geo} onClick={() => {}} testId="r" /></IntroLessonId.Provider>)
    const text = screen.getByTestId('r').textContent ?? ''
    unmount()
    return text
  }
  it('во втором акте — перевод, с третьего — как читается', () => {
    expect(hintIn(7)).toContain(phrase('rogor').ru)
    expect(hintIn(RU_UNDER_REPLIES_UNTIL)).toContain(phrase('rogor').ru)
    expect(hintIn(RU_UNDER_REPLIES_UNTIL + 1)).not.toContain(phrase('rogor').ru)
  })
})
