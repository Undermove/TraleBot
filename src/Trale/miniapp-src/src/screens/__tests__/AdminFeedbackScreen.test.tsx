import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Screen } from '../../types'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, adminFeedback as mocked, type AdminFeedbackDto, type AdminSurveyDto, type AdminSurveyResultsDto } from '../../api'
import { defaultProgress } from '../../progress'
import AdminFeedbackScreen from '../AdminFeedbackScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminFeedback: { overview: vi.fn(), survey: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const api = vi.mocked(mocked)

const KEY = 'survey-2026-10-users'
const summary: AdminSurveyDto = {
  key: KEY, title: 'Что ты почувствуешь, если TraleBot завтра исчезнет?', questions: 3, createdAtUtc: '2026-10-08T10:00:00Z', audience: 'activeLately',
  picked: 120, pending: 0, funnel: { sent: 120, answeredFirst: 40, openedForm: 30, finished: 18 }
}
const overview: AdminFeedbackDto = {
  recent: [],
  paywall: {
    shown: 9,
    options: [{ option: 'expensive', count: 4 }, { option: 'not_now', count: 1 }, { option: 'unclear', count: 0 }, { option: 'other', count: 1 }]
  },
  messages: 7,
  surveys: [summary]
}
const text = (questionId: string, option: string | null, words: string, telegramId: number) =>
  ({ kind: 'survey' as const, campaignKey: KEY, questionId, option, text: words, atUtc: '2026-10-08T11:00:00Z', telegramId })
const results: AdminSurveyResultsDto = {
  summary,
  segment: null,
  questions: [
    {
      id: 'q1', text: summary.title, kind: 'choice', answered: 40,
      options: [{ option: 'Очень расстроюсь', count: 18 }, { option: 'Немного расстроюсь', count: 12 }, { option: 'Мне всё равно', count: 6 }, { option: 'Уже не пользуюсь', count: 4 }],
      headline: { option: 'Очень расстроюсь', without: 'Уже не пользуюсь', chose: 18, of: 36 }, texts: []
    },
    {
      id: 'q2', text: 'Чем ещё ты пользуешься для грузинского?', kind: 'choice', answered: 25,
      options: [{ option: 'Репетитор или курсы', count: 10 }, { option: 'Только TraleBot', count: 10 }, { option: 'Другое', count: 5 }],
      headline: null, texts: [text('q2', 'Другое', 'Сериалы с субтитрами', 111)]
    },
    { id: 'q3', text: 'А что в последний раз раздражало или мешало?', kind: 'text', answered: 2, options: [], headline: null, texts: [text('q3', null, 'Мало озвучки', 222)] }
  ],
  written: []
}
const message = { kind: 'message' as const, campaignKey: KEY, option: null, text: 'Хочу слышать, как звучит слово', atUtc: '2026-10-08T11:00:00Z', telegramId: 333 }
const declined = { kind: 'paywall' as const, campaignKey: null, option: 'expensive', text: 'Год сразу — много', atUtc: '2026-10-07T11:00:00Z', telegramId: 444 }

let navigate: Mock<(s: Screen) => void>
beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.overview.mockResolvedValue(overview)
  api.survey.mockResolvedValue(results)
  navigate = vi.fn<(s: Screen) => void>()
})

describe('AdminFeedbackScreen', () => {
  it('the list names surveys by their first question, with the date, the audience and how far people got — never by the key', async () => {
    render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)

    const survey = await screen.findByTestId(`feedback-open-survey-${KEY}`)
    expect(survey.textContent).toBe(`${summary.title}8 октября · занимались за последние 30 дней · вопросов: 3получили 120 · ответили 40 · дошли до конца 18`)
    expect(screen.getByTestId('feedback-list').textContent).not.toContain('survey-2026')
    expect(screen.getByTestId('feedback-open-paywall').textContent).toContain('спросили 9 · ответили 6')
    expect(screen.getByTestId('feedback-open-messages').textContent).toContain('сообщений: 7')
    expect(api.survey).not.toHaveBeenCalled()

    await userEvent.click(survey)
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: KEY } })
    await userEvent.click(screen.getByTestId('feedback-open-paywall'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'paywall' })
    await userEvent.click(screen.getByTestId('feedback-open-messages'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'messages' })
  })

  it('one survey: the funnel, then every question with counts, shares and what was written', async () => {
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: KEY }} navigate={navigate} />)

    const funnel = await screen.findByTestId('feedback-funnel')
    expect(api.survey).toHaveBeenCalledWith(KEY, null)
    expect(funnel.textContent).toBe('получили120ответили на первый вопрос40 · 33%открыли форму в мини-аппе30 · 25%дошли до конца18 · 15%')
    const first = screen.getByTestId('feedback-question-q1')
    expect(first.textContent).toContain('Вопрос 1 · в боте')
    expect(first.textContent).toContain('Очень расстроюсь18 · 45%')
    expect(screen.getByTestId('feedback-headline').textContent).toBe('50%«Очень расстроюсь» — 18 из 36 (без тех, кто ответил «Уже не пользуюсь»)')
    const second = screen.getByTestId('feedback-question-q2')
    expect(second.textContent).toContain('ответили 25')
    expect(second.textContent).toContain('Другое5 · 20%')
    expect(second.textContent).toContain('Сериалы с субтитрами')
    const third = screen.getByTestId('feedback-question-q3')
    expect(within(third).queryByTestId('feedback-counts')).toBeNull()
    expect(third.textContent).toContain('Мало озвучки')

    await userEvent.click(within(second).getByRole('button', { name: '111' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-user', telegramId: 111 })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback' })
  })

  it('the answers can be narrowed to those who chose one option of the first question', async () => {
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: KEY }} navigate={navigate} />)
    const chips = within(await screen.findByTestId('feedback-segments'))
    expect(chips.getAllByRole('button').map(b => b.textContent)).toEqual(['Все', 'Очень расстроюсь', 'Немного расстроюсь', 'Мне всё равно', 'Уже не пользуюсь'])
    api.survey.mockResolvedValue({
      ...results, segment: 'Очень расстроюсь',
      questions: [results.questions[0], { ...results.questions[1], answered: 12, options: [{ option: 'Репетитор или курсы', count: 9 }, { option: 'Только TraleBot', count: 3 }, { option: 'Другое', count: 0 }], texts: [] }, results.questions[2]]
    })

    await userEvent.click(chips.getByRole('button', { name: 'Очень расстроюсь' }))

    await waitFor(() => expect(api.survey).toHaveBeenLastCalledWith(KEY, 'Очень расстроюсь'))
    await waitFor(() => expect(screen.getByTestId('feedback-question-q2').textContent).toContain('Репетитор или курсы9 · 75%'))
    expect(screen.getByTestId('feedback-funnel').textContent).toContain('получили120')
    expect(chips.getByRole('button', { name: 'Очень расстроюсь' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a survey of one question has a short funnel, no narrowing, and shows what was written by «Написать подробнее»', async () => {
    api.survey.mockResolvedValue({
      summary: { ...summary, questions: 1 }, segment: null, questions: [{ ...results.questions[0], headline: null }], written: [message]
    })
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: KEY }} navigate={navigate} />)

    expect((await screen.findByTestId('feedback-funnel')).textContent).toBe('получили120ответили на первый вопрос40 · 33%')
    expect(screen.queryByTestId('feedback-segments')).toBeNull()
    expect(screen.queryByTestId('feedback-headline')).toBeNull()
    expect(screen.getByTestId('feedback-survey').textContent).toContain('Написали подробнее')
    expect(screen.getByTestId('feedback-survey').textContent).toContain('Хочу слышать, как звучит слово')
  })

  it('a survey left half sent says so in the list and offers to go on with the sending', async () => {
    const halfSent = { ...summary, picked: 553, pending: 478, funnel: { ...summary.funnel, sent: 75 } }
    api.overview.mockResolvedValue({ ...overview, surveys: [halfSent] })
    api.survey.mockResolvedValue({ ...results, summary: halfSent })
    const list = render(<AdminFeedbackScreen progress={defaultProgress} navigate={navigate} />)
    expect((await screen.findByTestId(`feedback-open-survey-${KEY}`)).textContent).toContain('не дослано: отправлено 75 из 553')
    list.unmount()

    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: KEY }} navigate={navigate} />)
    expect((await screen.findByTestId('feedback-survey-unfinished')).textContent).toContain('Не дослано: отправлено 75 из 553')
    expect(screen.queryByTestId('feedback-survey-more')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить отправку' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: KEY })
  })

  it('a survey sent to everyone picked has only a quiet way to send it to the rest of the group', async () => {
    render(<AdminFeedbackScreen progress={defaultProgress} view={{ survey: KEY }} navigate={navigate} />)
    await screen.findByTestId('feedback-survey')
    expect(screen.queryByTestId('feedback-survey-unfinished')).toBeNull()
    await userEvent.click(screen.getByTestId('feedback-survey-more'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: KEY })
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
    expect(messages.textContent).toContain(`из опроса: ${summary.title}`)
    expect(messages.textContent).toContain('Хочу слышать, как звучит слово')
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
