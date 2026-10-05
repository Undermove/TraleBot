import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerbSheet from './VerbSheet'
import { storyFixture } from './story/fixture'
import { verbByLemma } from './testing/catalog'
import { rulesSeen } from './testing/seen'
import { closeTopOverlay, hasOverlay } from './ui/overlayStack'
import type { VerbDto } from './types'
import * as mockedApi from '../api'

// Карточка целиком на глаголах настоящего каталога: уровень и вход в сессию, таблица —
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

  it('puts what matters first: level and one play button, then the table; no games row and no comic cover', async () => {
    api.fetchVerbStories.mockResolvedValue({ stories: [storyFixture] })
    await open(verbByLemma('მიდის'))

    const learn = await screen.findByText('Выучить играя')

    expect(order(screen.getByTestId('verb-level'), learn, screen.getByTestId('verb-tense-present'), screen.getByText(/Источник форм/))).toBe(true)
    expect(screen.getByTestId('session-entry-about').textContent).toContain('2–3 минуты')
    expect(screen.queryByTestId('verb-games')).toBeNull()
    expect(screen.queryByTestId(`verb-story-${storyFixture.id}`)).toBeNull()
  })

  it('shows a partial verb with the tenses it has, says which are missing, and still offers to learn it', async () => {
    // «хотеть»: только настоящее и имперфект.
    await open(verbByLemma('უნდა'))

    expect(screen.getByTestId('verb-tense-imperfect')).toBeTruthy()
    for (const missing of ['aorist', 'optative', 'conditional', 'future']) expect(screen.queryByTestId(`verb-tense-${missing}`)).toBeNull()
    expect(screen.getByTestId('verb-partial').textContent).toContain('прошедшее: сделал, надо сделать, сделал бы, будущее')
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

  it('offers no play on an unverified verb and does not ask for its progress', async () => {
    await open(verbByLemma('წერს', { status: 'generated', source: null }))
    await act(async () => {})

    expect(screen.getByTestId('verb-unverified')).toBeTruthy()
    expect(screen.queryByText('Выучить играя')).toBeNull()
    expect(screen.queryByTestId('verb-games')).toBeNull()
    expect(api.fetchVerbLearning).not.toHaveBeenCalled()
  })

  it('Back closes the layers from the top: rules, then the session, then the card', async () => {
    const onClose = await open(verbByLemma('წერს'))
    fireEvent.click(await screen.findByText('Выучить играя'))
    expect(screen.getByText(/Как играть · 1 из/)).toBeTruthy()

    act(() => { closeTopOverlay() })
    expect(screen.queryByText(/Как играть · 1 из/)).toBeNull()
    expect(screen.getByTestId('verb-session')).toBeTruthy()

    act(() => { closeTopOverlay() })
    expect(screen.queryByTestId('verb-session')).toBeNull()
    expect(screen.getByTestId('verb-sheet')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    act(() => { closeTopOverlay() })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a verb with a comic opens its first session on the comic, and Back closes it before the card', async () => {
    api.fetchVerbStories.mockResolvedValue({ stories: [storyFixture] })
    rulesSeen('story')
    const onClose = await open(verbByLemma('მიდის'))

    fireEvent.click(await screen.findByText('Выучить играя'))
    expect(screen.getByTestId('story-reader')).toBeTruthy()
    expect(screen.getByTestId('verb-session').getAttribute('data-scene')).toBe('story')

    act(() => { closeTopOverlay() })
    expect(screen.queryByTestId('story-reader')).toBeNull()
    expect(screen.queryByTestId('verb-session')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(hasOverlay()).toBe(true)
  })
})
