import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminFeedback as mocked } from '../../api'
import FeedbackPanel from './FeedbackPanel'

vi.mock('../../api', async () => ({
  PAYWALL_DECLINE_OPTIONS: (await vi.importActual<typeof import('../../api')>('../../api')).PAYWALL_DECLINE_OPTIONS,
  adminFeedback: { overview: vi.fn() }
}))
const api = vi.mocked(mocked)

const overview = {
  recent: [
    { kind: 'message' as const, campaignKey: 'why-2026-10', option: null, text: 'Звёзды неудобно покупать', atUtc: '2026-10-08T10:00:00Z', telegramId: 111 },
    { kind: 'paywall' as const, campaignKey: null, option: 'expensive', text: null, atUtc: '2026-10-07T10:00:00Z', telegramId: 222 },
    { kind: 'survey' as const, campaignKey: 'why-2026-10', option: 'Пока не нужно', text: null, atUtc: '2026-10-06T10:00:00Z', telegramId: 333 }
  ],
  paywall: {
    shown: 9,
    options: [{ option: 'expensive', count: 4 }, { option: 'not_now', count: 1 }, { option: 'unclear', count: 0 }, { option: 'other', count: 1 }]
  },
  surveys: [{ key: 'why-2026-10', question: 'Что мешает заниматься?', options: [{ option: 'Дорого', count: 7 }, { option: 'Пока не нужно', count: 3 }] }]
}

beforeEach(() => api.overview.mockReset())

describe('FeedbackPanel', () => {
  it('shows the counts per option in words and the latest answers', async () => {
    api.overview.mockResolvedValue(overview)
    render(<FeedbackPanel onOpenUser={() => {}} />)

    const paywall = await screen.findByTestId('feedback-paywall')
    expect(paywall.textContent).toContain('спросили 9 · ответили 6')
    expect(paywall.textContent).toContain('Дорого4')
    expect(paywall.textContent).toContain('Не понял, что получу0')
    expect(paywall.textContent).not.toContain('expensive')
    const survey = screen.getByTestId('feedback-survey-why-2026-10')
    expect(survey.textContent).toContain('Что мешает заниматься?')
    expect(survey.textContent).toContain('Дорого7')
    const recent = screen.getByTestId('feedback-recent')
    expect(recent.textContent).toContain('Звёзды неудобно покупать')
    expect(recent.textContent).toContain('«why-2026-10»')
    expect(recent.textContent).toContain('не купил')
    expect(recent.textContent).not.toContain('expensive')
  })

  it('a tap on the id opens that user', async () => {
    api.overview.mockResolvedValue(overview)
    const open = vi.fn()
    render(<FeedbackPanel onOpenUser={open} />)
    await userEvent.click(await screen.findByRole('button', { name: '222' }))
    expect(open).toHaveBeenCalledWith(222)
  })

  it('says so when nobody has written yet, and when the load failed', async () => {
    api.overview.mockResolvedValueOnce({ recent: [], paywall: { shown: 0, options: overview.paywall.options.map(o => ({ ...o, count: 0 })) }, surveys: [] })
    const first = render(<FeedbackPanel onOpenUser={() => {}} />)
    expect(await screen.findByText('Пока никто ничего не написал.')).toBeTruthy()
    first.unmount()

    api.overview.mockRejectedValueOnce(new Error('offline'))
    render(<FeedbackPanel onOpenUser={() => {}} />)
    expect(await screen.findByText('Не получилось загрузить.')).toBeTruthy()
  })
})
