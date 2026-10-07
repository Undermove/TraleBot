import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabularyList from '../VocabularyList'
import type { ProgressState } from '../../types'

// Перевод, который не пришёл сразу: вместо молчаливого «...» — строка о том, что глагол ищется,
// а когда ответ готов — обычная карточка результата.

type OnPending = (verbLookup: boolean) => void
const translateWord = vi.fn()
const vocabulary = vi.fn()

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return {
    ...actual,
    api: { ...actual.api, vocabulary: () => vocabulary(), translateWord: (w: string, p?: OnPending) => translateWord(w, p) }
  }
})

const word = { id: '1', word: 'стол', definition: 'перевод', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null }

/** Запускает перевод и отдаёт то, чем api сообщает экрану о ходе дела. */
async function startTranslation(text: string) {
  let finish!: (r: unknown) => void
  translateWord.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  render(<VocabularyList progress={{} as ProgressState} navigate={vi.fn()} />)
  const input = (await screen.findByPlaceholderText('слово на русском или грузинском')) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(input.parentElement!.querySelector('button')!)
  await waitFor(() => expect(translateWord).toHaveBeenCalled())
  const onPending = translateWord.mock.calls[0][1] as OnPending
  return { onPending, finish: (r: unknown) => act(async () => finish(r)) }
}

describe('VocabularyList: a translation that takes long', () => {
  beforeEach(() => {
    translateWord.mockReset()
    vocabulary.mockReset()
    vocabulary.mockResolvedValue({ language: 'Georgian', items: [word], verbs: [], starterItems: [] })
  })

  it('shows nothing extra while a translation is simply in flight', async () => {
    await startTranslation('окно')

    expect(screen.queryByTestId('translate-pending')).toBeNull()
  })

  it('says that the verb is being looked up and that it can take up to a minute', async () => {
    const { onPending } = await startTranslation('глокать')

    act(() => onPending(true))

    const line = screen.getByTestId('translate-pending')
    expect(line.textContent).toContain('Ищу этот глагол')
    expect(line.textContent).toContain('до минуты')
    expect(line.className).not.toContain('ruby')
    expect(screen.queryByText(/Не удалось перевести/)).toBeNull()
  })

  it('does not mention a verb when the answer is merely slow', async () => {
    const { onPending } = await startTranslation('окно')

    act(() => onPending(false))

    expect(screen.getByTestId('translate-pending').textContent).toBe('Перевожу, ещё немного…')
  })

  it('replaces the pending line with the result when the answer arrives', async () => {
    const { onPending, finish } = await startTranslation('глокать')
    act(() => onPending(true))

    await finish({ status: 'success', word: 'глокать', definition: 'перевод', additionalInfo: '', example: '', verb: null })

    expect(await screen.findByText(/добавлено в словарь/)).toBeTruthy()
    expect(screen.queryByTestId('translate-pending')).toBeNull()
    // Словарь перечитан: слово в нём появилось.
    await waitFor(() => expect(vocabulary).toHaveBeenCalledTimes(2))
  })

  it('says so calmly when the mini-app stopped waiting', async () => {
    const { onPending, finish } = await startTranslation('глокать')
    act(() => onPending(true))

    await finish({ status: 'timeout' })

    expect(screen.getByTestId('translate-timeout').textContent).toContain('Не успел найти перевод')
    expect(screen.queryByTestId('translate-pending')).toBeNull()
    expect(screen.queryByText(/Не удалось перевести/)).toBeNull()
  })
})
