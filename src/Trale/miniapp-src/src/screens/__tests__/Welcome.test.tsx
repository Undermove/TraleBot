import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Welcome from '../Welcome'
import { welcomeLetters } from '../../alphabet/known'
import { __setLessonEventSender, flushLessonEvents, type LessonEventDto } from '../../analytics/lessonEvents'

let sent: LessonEventDto[] = []
const trail = () => { flushLessonEvents(); return sent.map(e => `${e.moduleId}:${e.step}:${e.stepKind}:${e.event}`) }

function renderWelcome() {
  const handlers = { onComplete: vi.fn(), onNext: vi.fn(), onBrowse: vi.fn() }
  render(<Welcome {...handlers} />)
  return handlers
}

describe('Welcome — the first minute of a new user, as a game', () => {
  beforeEach(() => {
    localStorage.clear()
    sent = []
    __setLessonEventSender(e => { sent.push(...e) })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })
  afterEach(() => __setLessonEventSender(null))

  it('greets in one line — no wall of text, no letter-name recording', () => {
    renderWelcome()
    expect(screen.getByTestId('welcome-hello').textContent).toMatch(/За минуту прочитаешь первое грузинское слово/)
    expect(document.querySelector('audio[src*="/audio/alphabet/a.m4a"]')).toBeNull()
    expect(screen.queryByText(/ани/)).toBeNull()
  })

  it('letter ა → catch → gifted დ → reads და → tour → «1 букву и 1 слово» → alphabet lesson 1', async () => {
    const { onComplete, onNext } = renderWelcome()
    fireEvent.click(screen.getByText('поехали →'))

    // Знакомство с ა — то же, что в уроке (стираешь персик, пишешь); здесь пропускаем до подписи.
    expect(screen.getByText(/первая буква/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-word').textContent).toBe('ატამი')
    fireEvent.click(screen.getByText('дальше →'))
    expect(welcomeLetters()).toEqual(['ა'])

    // Одна волна «Поймай букву».
    await waitFor(() => expect(screen.getAllByTestId('catch-bubble').length).toBe(8))
    for (const b of screen.getAllByTestId('catch-bubble').filter(b => b.dataset.target === 'yes')) fireEvent.pointerDown(b)

    // Подарок: вторая буква.
    await waitFor(() => expect(screen.getByTestId('welcome-gift')).toBeTruthy(), { timeout: 4000 })
    fireEvent.click(screen.getByTestId('welcome-gift-card'))
    await waitFor(() => expect(screen.getByText('читать слово →')).toBeTruthy())
    fireEvent.click(screen.getByText('читать слово →'))

    // Первое слово: ведёшь по буквам და — читаешь.
    expect(screen.getByText('Твоё первое слово')).toBeTruthy()
    const tiles = screen.getAllByTestId('word-tile')
    expect(tiles.map(t => t.textContent)).toEqual(['დ', 'ა'])
    for (const t of tiles) fireEvent.pointerDown(t)
    await waitFor(() => expect(screen.getByText('дальше →')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByTestId('dict-chip')).toBeNull()
    fireEvent.click(screen.getByText('дальше →'))

    // Три карточки «что тут есть».
    for (const title of ['Алфавит', 'Слова', 'Разговоры']) {
      expect(screen.getByTestId('welcome-tour-card').textContent).toContain(title)
      fireEvent.click(screen.getByText(/дальше →|понятно →/))
    }

    await waitFor(() => expect(screen.getByTestId('welcome-win').textContent).toBe('Ты уже знаешь 1\u00a0букву и 1\u00a0слово'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('продолжить алфавит →'))
    expect(onNext).toHaveBeenCalled()

    expect(trail()).toEqual([
      'onboarding:0:greeting:lesson_open', 'onboarding:0:greeting:step_done',
      'onboarding:1:letter-intro:step_start', 'onboarding:1:letter-intro:step_skip', 'onboarding:1:letter-intro:step_done',
      'onboarding:2:catch:step_start', 'onboarding:2:catch:step_done',
      'onboarding:3:first-word:step_start', 'onboarding:3:first-word:step_done',
      'onboarding:4:tour:step_start', 'onboarding:4:tour:step_done',
      'onboarding:5:celebration:step_start', 'onboarding:5:celebration:lesson_complete'
    ])
  }, 20_000)

  it('can be skipped at once: still recorded (so it is not shown again) and leads to the alphabet', async () => {
    const { onComplete, onBrowse } = renderWelcome()
    await act(async () => { fireEvent.click(screen.getByTestId('welcome-skip')) })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('welcome-win').textContent).toMatch(/Начнём с алфавита/)
    expect(welcomeLetters()).toEqual([])
    fireEvent.click(screen.getByTestId('welcome-browse'))
    expect(onBrowse).toHaveBeenCalled()
  })
})
