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

describe('Welcome (one-letter onboarding mini-lesson)', () => {
  it('introduces the letter with its name and sound', () => {
    render(<Welcome onFinish={() => {}} />)
    expect(screen.getByText(/первая грузинская буква/i)).toBeInTheDocument()
    // Teaches both the name ("ани") and the sound ("а").
    expect(screen.getByText(/ани/i)).toBeInTheDocument()
    expect(screen.getByText(/звучит как/i)).toBeInTheDocument()
  })

  it('runs a listening task then a name task before finishing', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Welcome onFinish={onFinish} />)

    await user.click(screen.getByRole('button', { name: /дальше/i }))

    // Listening step: pick the letter you hear.
    expect(screen.getByText(/послушай и выбери/i)).toBeInTheDocument()
    await user.click(screen.getByTestId('welcome-listen-а'))

    // Name step: pick the letter's name.
    expect(screen.getByText(/как называется буква/i)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('welcome-name-ани'))

    // Win screen, onFinish only on tap-through.
    expect(screen.getByText(/первая победа/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /открыть приложение/i }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('does not advance on a wrong listening answer — nudges and lets retry', async () => {
    const user = userEvent.setup()
    render(<Welcome onFinish={() => {}} />)

    await user.click(screen.getByRole('button', { name: /дальше/i }))
    await user.click(screen.getByTestId('welcome-listen-б'))

    // Still on the listening step with a nudge.
    expect(screen.getByText(/послушай ещё разок/i)).toBeInTheDocument()
    expect(screen.getByTestId('welcome-listen-а')).toBeInTheDocument()
  })

  it('does not finish on a wrong name answer — nudges and lets retry', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Welcome onFinish={onFinish} />)

    await user.click(screen.getByRole('button', { name: /дальше/i }))
    await user.click(screen.getByTestId('welcome-listen-а'))
    await user.click(screen.getByTestId('welcome-name-бани'))

    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getByTestId('welcome-name-ани')).toBeInTheDocument()
  })

  it('reaches the win screen via the full happy path', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Welcome onFinish={onFinish} />)

    await playThrough(user)

    expect(screen.getByText(/первая победа/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /открыть приложение/i }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
