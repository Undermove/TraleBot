import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminVerbs as mocked, ApiError } from '../../api'
import catalog from '../../../../Verbs/verbs.json'
import { cyr } from '../../verbs/types'
import ModelVerbsPanel from './ModelVerbsPanel'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  adminVerbs: { modelMade: vi.fn(), regenerate: vi.fn(), confirmTense: vi.fn(), editTense: vi.fn(), removeTense: vi.fn() }
}))
const api = vi.mocked(mocked)

// Грузинское — только из каталога.
const verbs = (catalog as { verbs: { lemma: string; ru: string; tenses: Record<string, string[][]> }[] }).verbs
const [full, poor] = verbs.slice(0, 2).map(v => v.lemma)
const write = verbs.find(v => v.ru === 'писать')!
const aorist = write.tenses.aorist.map(c => c[0])
const future = write.tenses.future.map(c => c[0])

const row = (
  lemma: string, mainTenses: number,
  missing: { tense: string; why: 'verb-lacks-it' | 'not-sure' | 'removed-by-owner'; reviewerDisagrees?: boolean }[] = [],
  unverified: { tense: string; cells: string[] }[] = []
) => ({
  lemma, title: lemma, translation: lemma === poor ? 'лежать' : 'танцевать', askedText: 'лежу', approvedAtUtc: '2026-10-07T10:00:00Z',
  learners: lemma === poor ? 2 : 0, mainTenses, completedTenses: [],
  missingTenses: missing.map(m => ({ note: null, reviewerDisagrees: false, ...m })),
  verifiedMainTenses: mainTenses - unverified.length,
  reviewerReasons: unverified.length ? ['Настоящее время подтверждено.'] : [],
  unverifiedTenses: unverified.map((u, n) => ({
    ...u, inTexts: u.cells.map((_, i) => i < 2), phrases: null, completed: n === 0, removedBefore: false
  }))
})

const poorRow = () => row(
  poor, 4,
  [{ tense: 'optative', why: 'not-sure' }, { tense: 'conditional', why: 'verb-lacks-it', reviewerDisagrees: true }],
  [{ tense: 'aorist', cells: aorist }, { tense: 'future', cells: future }])

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.modelMade.mockResolvedValue({ count: 2, verbs: [row(full, 6), poorRow()] })
})

async function open() {
  render(<ModelVerbsPanel />)
  expect(api.modelMade).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Показать список' }))
  return within(await screen.findByTestId(`model-verb-${poor}`))
}

async function review() {
  const card = await open()
  await userEvent.click(card.getByRole('button', { name: 'Проверить времена · 2' }))
  return within(screen.getByTestId('tense-review-aorist'))
}

describe('ModelVerbsPanel', () => {
  it('lists the verbs on demand, the least verified first, with how many tenses each has, how many are verified and why the rest are missing', async () => {
    const card = await open()
    expect(card.getByText('4 из 6 времён, проверено 2')).toBeTruthy()
    expect(card.getByText('нет: Надо сделать — модель не уверена')).toBeTruthy()
    expect(card.getByText('нет: Сделал бы — у глагола его нет, проверяющая считает, что есть')).toBeTruthy()
    expect(card.getByText('учат: 2')).toBeTruthy()
    const rows = screen.getAllByTestId(/^model-verb-/)
    expect(rows[0].getAttribute('data-testid')).toBe(`model-verb-${poor}`)
    expect(within(rows[1]).getByText('6 из 6 времён, проверено 6')).toBeTruthy()
    expect(within(rows[1]).queryByRole('button', { name: /Проверить времена/ })).toBeNull()
  })

  it('«есть непроверенные времена» asks the server for that list only', async () => {
    await open()
    api.modelMade.mockResolvedValue({ count: 1, verbs: [poorRow()] })
    await userEvent.click(screen.getByRole('checkbox', { name: 'есть непроверенные времена' }))
    expect(api.modelMade).toHaveBeenLastCalledWith(true)
    await waitFor(() => expect(screen.queryByTestId(`model-verb-${full}`)).toBeNull())
  })

  it('shows an unverified tense with its six forms, their Cyrillic transcription and which of them real texts have', async () => {
    const tense = await review()
    expect(tense.getByText('Прошедшее: сделал')).toBeTruthy()
    expect(tense.getByText(/в текстах 2 из 6/)).toBeTruthy()
    expect(tense.getByText(/дописано вторым кругом/)).toBeTruthy()
    for (const form of aorist) {
      expect(tense.getByText(form)).toBeTruthy()
      expect(tense.getByText(cyr(form))).toBeTruthy()
    }
    expect(tense.getAllByText(/есть в текстах/)).toHaveLength(2)
    expect(tense.getAllByText(/нет в текстах/)).toHaveLength(4)
    expect(screen.getByText('Проверяющая модель: Настоящее время подтверждено.')).toBeTruthy()
  })

  it('«Подтвердить» makes the tense verified and reloads the list', async () => {
    api.confirmTense.mockResolvedValue({ ok: true, progressReset: 0 })
    const tense = await review()
    await userEvent.click(tense.getByRole('button', { name: 'Подтвердить' }))
    expect(api.confirmTense).toHaveBeenCalledWith(poor, 'aorist')
    await waitFor(() => expect(screen.getByText('Прошедшее: сделал: подтверждено, теперь есть в играх')).toBeTruthy())
    expect(api.modelMade).toHaveBeenCalledTimes(2)
  })

  it('«Исправить» lets the owner rewrite the cells and says when learners lost progress on changed forms', async () => {
    api.editTense.mockResolvedValue({ ok: true, progressReset: 3 })
    const tense = await review()
    await userEvent.click(tense.getByRole('button', { name: 'Исправить' }))
    const first = tense.getByLabelText('Прошедшее: сделал, я') as HTMLInputElement
    expect(first.value).toBe(aorist[0])
    await userEvent.clear(first)
    await userEvent.type(first, future[0])
    await userEvent.clear(tense.getByLabelText('Прошедшее: сделал, вы'))
    await userEvent.click(tense.getByRole('button', { name: 'Сохранить' }))
    expect(api.editTense).toHaveBeenCalledWith(poor, 'aorist', [future[0], aorist[1], aorist[2], aorist[3], null, aorist[5]])
    await waitFor(() => expect(screen.getByText(
      'Прошедшее: сделал: исправлено и проверено; у учеников сброшен прогресс по изменённым формам: 3')).toBeTruthy())
  })

  it('«Убрать время» asks first, and a refused edit says what a cell must be', async () => {
    api.removeTense.mockResolvedValue({ ok: true, progressReset: 0 })
    const tense = await review()
    await userEvent.click(tense.getByRole('button', { name: 'Убрать время' }))
    expect(api.removeTense).not.toHaveBeenCalled()
    await userEvent.click(tense.getByRole('button', { name: 'Убрать' }))
    expect(api.removeTense).toHaveBeenCalledWith(poor, 'aorist')
    await waitFor(() => expect(screen.getByText('Прошедшее: сделал: убрано')).toBeTruthy())

    api.editTense.mockRejectedValue(new ApiError(400, '{}'))
    const again = within(screen.getByTestId('tense-review-future'))
    await userEvent.click(again.getByRole('button', { name: 'Исправить' }))
    await userEvent.click(again.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.getByText('в каждой клетке — одно слово грузинскими буквами')).toBeTruthy())
  })

  it('«Пересобрать» rebuilds the verb, says what changed, and says so when the old record was kept or the connection dropped', async () => {
    api.regenerate.mockResolvedValueOnce({ outcome: 'replaced', mainTensesBefore: 4, mainTensesAfter: 6, changedForms: [] })
    const card = await open()
    await userEvent.click(card.getByRole('button', { name: 'Пересобрать' }))
    expect(api.regenerate).toHaveBeenCalledWith(poor)
    await waitFor(() => expect(screen.getByText('готово: было 4 из 6, стало 6 из 6')).toBeTruthy())

    const again = () => within(screen.getByTestId(`model-verb-${poor}`)).getByRole('button', { name: 'Пересобрать' })
    api.regenerate.mockResolvedValueOnce({ outcome: 'kept', reason: 'fewer-tenses', mainTensesBefore: 4, mainTensesAfter: 1 })
    await userEvent.click(again())
    await waitFor(() => expect(screen.getByText('оставлена прежняя запись: новая запись вышла беднее')).toBeTruthy())

    api.regenerate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await userEvent.click(again())
    await waitFor(() => expect(screen.getByText('связь оборвалась, пересборка продолжается — обнови список через минуту')).toBeTruthy())

    api.regenerate.mockRejectedValueOnce(new ApiError(429, '{}'))
    await userEvent.click(again())
    await waitFor(() => expect(screen.getByText('дневной лимит составления глаголов исчерпан')).toBeTruthy())
  })
})
