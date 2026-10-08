import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Screen } from '../../types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, adminFeedback as mocked, type AdminFeedbackDto } from '../../api'
import { defaultProgress } from '../../progress'
import AdminFeedbackScreen from '../AdminFeedbackScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminFeedback: { overview: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const api = vi.mocked(mocked)

const overview: AdminFeedbackDto = {
  recent: [],
  paywall: {
    shown: 9,
    options: [{ option: 'expensive', count: 4 }, { option: 'not_now', count: 1 }, { option: 'unclear', count: 0 }, { option: 'other', count: 1 }]
  },
  messages: 7,
  surveys: [{
    key: 'survey-2026-10-missing', question: 'Чего тебе не хватает в TraleBot?', createdAtUtc: '2026-10-08T10:00:00Z', audience: 'accessEnded',
    picked: 120, pending: 0, sent: 120, texts: 1, options: [{ option: 'Озвучки слов', count: 30 }, { option: 'Больше уроков', count: 10 }]
  }]
}
const message = { kind: 'message' as const, campaignKey: 'survey-2026-10-missing', option: null, text: 'Хочу слышать, как звучит слово', atUtc: '2026-10-08T11:00:00Z', telegramId: 111 }
const declined = { kind: 'paywall' as const, campaignKey: null, option: 'expensive', text: 'Год сразу — много', atUtc: '2026-10-07T11:00:00Z', telegramId: 222 }

let navigate: Mock<(s: Screen) => void>
beforeEach(() => { api.overview.mockReset(); navigate = vi.fn<(s: Screen) => void>() })

describe('AdminFeedbackScreen', () => {
  it('the list names surveys by their question, with the date, the audience and the counts — never by the key', async () => {
    api.overview.mockResolvedValue(overview)
    render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)

    const survey = await screen.findByTestId('feedback-open-survey-survey-2026-10-missing')
    expect(survey.textContent).toBe('Чего тебе не хватает в TraleBot?8 октября · доступ закончился · дошло 120 · ответили 40')
    expect(screen.getByTestId('feedback-list').textContent).not.toContain('survey-2026-10')
    expect(screen.getByTestId('feedback-open-paywall').textContent).toContain('спросили 9 · ответили 6')
    expect(screen.getByTestId('feedback-open-messages').textContent).toContain('сообщений: 7')
    expect(api.overview).toHaveBeenCalledWith({ take: 1 })

    await userEvent.click(survey)
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: 'survey-2026-10-missing' } })
    await userEvent.click(screen.getByTestId('feedback-open-paywall'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'paywall' })
    await userEvent.click(screen.getByTestId('feedback-open-messages'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'messages' })
  })

  it('one survey: counts with shares and what people wrote from it; back goes to the list', async () => {
    api.overview.mockResolvedValue({ ...overview, recent: [message] })
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: 'survey-2026-10-missing' }} navigate={navigate} />)

    const view = await screen.findByTestId('feedback-survey')
    expect(api.overview).toHaveBeenCalledWith({ kind: 'message', campaign: 'survey-2026-10-missing' })
    expect(view.textContent).toContain('Чего тебе не хватает в TraleBot?')
    expect(view.textContent).toContain('Озвучки слов30 · 75%')
    expect(view.textContent).toContain('Больше уроков10 · 25%')
    expect(view.textContent).toContain('Хочу слышать, как звучит слово')

    await userEvent.click(screen.getByRole('button', { name: '111' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-user', telegramId: 111 })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback' })
  })

  it('the paywall answers are shown in words, the messages say which survey they came from', async () => {
    api.overview.mockResolvedValueOnce({ ...overview, recent: [declined] })
    const first = render(<AdminFeedbackScreen progress={defaultProgress} view="paywall" navigate={navigate} />)
    const paywall = await screen.findByTestId('feedback-paywall')
    expect(api.overview).toHaveBeenCalledWith({ kind: 'paywall' })
    expect(paywall.textContent).toContain('Дорого4 · 67%')
    expect(paywall.textContent).toContain('Год сразу — много')
    expect(paywall.textContent).not.toContain('expensive')
    first.unmount()

    api.overview.mockResolvedValueOnce({ ...overview, recent: [message] })
    render(<AdminFeedbackScreen progress={defaultProgress} view="messages" navigate={navigate} />)
    const messages = await screen.findByTestId('feedback-messages')
    expect(api.overview).toHaveBeenLastCalledWith({ kind: 'message' })
    expect(messages.textContent).toContain('из опроса: Чего тебе не хватает в TraleBot?')
    expect(messages.textContent).toContain('Хочу слышать, как звучит слово')
  })

  it('a survey left half sent says so in the list and offers to go on with the sending', async () => {
    const halfSent = { ...overview, surveys: [{ ...overview.surveys[0], picked: 553, pending: 478, sent: 75 }] }
    api.overview.mockResolvedValue(halfSent)
    const list = render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)
    expect((await screen.findByTestId('feedback-open-survey-survey-2026-10-missing')).textContent).toContain('не дослано: отправлено 75 из 553')
    list.unmount()

    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: 'survey-2026-10-missing' }} navigate={navigate} />)
    expect((await screen.findByTestId('feedback-survey-unfinished')).textContent).toContain('Не дослано: отправлено 75 из 553')
    expect(screen.queryByTestId('feedback-survey-more')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить отправку' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: 'survey-2026-10-missing' })
  })

  it('a survey sent to everyone picked has no «не дослано», only a quiet way to send it to the rest of the group', async () => {
    api.overview.mockResolvedValue(overview)
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: 'survey-2026-10-missing' }} navigate={navigate} />)
    await screen.findByTestId('feedback-survey')
    expect(screen.queryByTestId('feedback-survey-unfinished')).toBeNull()
    await userEvent.click(screen.getByTestId('feedback-survey-more'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: 'survey-2026-10-missing' })
  })

  it('says so when there are no surveys yet, and shows only «Нет доступа.» to anyone the server refuses', async () => {
    api.overview.mockResolvedValueOnce({ ...overview, surveys: [] })
    const first = render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)
    expect(await screen.findByText(/Опросов пока не было/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Собрать первый' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey' })
    first.unmount()

    api.overview.mockRejectedValueOnce(new ApiError(404, ''))
    render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)
    expect((await screen.findByTestId('feedback-problem')).textContent).toBe('Нет доступа.')
    expect(screen.queryByTestId('feedback-list')).toBeNull()
  })
})
