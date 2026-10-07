import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabularyList from '../VocabularyList'
import type { ProgressState } from '../../types'
import type { TranslateProgress } from '../../api'
import { resetTranslationRun } from '../../translation/translationRun'

// Пока слово переводится, экран не молчит: с первой секунды виден блок «идёт работа» со строкой
// о текущем шаге (шаг сообщает сервер), а когда ответ готов — обычная карточка результата.

type OnProgress = (p: TranslateProgress) => void
const translateWord = vi.fn()
const vocabulary = vi.fn()

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return {
    ...actual,
    api: { ...actual.api, vocabulary: () => vocabulary(), translateWord: (w: string, p?: OnProgress) => translateWord(w, p) }
  }
})

const word = { id: '1', word: 'стол', definition: 'перевод', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null }

const at = (stage: TranslateProgress['stage'], verbLookup = false, slow = false): TranslateProgress => ({ stage, verbLookup, slow })

async function openScreen() {
  const view = render(<VocabularyList progress={{} as ProgressState} navigate={vi.fn()} />)
  const input = (await screen.findByPlaceholderText('слово на русском или грузинском')) as HTMLInputElement
  return { ...view, input }
}

/** Запускает перевод и отдаёт то, чем api сообщает экрану о ходе дела. */
async function startTranslation(text: string) {
  let finish!: (r: unknown) => void
  translateWord.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const view = await openScreen()
  fireEvent.change(view.input, { target: { value: text } })
  fireEvent.click(view.input.parentElement!.querySelector('button')!)
  await waitFor(() => expect(translateWord).toHaveBeenCalled())
  const onProgress = translateWord.mock.calls[0][1] as OnProgress
  return { ...view, progress: (p: TranslateProgress) => act(() => onProgress(p)), finish: (r: unknown) => act(async () => finish(r)) }
}

const stage = () => screen.getByTestId('translate-stage').textContent
const step = () => screen.getByTestId('translate-step').textContent
const note = () => screen.getByTestId('translate-note').textContent

describe('VocabularyList: while a word is being translated', () => {
  beforeEach(() => {
    resetTranslationRun()
    translateWord.mockReset()
    vocabulary.mockReset()
    vocabulary.mockResolvedValue({ language: 'Georgian', items: [word], verbs: [], starterItems: [] })
  })

  it('shows that work is going on from the first moment, before the server has said anything', async () => {
    await startTranslation('окно')

    expect(screen.getByTestId('translate-pending').getAttribute('role')).toBe('status')
    expect(stage()).toBe('Ищу перевод')
    expect(step()).toBe('перевожу')
    expect(screen.queryAllByTestId('translate-seg')).toHaveLength(0)
  })

  it('names the step an ordinary word is at and shows no verb steps for it', async () => {
    const { progress } = await startTranslation('окно')

    progress(at('base'))
    expect(stage()).toBe('Смотрю в нашей базе')
    progress(at('recognizing'))
    expect(stage()).toBe('Разбираюсь, что за слово')
    progress(at('dictionaries'))
    expect(stage()).toBe('Ищу перевод в словарях')
    progress(at('saving'))
    expect(stage()).toBe('Сохраняю в твой словарь')

    expect(step()).toBe('перевожу')
    expect(screen.queryAllByTestId('translate-seg')).toHaveLength(0)
    expect(screen.getByTestId('translate-pending').textContent).not.toMatch(/глагол|форм|минут/)
  })

  it('says so when an ordinary word takes longer than usual', async () => {
    const { progress } = await startTranslation('окно')
    expect(note()).toBe('Обычно это пара секунд.')

    progress(at('dictionaries', false, true))

    expect(note()).toBe('Чуть дольше обычного, ещё немного…')
  })

  it('walks a new verb through its steps by count and keeps «до минуты» in sight', async () => {
    const { progress } = await startTranslation('глокать')

    progress(at('verb-source', true))
    expect(stage()).toBe('Ищу этот глагол в словарях')
    expect(step()).toBe('шаг 2 из 5')
    expect(note()).toContain('до минуты')
    expect(note()).toContain('Перевод появится здесь и в словаре')

    progress(at('verb-forms', true, true))
    expect(stage()).toBe('Собираю формы глагола')
    expect(step()).toBe('шаг 3 из 5')

    progress(at('verb-review', true, true))
    expect(stage()).toBe('Перепроверяю каждую форму')
    expect(step()).toBe('шаг 4 из 5')
    expect(screen.getAllByTestId('translate-seg').map((s) => s.getAttribute('data-state')))
      .toEqual(['done', 'done', 'done', 'now', 'next'])

    progress(at('saving', true, true))
    expect(stage()).toBe('Сохраняю в твой словарь')
    expect(step()).toBe('шаг 5 из 5')
    expect(note()).toContain('до минуты')
    expect(screen.getByTestId('translate-pending').className).not.toContain('ruby')
    expect(screen.queryByText(/Не удалось перевести/)).toBeNull()
  })

  it('still says a verb is being looked up when the server that answers does not know the step', async () => {
    const { progress } = await startTranslation('глокать')

    progress(at(null, true, true))

    expect(stage()).toBe('Ищу этот глагол в словарях')
    expect(step()).toBe('шаг 2 из 5')
  })

  it('lets the person type the next word while the first one is still being translated', async () => {
    const { input, progress } = await startTranslation('глокать')
    progress(at('verb-forms', true, true))

    expect(input.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'окно' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(stage()).toBe('Собираю формы глагола')
    expect(translateWord).toHaveBeenCalledTimes(1)
  })

  it('replaces the block with the result when the answer arrives', async () => {
    const { input, progress, finish } = await startTranslation('глокать')
    progress(at('verb-review', true, true))

    await finish({ status: 'success', word: 'глокать', definition: 'перевод', additionalInfo: '', example: '', verb: null })

    expect(await screen.findByText(/добавлено в словарь/)).toBeTruthy()
    expect(screen.getByTestId('translate-result').textContent).toContain('глокать')
    expect(screen.queryByTestId('translate-pending')).toBeNull()
    expect(input.value).toBe('')
    // Словарь перечитан: слово в нём появилось.
    await waitFor(() => expect(vocabulary).toHaveBeenCalledTimes(2))
  })

  it('keeps what the person has typed meanwhile when the answer arrives', async () => {
    const { input, finish } = await startTranslation('глокать')
    fireEvent.change(input, { target: { value: 'окно' } })

    await finish({ status: 'success', word: 'глокать', definition: 'перевод', additionalInfo: '', example: '', verb: null })

    expect(screen.getByTestId('translate-result')).toBeTruthy()
    expect(input.value).toBe('окно')
  })

  it('keeps the work in sight after the person left the screen and came back', async () => {
    const { unmount, progress, finish } = await startTranslation('глокать')
    progress(at('verb-forms', true, true))

    unmount()
    await openScreen()

    expect(stage()).toBe('Собираю формы глагола')
    expect(step()).toBe('шаг 3 из 5')

    progress(at('verb-review', true, true))
    expect(stage()).toBe('Перепроверяю каждую форму')

    await finish({ status: 'success', word: 'глокать', definition: 'перевод', additionalInfo: '', example: '', verb: null })
    expect(screen.getByTestId('translate-result').textContent).toContain('глокать')
  })

  it('shows the answer that arrived while the person was on another screen', async () => {
    const { unmount, finish } = await startTranslation('глокать')

    unmount()
    await finish({ status: 'success', word: 'глокать', definition: 'перевод', additionalInfo: '', example: '', verb: null })
    await openScreen()

    expect(screen.getByTestId('translate-result').textContent).toContain('глокать')
    expect(screen.queryByTestId('translate-pending')).toBeNull()
  })

  it('says so calmly when the mini-app stopped waiting', async () => {
    const { progress, finish } = await startTranslation('глокать')
    progress(at('verb-forms', true, true))

    await finish({ status: 'timeout' })

    expect(screen.getByTestId('translate-timeout').textContent).toContain('Не успел найти перевод')
    expect(screen.queryByTestId('translate-pending')).toBeNull()
    expect(screen.queryByText(/Не удалось перевести/)).toBeNull()
  })

  it('keeps the error line for a failure', async () => {
    const { finish } = await startTranslation('глокать')

    await finish({ status: 'failure' })

    expect(screen.getByText('Не удалось перевести. Попробуй другое слово.')).toBeTruthy()
    expect(screen.queryByTestId('translate-pending')).toBeNull()
  })
})
