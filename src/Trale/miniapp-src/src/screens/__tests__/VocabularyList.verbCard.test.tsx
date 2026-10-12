import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabularyList from '../VocabularyList'
import type { ProgressState } from '../../types'
import { verbRu } from '../../verbs/testing/catalog'
import { formCard, infinitiveCard } from '../../verbs/testing/translationCard'
import { resetSeenHints } from '../../verbs/ui/hints'

// Перевод слова в словаре: глагол базы приходит карточкой с формами, обычное слово — как раньше.

const translateWord = vi.fn()
const vocabulary = vi.fn()
const fetchVerb = vi.fn()

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  const sheet = (await import('../../verbs/testing/sheetApi')).sheetApi({ fetchVerb: (id: string) => fetchVerb(id) })
  return {
    ...actual, ...sheet,
    api: { ...actual.api, vocabulary: () => vocabulary(), translateWord: (w: string) => translateWord(w) }
  }
})
vi.mock('../../verbs/ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), burst: vi.fn(), haptic: vi.fn(), floater: vi.fn() }))

const word = { id: '1', word: 'стол', definition: 'перевод', additionalInfo: '', example: '', dateAddedUtc: '2026-10-01T00:00:00Z',
  successCount: 0, successReverseCount: 0, failedCount: 0, mastery: 'new', isStarter: false, verb: null }

async function translate(text: string) {
  render(<VocabularyList progress={{} as ProgressState} navigate={vi.fn()} />)
  const input = (await screen.findByPlaceholderText('слово на русском или грузинском')) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(input.parentElement!.querySelector('button')!)
  await waitFor(() => expect(translateWord).toHaveBeenCalled())
}

describe('VocabularyList: a translated verb comes as a card', () => {
  beforeEach(() => {
    [translateWord, vocabulary, fetchVerb].forEach(f => f.mockReset())
    vocabulary.mockResolvedValue({ language: 'Georgian', items: [word], verbs: [], starterItems: [] })
    resetSeenHints()
  })

  it('a Russian infinitive shows the verb card instead of one word, and the first own verb is still celebrated', async () => {
    const walk = verbRu('ходить')
    translateWord.mockResolvedValue({ status: 'success', word: 'ходить', definition: walk.title, verb: null, verbCard: infinitiveCard('ходить') })
    await translate('ходить')

    const card = await screen.findByTestId('verb-translation-card')
    expect(card.getAttribute('data-kind')).toBe('infinitive')
    expect(card.textContent).toContain('я хожу')
    expect(card.textContent).toContain(walk.tenses.present![0][0])
    expect(screen.queryByText('✓ добавлено в словарь')).toBeNull()
    expect(screen.queryByTestId('verb-hint')).toBeNull()
    expect((await screen.findByTestId('own-verb-unlocked')).textContent).toContain('Глагол «ходить» открыт!')
  })

  it('«Открыть в глаголах» opens the verb screen of that verb, for a form — on its cell', async () => {
    const find = verbRu('находить')
    fetchVerb.mockResolvedValue(find)
    translateWord.mockResolvedValue({ status: 'exists', word: find.tenses.present![0][0], definition: 'я нахожу', verb: null, verbCard: formCard(find, [['present', 0]]) })
    await translate(find.tenses.present![0][0])

    fireEvent.click(await screen.findByTestId('verb-card-open'))

    await screen.findByTestId('verb-sheet')
    expect(fetchVerb).toHaveBeenCalledWith(find.id)
  })

  it('a word that is not a verb of the base looks as before', async () => {
    translateWord.mockResolvedValue({ status: 'success', word: 'окно', definition: 'перевод', verb: null, verbCard: null })
    await translate('окно')

    await screen.findByText('✓ добавлено в словарь')
    expect(screen.queryByTestId('verb-translation-card')).toBeNull()
  })
})
