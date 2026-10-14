import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Morph from './Morph'
import Assemble from './Assemble'
import Finale from './Finale'
import { mixPieces } from './logic'

beforeEach(() => { vi.useRealTimers(); localStorage.clear() })

const choice = (l: string) => screen.getAllByTestId('morph-choice').find(b => b.getAttribute('aria-label') === l)!

describe('Morph', () => {
  it('turns the Russian letters into Georgian one by one and ends with the reading', () => {
    const onDone = vi.fn()
    render(<Morph lesson={3} fraction={0.5} onExit={() => {}} onDone={onDone} words={['мама']} />)
    for (const p of mixPieces('мама', 3)) {
      expect(screen.getByText(new RegExp(`это «`))).toBeTruthy()
      fireEvent.click(choice(p.geo!))
    }
    expect(screen.getAllByTestId(/morph-tile-/).every(t => t.dataset.turned === 'yes')).toBe(true)
    expect(screen.getByText('читается «мама»')).toBeTruthy()
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('leaves the tile Russian on a wrong letter and points to the right one after two misses', () => {
    render(<Morph lesson={1} fraction={0.5} onExit={() => {}} onDone={() => {}} words={['вода']} />)
    // Первая превращаемая буква — «д» → დ; ошибаемся буквой ა.
    fireEvent.click(choice('ა'))
    expect(screen.getByTestId('morph-tile-2').dataset.turned).toBe('no')
    fireEvent.click(choice('რ'))
    expect(choice('დ').className).toContain('ring-gold')
    fireEvent.click(choice('დ'))
    expect(screen.getByTestId('morph-tile-2').dataset.turned).toBe('yes')
  })
})

describe('Assemble', () => {
  it('collects the word from tiles in order, then shows it with the translation', async () => {
    const onDone = vi.fn()
    const rounds = [{ word: { geo: 'დედა', ru: 'мама', lesson: 2 }, letters: ['დ', 'ე', 'დ', 'ა'], tiles: ['ა', 'დ', 'ს', 'ე', 'დ'] }]
    render(<Assemble lesson={2} fraction={1} onExit={() => {}} onDone={onDone} rounds={rounds} />)
    expect(screen.getByTestId('assemble-ask').textContent).toContain('мама')
    expect(screen.getByTestId('assemble-ask').textContent).toContain('дэда')

    const tile = (l: string) => screen.getAllByTestId('assemble-tile').find(b => b.getAttribute('aria-label') === l && !(b as HTMLButtonElement).disabled)!
    // Не та буква — ничего не встаёт.
    fireEvent.click(tile('ს'))
    expect(screen.getAllByTestId('assemble-tile').filter(b => (b as HTMLButtonElement).disabled)).toHaveLength(0)

    for (const l of ['დ', 'ე', 'დ', 'ა']) await act(async () => { fireEvent.click(tile(l)) })
    expect(screen.getByTestId('assemble-slots').textContent).toBe('დედა')
    expect(screen.getByText('«дэда» — мама')).toBeTruthy()
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })
})

describe('Finale', () => {
  it('puts the lesson letters into «Мой алфавит», counts the words and invites to the cafe', async () => {
    vi.useFakeTimers()
    const onCafe = vi.fn()
    render(<Finale lesson={2} onNext={() => {}} onCafe={onCafe} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByTestId('finale-letters').textContent).toBe('6 из 33')
    expect(screen.getByTestId('finale-words').textContent).toBe('9 грузинских слов')
    expect(screen.getAllByTestId('finale-cell').filter(c => c.dataset.on === 'yes')).toHaveLength(6)
    fireEvent.click(screen.getByText(/в кафе Бомборы/))
    expect(onCafe).toHaveBeenCalled()
  })
})
