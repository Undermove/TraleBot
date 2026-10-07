import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabularyList from '../VocabularyList'
import type { ProgressState } from '../../types'

// Перевод из словаря: «это не слово» — одна спокойная строка, а не ошибка и не сохранённая запись.

const translateWord = vi.fn()
const vocabulary = vi.fn()

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return { ...actual, api: { ...actual.api, vocabulary: () => vocabulary(), translateWord: (w: string) => translateWord(w) } }
})

const word = { id: '1', word: 'стол', definition: 'перевод', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null }

async function open() {
  render(<VocabularyList progress={{} as ProgressState} navigate={vi.fn()} />)
  return (await screen.findByPlaceholderText('слово на русском или грузинском')) as HTMLInputElement
}

async function translate(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  if (!translateWord.mock.calls.length) fireEvent.click(input.parentElement!.querySelector('button')!)
  await waitFor(() => expect(translateWord).toHaveBeenCalledWith(text))
}

describe('VocabularyList: text that is not a word', () => {
  beforeEach(() => {
    translateWord.mockReset()
    vocabulary.mockReset()
    vocabulary.mockResolvedValue({ language: 'Georgian', items: [word], verbs: [], starterItems: [] })
  })

  it('shows one quiet line for status not_a_word, not the error and not a result', async () => {
    translateWord.mockResolvedValue({ status: 'not_a_word' })
    const input = await open()

    await translate(input, 'ываыва')

    const line = await screen.findByTestId('translate-not-a-word')
    expect(line.textContent).toContain('Это не похоже на слово для перевода')
    expect(line.className).not.toContain('ruby')
    expect(screen.queryByText(/Не удалось перевести/)).toBeNull()
    // Словарь не перечитывается: сохранять нечего.
    expect(vocabulary).toHaveBeenCalledTimes(1)
  })

  it('keeps the error line for a real failure', async () => {
    translateWord.mockResolvedValue({ status: 'failure' })
    const input = await open()

    await translate(input, 'table')

    expect(await screen.findByText(/Не удалось перевести/)).toBeTruthy()
    expect(screen.queryByTestId('translate-not-a-word')).toBeNull()
  })
})
