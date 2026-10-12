import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Welcome from '../Welcome'

// Walks the happy path: meet the letter → listening task → name task → win.
async function playThrough(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /дальше/i }))
  await user.click(screen.getByTestId('welcome-listen-а'))
  await user.click(screen.getByTestId('welcome-name-ани'))
}

const NEXT = { moduleTitle: 'Алфавит', lessonId: 1, title: 'Гласные', short: 'ა ე ი ო უ' }

function renderWelcome(props: Partial<React.ComponentProps<typeof Welcome>> = {}) {
  const handlers = { onComplete: vi.fn(), onNext: vi.fn(), onBrowse: vi.fn() }
  render(<Welcome next={NEXT} {...handlers} {...props} />)
  return handlers
}

describe('Welcome (one-letter onboarding mini-lesson)', () => {
  it('introduces the letter with its name and sound', () => {
    renderWelcome()
    expect(screen.getByText(/первая грузинская буква/i)).toBeInTheDocument()
    // Teaches both the name ("ани") and the sound ("а").
    expect(screen.getByText(/ани/i)).toBeInTheDocument()
    expect(screen.getByText(/звучит как/i)).toBeInTheDocument()
  })

  it('runs a listening task then a name task, and records the lesson the moment the last one is solved', async () => {
    const user = userEvent.setup()
    const { onComplete, onNext, onBrowse } = renderWelcome()

    await user.click(screen.getByRole('button', { name: /дальше/i }))

    // Listening step: pick the letter you hear.
    expect(screen.getByText(/послушай и выбери/i)).toBeInTheDocument()
    await user.click(screen.getByTestId('welcome-listen-а'))

    // Name step: pick the letter's name.
    expect(screen.getByText(/как называется буква/i)).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('welcome-name-ани'))

    // Win screen: recorded already — closing the app here does not lose the lesson.
    expect(screen.getByText(/первая победа/i)).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
    expect(onBrowse).not.toHaveBeenCalled()
  })

  it('does not advance on a wrong listening answer — nudges and lets retry', async () => {
    const user = userEvent.setup()
    renderWelcome()

    await user.click(screen.getByRole('button', { name: /дальше/i }))
    await user.click(screen.getByTestId('welcome-listen-б'))

    // Still on the listening step with a nudge.
    expect(screen.getByText(/послушай ещё разок/i)).toBeInTheDocument()
    expect(screen.getByTestId('welcome-listen-а')).toBeInTheDocument()
  })

  it('does not finish on a wrong name answer — nudges and lets retry', async () => {
    const user = userEvent.setup()
    const { onComplete } = renderWelcome()

    await user.click(screen.getByRole('button', { name: /дальше/i }))
    await user.click(screen.getByTestId('welcome-listen-а'))
    await user.click(screen.getByTestId('welcome-name-бани'))

    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByTestId('welcome-name-ани')).toBeInTheDocument()
  })

  it('offers the next lesson as the one main action of the win screen', async () => {
    const user = userEvent.setup()
    const { onNext, onBrowse } = renderWelcome()

    await playThrough(user)

    // Which lesson comes next is said in words: its name, what is in it, where it lives.
    const card = screen.getByTestId('welcome-next-lesson')
    expect(card).toHaveTextContent('Гласные')
    expect(card).toHaveTextContent('ა ე ი ო უ')
    expect(card).toHaveTextContent('Алфавит · урок 1')
    // One big button — the next lesson; the hub is a quiet link.
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('jewel-btn'))).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /следующий урок/i }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onBrowse).not.toHaveBeenCalled()
  })

  it('keeps the hub one tap away for those who want to choose themselves', async () => {
    const user = userEvent.setup()
    const { onNext, onBrowse } = renderWelcome()

    await playThrough(user)
    await user.click(screen.getByRole('button', { name: /посмотреть все уроки/i }))

    expect(onBrowse).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('falls back to opening the app when there is no lesson to offer', async () => {
    const user = userEvent.setup()
    const { onBrowse } = renderWelcome({ next: null })

    await playThrough(user)

    expect(screen.queryByTestId('welcome-next-lesson')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /открыть приложение/i }))
    expect(onBrowse).toHaveBeenCalledTimes(1)
  })

  it('addresses the learner without grammatical gender and without emoji on the win screen', async () => {
    const user = userEvent.setup()
    renderWelcome()

    await playThrough(user)

    const text = screen.getByTestId('welcome-screen').textContent ?? ''
    expect(text).not.toMatch(/узнал|услышал|заработал|выучил/i)
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
