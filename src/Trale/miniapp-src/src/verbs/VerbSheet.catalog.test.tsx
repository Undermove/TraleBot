import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerbSheet from './VerbSheet'
import { storyFixture } from './story/fixture'
import { verbByLemma } from './testing/catalog'
import { rulesSeen } from './testing/seen'
import { closeTopOverlay, hasOverlay } from './ui/overlayStack'
import type { VerbDto } from './types'
import * as mockedApi from '../api'

// Карточка целиком на глаголах настоящего каталога: вход в лесенку, таблица, игры, комикс —
// и что из этого остаётся у неполного и у непроверенного глагола.

vi.mock('../api', async () => (await import('./testing/sheetApi')).sheetApi())
const api = vi.mocked(mockedApi)

async function open(verb: VerbDto) {
  api.fetchVerb.mockResolvedValue(verb)
  const onClose = vi.fn()
  render(<VerbSheet verbId={verb.id} onClose={onClose} />)
  await screen.findByTestId('verb-tense-present')
  return onClose
}

const order = (...nodes: Element[]) => nodes.every((n, i) => i === 0 || !!(nodes[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))

describe('VerbSheet on catalog verbs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    api.fetchVerbStories.mockResolvedValue({ stories: [] })
  })

  it('puts what matters first: the learn button, then the table; games and the comic come after', async () => {
    api.fetchVerbStories.mockResolvedValue({ stories: [storyFixture] })
    await open(verbByLemma('მიდის'))

    const learn = await screen.findByText('Выучить играя')
    const story = await screen.findByTestId(`verb-story-${storyFixture.id}`)

    expect(order(learn, screen.getByTestId('verb-tense-present'), screen.getByTestId('verb-games'), story, screen.getByText(/Источник форм/))).toBe(true)
  })

  it('shows a partial verb with the tenses it has, says which are missing, and still offers to learn it', async () => {
    // «хотеть»: только настоящее и имперфект.
    await open(verbByLemma('უნდა'))

    expect(screen.getByTestId('verb-tense-imperfect')).toBeTruthy()
    for (const missing of ['aorist', 'optative', 'conditional', 'future']) expect(screen.queryByTestId(`verb-tense-${missing}`)).toBeNull()
    expect(screen.getByTestId('verb-partial').textContent).toContain('аорист, конъюнктив аориста, условное, будущее')
    expect(await screen.findByText('Выучить играя')).toBeTruthy()
    expect(screen.queryByTestId('verb-games')).toBeNull()

    fireEvent.click(screen.getByTestId('verb-rare-toggle'))
    expect(screen.getByTestId('verb-tense-presentSubjunctive')).toBeTruthy()
    expect(screen.queryByTestId('verb-tense-perfect')).toBeNull()
  })

  it('has no «missing tenses» note on a full verb', async () => {
    await open(verbByLemma('წერს'))

    expect(screen.queryByTestId('verb-partial')).toBeNull()
  })

  it('offers neither the ladder nor games on an unverified verb and does not ask for its progress', async () => {
    await open(verbByLemma('წერს', { status: 'generated', source: null }))
    await act(async () => {})

    expect(screen.getByTestId('verb-unverified')).toBeTruthy()
    expect(screen.queryByText('Выучить играя')).toBeNull()
    expect(screen.queryByTestId('verb-games')).toBeNull()
    expect(api.fetchVerbProgress).not.toHaveBeenCalled()
  })

  it('Back closes the layers from the top: rules, then the ladder, then the card', async () => {
    const onClose = await open(verbByLemma('წერს'))
    fireEvent.click(await screen.findByText('Выучить играя'))
    expect(screen.getByText(/Как играть · 1 из/)).toBeTruthy()

    act(() => { closeTopOverlay() })
    expect(screen.queryByText(/Как играть · 1 из/)).toBeNull()
    expect(screen.getByTestId('verb-ladder')).toBeTruthy()

    act(() => { closeTopOverlay() })
    expect(screen.queryByTestId('verb-ladder')).toBeNull()
    expect(screen.getByTestId('verb-sheet')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    act(() => { closeTopOverlay() })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Back closes an open game or comic before the card', async () => {
    api.fetchVerbStories.mockResolvedValue({ stories: [storyFixture] })
    rulesSeen('story'); rulesSeen('verb_bones')
    const onClose = await open(verbByLemma('მიდის'))

    fireEvent.click(screen.getByTestId('verb-game-bones'))
    act(() => { closeTopOverlay() })
    expect(screen.queryByTestId('verb-game-screen')).toBeNull()

    fireEvent.click(await screen.findByTestId(`verb-story-${storyFixture.id}`))
    expect(screen.getByTestId('story-reader')).toBeTruthy()
    act(() => { closeTopOverlay() })
    expect(screen.queryByTestId('story-reader')).toBeNull()

    expect(onClose).not.toHaveBeenCalled()
    expect(hasOverlay()).toBe(true)
  })
})
