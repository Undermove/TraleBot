import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminVerbs as mocked, type ModelMadeVerbDto, type VerbTenseRowDto } from '../../api'
import VerbReviewScreen from '../../screens/VerbReviewScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminVerbs: { modelMade: vi.fn(), confirmTense: vi.fn(), editTense: vi.fn(), removeTense: vi.fn(), regenerate: vi.fn(), approve: vi.fn(), unapprove: vi.fn() }
}))
const api = vi.mocked(mocked)

const row = (tense: string, cells: string[], unverified: boolean): VerbTenseRowDto =>
  ({ tense, cells, inTexts: cells.map(() => null), phrases: null, unverified, completed: false })
const verb: ModelMadeVerbDto = {
  lemma: 'ეკითხება', title: 'კითხვა', translation: 'спрашивать, спросить', askedText: 'спрашивать',
  approvedAtUtc: '2026-10-29T18:35:15Z', learners: 1, mainTenses: 6, missingTenses: [], completedTenses: [],
  verifiedMainTenses: 4, reviewerReasons: [], generatorModel: 'g', reviewerModel: 'r', ownerApprovedAtUtc: null,
  tenses: [
    row('present', ['ვეკითხები', 'ეკითხები', 'ეკითხება', 'ვეკითხებით', 'ეკითხებით', 'ეკითხებიან'], false),
    row('future', ['შევეკითხები', 'შეეკითხები', 'შეეკითხება', 'შევეკითხებით', 'შეეკითხებით', 'შეეკითხებიან'], true)
  ],
  unverifiedTenses: [{ tense: 'future', cells: [], inTexts: [] } as never]
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.modelMade.mockResolvedValue({ count: 1, verbs: [verb] })
  api.editTense.mockResolvedValue({ ok: true, progressReset: 2 })
  api.approve.mockResolvedValue({ ok: true })
})

const FIX = 'глагол: ეკითხება\nБудущее: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ ჰკითხავენ\nглагол проверен'

describe('исправление одним текстом', () => {
  it('shows what will change and applies the rows, then marks the verb approved', async () => {
    const user = userEvent.setup()
    render(<VerbReviewScreen lemma="ეკითხება" navigate={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Вставить исправление' }))
    await user.click(screen.getByLabelText('Текст исправления'))
    await user.paste(FIX)
    const preview = screen.getByTestId('verb-fix-preview')
    expect(preview.textContent).toContain('Будущее: исправить')
    expect(preview.textContent).toContain('შევეკითხები → ვკითხავ')
    expect(preview.textContent).toContain('Отметить глагол проверенным')

    await user.click(screen.getByRole('button', { name: 'Применить' }))
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith('ეკითხება'))
    expect(api.editTense).toHaveBeenCalledWith('ეკითხება', 'future', ['ვკითხავ', 'ჰკითხავ', 'ჰკითხავს', 'ვკითხავთ', 'ჰკითხავთ', 'ჰკითხავენ'])
    expect(api.editTense.mock.invocationCallOrder[0]).toBeLessThan(api.approve.mock.invocationCallOrder[0])
    expect((await screen.findByTestId('verb-review-note')).textContent)
      .toBe('Будущее: исправлено; глагол проверен; у учеников сброшен прогресс по изменённым формам: 2')
  })

  it('does not apply a fix written for another verb', async () => {
    const user = userEvent.setup()
    render(<VerbReviewScreen lemma="ეკითხება" navigate={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Вставить исправление' }))
    await user.click(screen.getByLabelText('Текст исправления'))
    await user.paste(FIX.replace('глагол: ეკითხება', 'глагол: ჰკითხავს'))
    expect(screen.getByTestId('verb-fix-problem').textContent).toBe('исправление для ჰკითხავს, а открыт ეკითხება')
    expect((screen.getByRole('button', { name: 'Применить' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('will not mark the verb approved while a tense is left unverified', async () => {
    const user = userEvent.setup()
    render(<VerbReviewScreen lemma="ეკითხება" navigate={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Вставить исправление' }))
    await user.click(screen.getByLabelText('Текст исправления'))
    await user.paste('глагол проверен')
    expect(screen.getByTestId('verb-fix-problem').textContent).toBe('чтобы отметить глагол проверенным, надо исправить или подтвердить: Будущее')
  })
})
