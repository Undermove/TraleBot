import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminVerbs as mocked, ApiError } from '../../api'
import catalog from '../../../../Verbs/verbs.json'
import ModelVerbsPanel from './ModelVerbsPanel'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  adminVerbs: { modelMade: vi.fn(), regenerate: vi.fn() }
}))
const api = vi.mocked(mocked)

// Грузинское — только из каталога.
const [full, poor] = (catalog as { verbs: { lemma: string; ru: string }[] }).verbs.slice(0, 2).map(v => v.lemma)

const row = (lemma: string, mainTenses: number, missing: { tense: string; why: 'verb-lacks-it' | 'not-sure'; reviewerDisagrees?: boolean }[] = []) => ({
  lemma, title: lemma, translation: lemma === poor ? 'лежать' : 'танцевать', askedText: 'лежу', approvedAtUtc: '2026-10-07T10:00:00Z',
  learners: lemma === poor ? 2 : 0, mainTenses, completedTenses: [],
  missingTenses: missing.map(m => ({ note: null, reviewerDisagrees: false, ...m }))
})

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.modelMade.mockResolvedValue({
    count: 2,
    verbs: [row(full, 6), row(poor, 2, [{ tense: 'future', why: 'not-sure' }, { tense: 'aorist', why: 'verb-lacks-it', reviewerDisagrees: true }])]
  })
})

async function open() {
  render(<ModelVerbsPanel />)
  expect(api.modelMade).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Показать список' }))
  return within(await screen.findByTestId(`model-verb-${poor}`))
}

describe('ModelVerbsPanel', () => {
  it('lists the verbs on demand, the poorest first, with how many tenses each has and why the rest are missing', async () => {
    const card = await open()
    expect(card.getByText('2 из 6 времён')).toBeTruthy()
    expect(card.getByText('нет: Будущее — модель не уверена')).toBeTruthy()
    expect(card.getByText('нет: Прошедшее: сделал — у глагола его нет, проверяющая считает, что есть')).toBeTruthy()
    expect(card.getByText('учат: 2')).toBeTruthy()
    const rows = screen.getAllByTestId(/^model-verb-/)
    expect(rows[0].getAttribute('data-testid')).toBe(`model-verb-${poor}`)
    expect(within(rows[1]).getByText('6 из 6 времён')).toBeTruthy()
  })

  it('«Пересобрать» rebuilds the verb, says what changed and reloads the list', async () => {
    api.regenerate.mockResolvedValue({ outcome: 'replaced', mainTensesBefore: 2, mainTensesAfter: 6, changedForms: [] })
    const card = await open()
    api.modelMade.mockResolvedValue({ count: 2, verbs: [row(full, 6), row(poor, 6)] })
    await userEvent.click(card.getByRole('button', { name: 'Пересобрать' }))
    expect(api.regenerate).toHaveBeenCalledWith(poor)
    await waitFor(() => expect(screen.getByText('готово: было 2 из 6, стало 6 из 6')).toBeTruthy())
    expect(within(screen.getByTestId(`model-verb-${poor}`)).getByText('6 из 6 времён')).toBeTruthy()
  })

  it('says so when the old record was kept, and when the connection dropped while the server goes on', async () => {
    api.regenerate.mockResolvedValueOnce({ outcome: 'kept', reason: 'fewer-tenses', mainTensesBefore: 2, mainTensesAfter: 1 })
    const card = await open()
    await userEvent.click(card.getByRole('button', { name: 'Пересобрать' }))
    await waitFor(() => expect(screen.getByText('оставлена прежняя запись: новая запись вышла беднее')).toBeTruthy())

    api.regenerate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await userEvent.click(within(screen.getByTestId(`model-verb-${poor}`)).getByRole('button', { name: 'Пересобрать' }))
    await waitFor(() => expect(screen.getByText('связь оборвалась, пересборка продолжается — обнови список через минуту')).toBeTruthy())

    api.regenerate.mockRejectedValueOnce(new ApiError(429, '{}'))
    await userEvent.click(within(screen.getByTestId(`model-verb-${poor}`)).getByRole('button', { name: 'Пересобрать' }))
    await waitFor(() => expect(screen.getByText('дневной лимит составления глаголов исчерпан')).toBeTruthy())
  })
})
