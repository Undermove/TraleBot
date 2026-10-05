import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerbGames from './VerbGames'
import VerbSheet from '../VerbSheet'
import { verbRu } from './testCatalog'

vi.mock('../../api', () => ({ fetchVerb: vi.fn() }))

async function mockCard(verb = verbRu('писать')) {
  const { fetchVerb } = await import('../../api')
  vi.mocked(fetchVerb).mockResolvedValue(verb)
}

describe('VerbGames', () => {
  beforeEach(async () => { localStorage.clear(); await mockCard() })

  it('offers the three games for a verified verb that fits all of them', () => {
    render(<VerbGames verb={verbRu('писать')} />)

    expect(screen.getByTestId('verb-game-time').textContent).toBe('Машина времени')
    expect(screen.getByTestId('verb-game-bones').textContent).toBe('Косточки')
    expect(screen.getByTestId('verb-game-builder').textContent).toBe('Конструктор')
  })

  it('leaves out the constructor for a verb it cannot cut into parts', () => {
    render(<VerbGames verb={verbRu('идти')} />)

    expect(screen.getByTestId('verb-game-time')).toBeTruthy()
    expect(screen.queryByTestId('verb-game-builder')).toBeNull()
  })

  it('renders nothing for a verb that is not verified', () => {
    const { container } = render(<VerbGames verb={verbRu('писать', { status: 'generated' })} />)

    expect(container.innerHTML).toBe('')
  })

  it('opens a game full-screen and returns to the card on exit', () => {
    render(<VerbGames verb={verbRu('писать')} />)
    expect(screen.queryByTestId('verb-game-screen')).toBeNull()

    fireEvent.click(screen.getByTestId('verb-game-bones'))

    expect(screen.getByTestId('verb-game-screen').textContent).toContain('Косточки')

    fireEvent.click(screen.getByLabelText('Закрыть'))

    expect(screen.queryByTestId('verb-game-screen')).toBeNull()
    expect(screen.getByTestId('verb-games')).toBeTruthy()
  })

  it('asks the model verb for a decoy preverb only when the constructor is opened', async () => {
    const { fetchVerb } = await import('../../api')
    const verb = verbRu('писать')
    render(<VerbGames verb={verb} />)
    expect(fetchVerb).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('verb-game-builder'))

    await waitFor(() => expect(fetchVerb).toHaveBeenCalledWith(verb.model!.id))
  })
})

describe('VerbSheet with games', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('shows the games row on the card of a verified verb and keeps the card open while a game is played', async () => {
    await mockCard()
    const onClose = vi.fn()
    render(<VerbSheet verbId={verbRu('писать').id} onClose={onClose} />)
    await waitFor(() => screen.getByTestId('verb-games'))

    fireEvent.click(screen.getByTestId('verb-game-time'))
    expect(screen.getByTestId('verb-game-screen')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Закрыть'))

    expect(screen.getByTestId('verb-sheet')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps the game open when the screen under the card re-renders', async () => {
    await mockCard()
    const id = verbRu('писать').id
    const { rerender } = render(<VerbSheet verbId={id} onClose={() => {}} />)
    await waitFor(() => screen.getByTestId('verb-games'))
    fireEvent.click(screen.getByTestId('verb-game-bones'))

    rerender(<VerbSheet verbId={id} onClose={() => {}} />)

    expect(screen.getByTestId('verb-game-screen').textContent).toContain('Косточки')
  })

  it('shows no games row for an unreviewed verb', async () => {
    await mockCard(verbRu('писать', { status: 'generated' }))
    render(<VerbSheet verbId={verbRu('писать').id} onClose={() => {}} />)

    await waitFor(() => screen.getByTestId('verb-tense-present'))

    expect(screen.queryByTestId('verb-games')).toBeNull()
  })
})
