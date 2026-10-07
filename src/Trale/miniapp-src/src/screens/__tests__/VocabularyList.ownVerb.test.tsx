import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabularyList from '../VocabularyList'
import type { ProgressState } from '../../types'
import { CATALOG } from '../../verbs/testing/catalog'
import { resetSeenHints } from '../../verbs/ui/hints'

// Своё переведённое слово впервые оказалось глаголом: один раз — «глагол открыт» и куда он попал.

const translateWord = vi.fn()
const vocabulary = vi.fn()
const markUiHintSeen = vi.fn((_key: string) => Promise.resolve({ ok: true }))

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return {
    ...actual,
    markUiHintSeen: (k: string) => markUiHintSeen(k),
    api: { ...actual.api, vocabulary: () => vocabulary(), translateWord: (w: string) => translateWord(w) }
  }
})
vi.mock('../../verbs/ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), burst: vi.fn(), haptic: vi.fn(), floater: vi.fn() }))

const verb = CATALOG.find(v => v.ru === 'петь')!
const answer = {
  status: 'success', word: 'петь', definition: 'перевод',
  verb: { form: verb.present[0], verbId: verb.id, title: verb.title, ru: verb.ru, tense: 'present', person: 0 }
}
const word = { id: '1', word: 'стол', definition: 'перевод', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null }

async function translate(text: string, navigate = vi.fn()) {
  const view = render(<VocabularyList progress={{} as ProgressState} navigate={navigate} />)
  const input = (await screen.findByPlaceholderText('слово на русском или грузинском')) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(input.parentElement!.querySelector('button')!)
  await waitFor(() => expect(translateWord).toHaveBeenCalled())
  return view
}

describe('VocabularyList: the first own verb', () => {
  beforeEach(() => {
    [translateWord, vocabulary, markUiHintSeen].forEach(f => f.mockReset())
    markUiHintSeen.mockResolvedValue({ ok: true })
    vocabulary.mockResolvedValue({ language: 'Georgian', items: [word], verbs: [], starterItems: [] })
    resetSeenHints()
  })

  it('is celebrated once and points to where the verb now lives', async () => {
    translateWord.mockResolvedValue(answer)
    const navigate = vi.fn()
    const first = await translate('петь', navigate)

    const news = await screen.findByTestId('own-verb-unlocked')
    expect(news.textContent).toContain('Глагол «петь» открыт!')
    expect(news.textContent).toContain('«Моих глаголах»')
    expect(screen.getByTestId('verb-hint')).toBeTruthy()
    fireEvent.click(screen.getByTestId('own-verb-action'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'verbs' })

    first.unmount()
    translateWord.mockClear()
    await translate('петь')
    await screen.findByTestId('verb-hint')
    expect(screen.queryByTestId('own-verb-unlocked')).toBeNull()
  })

  it('an ordinary word brings no celebration', async () => {
    translateWord.mockResolvedValue({ status: 'success', word: 'окно', definition: 'перевод', verb: null })
    await translate('окно')

    await screen.findByText('✓ добавлено в словарь')
    expect(screen.queryByTestId('own-verb-unlocked')).toBeNull()
  })
})
