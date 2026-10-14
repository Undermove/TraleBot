import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Morph from './Morph'
import Assemble from './Assemble'
import Finale from './Finale'
import { morphPieces } from './logic'
import { api } from '../../api'

beforeEach(() => { vi.useRealTimers(); localStorage.clear() })

const choice = (l: string) => screen.getAllByTestId('morph-choice').find(b => b.getAttribute('aria-label') === l)!

describe('Morph', () => {
  it('turns the Cyrillic sound of a real word into Georgian letters and ends with the meaning', () => {
    const onDone = vi.fn()
    render(<Morph lesson={3} fraction={0.5} onExit={() => {}} onDone={onDone} words={[{ geo: 'მამა', ru: 'папа', lesson: 3 }]} />)
    expect(screen.getByTestId('morph-word').textContent).toBe('мама')
    for (const p of morphPieces('მამა')) fireEvent.click(choice(p.geo!))
    expect(screen.getAllByTestId(/morph-tile-/).every(t => t.dataset.turned === 'yes')).toBe(true)
    expect(screen.getByTestId('morph-meaning').textContent).toBe('«мама» — папа')
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('keeps the sound on a wrong letter and points to the right one after two misses', () => {
    render(<Morph lesson={2} fraction={0.5} onExit={() => {}} onDone={() => {}} words={[{ geo: 'დედა', ru: 'мама', lesson: 2 }]} />)
    const wrong = () => screen.getAllByTestId('morph-choice').find(b => b.getAttribute('aria-label') !== 'დ')!
    fireEvent.click(wrong())
    expect(screen.getByTestId('morph-tile-0').dataset.turned).toBe('no')
    fireEvent.click(wrong())
    expect(choice('დ').className).toContain('ring-gold')
    fireEvent.click(choice('დ'))
    expect(screen.getByTestId('morph-tile-0').dataset.turned).toBe('yes')
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
  it('puts the lesson letters into «Мой алфавит», counts the words and flies the lesson words into the dictionary', async () => {
    vi.useFakeTimers()
    const add = vi.spyOn(api, 'addAlphabetWords').mockResolvedValue({ words: [{ word: 'სად', translation: 'где', added: true }, { word: 'ეს', translation: 'это', added: true }], added: 2 })
    const onNext = vi.fn(), onVocabulary = vi.fn()
    render(<Finale lesson={2} onNext={onNext} onVocabulary={onVocabulary} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(add).toHaveBeenCalledWith(2)
    expect(screen.getByTestId('finale-letters').textContent).toBe('6 из 33')
    expect(screen.getByTestId('finale-words').textContent).toBe('9 грузинских слов')
    expect(screen.getAllByTestId('finale-cell').filter(c => c.dataset.on === 'yes')).toHaveLength(6)
    expect(screen.getByTestId('finale-dict').textContent).toContain('Эти слова теперь в твоём словаре')
    expect(screen.getByTestId('dict-count').textContent).toBe('2')
    expect(screen.getAllByTestId('finale-dict-word').every(w => w.dataset.in === 'yes')).toBe(true)
    fireEvent.click(screen.getByText('открыть словарь'))
    expect(onVocabulary).toHaveBeenCalled()
    fireEvent.click(screen.getByText('итог →'))
    expect(onNext).toHaveBeenCalled()
  })

  it('still celebrates when the words could not be added', async () => {
    vi.useFakeTimers()
    vi.spyOn(api, 'addAlphabetWords').mockRejectedValue(new Error('offline'))
    render(<Finale lesson={1} onNext={() => {}} onVocabulary={() => {}} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.queryByTestId('finale-dict')).toBeNull()
    expect(screen.getByText('итог →')).toBeTruthy()
  })
})
