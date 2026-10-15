import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LessonOpener from './LessonOpener'

describe('alphabet lesson opener', () => {
  it('shows three face-down cards, the words to read by the end and a big «Начать» — no tables or theory', () => {
    const onStart = vi.fn()
    render(<LessonOpener lessonId={2} onBack={() => {}} onStart={onStart} details={<p>Теория урока</p>} />)
    expect(screen.getByText('Сегодня 3 новые буквы')).toBeTruthy()
    expect(screen.getAllByTestId('opener-card')).toHaveLength(3)
    // Буквы урока не раскрыты заранее — каждая откроется своей сценой.
    for (const l of ['ე', 'ი', 'ს']) expect(screen.getByTestId('opener-cards').textContent).not.toContain(l)
    expect(screen.getByTestId('opener-words').textContent).toContain('სად')
    expect(screen.queryByText('Теория урока')).toBeNull()
    expect(document.querySelector('table')).toBeNull()
    fireEvent.click(screen.getByText('Начать'))
    expect(onStart).toHaveBeenCalled()
  })

  it('lesson 1 after the app intro: ა lies face up as «уже знаешь», two cards are new', () => {
    localStorage.setItem('bombora_welcome_letters', JSON.stringify(['ა']))
    render(<LessonOpener lessonId={1} onBack={() => {}} onStart={() => {}} details={null} />)
    expect(screen.getByText('Одну букву ты уже знаешь, ещё 2 — новые')).toBeTruthy()
    const known = document.querySelectorAll('[data-known="yes"]')
    expect(known).toHaveLength(1)
    expect(known[0].textContent).toBe('აуже знаешь')
    localStorage.clear()
  })

  it('keeps the theory behind «подробнее»', () => {
    render(<LessonOpener lessonId={1} onBack={() => {}} onStart={() => {}} details={<p>Теория урока</p>} />)
    fireEvent.click(screen.getByTestId('opener-more'))
    expect(screen.getByTestId('opener-details').textContent).toContain('Теория урока')
    fireEvent.click(screen.getByText('свернуть'))
    expect(screen.queryByTestId('opener-details')).toBeNull()
  })
})
