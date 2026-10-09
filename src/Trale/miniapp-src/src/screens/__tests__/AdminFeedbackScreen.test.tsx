import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Screen } from '../../types'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, adminFeedback as mocked, adminThreads as mockedThreads, type AdminFeedbackDto, type AdminSurveyDto, type AdminSurveyResultsDto } from '../../api'
import { defaultProgress } from '../../progress'
import AdminFeedbackScreen from '../AdminFeedbackScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminFeedback: { overview: vi.fn(), survey: vi.fn() },
  adminThreads: { list: vi.fn(), get: vi.fn(), reply: vi.fn(), dismiss: vi.fn() }
}))
vi.mock('../../components/admin/FeedbackThread', () => ({
  default: ({ telegramId, quoteId }: { telegramId: number; quoteId?: string }) => <div data-testid="thread-stub">{telegramId}:{quoteId ?? ''}</div>
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const api = vi.mocked(mocked)
const threads = vi.mocked(mockedThreads)

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
  unanswered: 3,
  surveys: [summary]
}
const text = (questionId: string, option: string | null, words: string, telegramId: number) =>
  ({ id: `answer-${telegramId}`, kind: 'survey' as const, campaignKey: KEY, questionId, option, text: words, atUtc: '2026-10-08T11:00:00Z', telegramId })
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
const declined = { id: 'answer-444', kind: 'paywall' as const, campaignKey: null, option: 'expensive', text: 'Год сразу — много', atUtc: '2026-10-07T11:00:00Z', telegramId: 444 }

let navigate: Mock<(s: Screen) => void>
beforeEach(() => {
  ;[...Object.values(api), ...Object.values(threads)].forEach(f => (f as ReturnType<typeof vi.fn>).mockReset())
  api.overview.mockResolvedValue(overview)
  api.survey.mockResolvedValue(results)
  navigate = vi.fn<(s: Screen) => void>()
})

describe('AdminFeedbackScreen', () => {
  it('the first screen is three sections, each with what waits in it', async () => {
    api.overview.mockResolvedValue({ ...overview, surveys: [summary, { ...summary, key: 'survey-2026-09-left', pending: 20 }] })
    render(<AdminFeedbackScreen navigate={navigate} />)

    const list = await screen.findByTestId('feedback-list')
    expect(within(list).getAllByRole('button').map(b => b.textContent)).toEqual([
      expect.stringMatching(/^Сообщениябез ответа: 3/), expect.stringMatching(/^Опросыне дослано: 1.*всего 2/), expect.stringMatching(/^Экран покупки.*спросили 9 · ответили 6/)
    ])
    expect(api.survey).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('feedback-open-threads'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'threads' })
    await userEvent.click(screen.getByTestId('feedback-open-surveys'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'surveys' })
    await userEvent.click(screen.getByTestId('feedback-open-paywall'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'paywall' })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin' })
  })

  it('«Опросы» names surveys by their first question, with the date, the audience and how far people got — never by the key', async () => {
    render(<AdminFeedbackScreen view="surveys" navigate={navigate} />)

    const survey = await screen.findByTestId(`feedback-open-survey-${KEY}`)
    expect(survey.textContent).toBe(`${summary.title}8 октября · занимались за последние 30 дней · вопросов: 3получили 120 · ответили 40 · дошли до конца 18`)
    expect(screen.getByTestId('feedback-surveys').textContent).not.toContain('survey-2026')

    await userEvent.click(survey)
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: KEY } })
    await userEvent.click(screen.getByTestId('survey-new'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey' })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback' })
  })

  it('one survey: the funnel, then every question with counts, shares and what was written', async () => {
    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)

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
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: 'surveys' })
  })

  it('the answers can be narrowed to those who chose one option of the first question', async () => {
    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)
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
    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)

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
    const list = render(<AdminFeedbackScreen view="surveys" navigate={navigate} />)
    expect((await screen.findByTestId(`feedback-open-survey-${KEY}`)).textContent).toContain('не дослано: отправлено 75 из 553')
    list.unmount()

    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)
    expect((await screen.findByTestId('feedback-survey-unfinished')).textContent).toContain('Не дослано: отправлено 75 из 553')
    expect(screen.queryByTestId('feedback-survey-more')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить отправку' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: KEY })
  })

  it('a survey sent to everyone picked has only a quiet way to send it to the rest of the group', async () => {
    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)
    await screen.findByTestId('feedback-survey')
    expect(screen.queryByTestId('feedback-survey-unfinished')).toBeNull()
    await userEvent.click(screen.getByTestId('feedback-survey-more'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey', resume: KEY })
  })

  it('every text has «Ответить», which opens the conversation with its author and remembers where to go back', async () => {
    render(<AdminFeedbackScreen view={{ survey: KEY }} navigate={navigate} />)
    const second = await screen.findByTestId('feedback-question-q2')
    await userEvent.click(within(second).getByRole('button', { name: 'Ответить' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { thread: 111, quote: 'answer-111', back: { survey: KEY } } })
    expect(within(screen.getByTestId('feedback-question-q1')).queryByRole('button', { name: 'Ответить' })).toBeNull()
  })

  it('the paywall answers are shown in words and can be answered', async () => {
    api.overview.mockResolvedValueOnce({ ...overview, recent: [declined, { ...declined, id: 'answer-555', text: null, telegramId: 555 }] })
    render(<AdminFeedbackScreen view="paywall" navigate={navigate} />)
    const paywall = await screen.findByTestId('feedback-paywall')
    expect(api.overview).toHaveBeenCalledWith({ kind: 'paywall' })
    expect(paywall.textContent).toContain('Что смутило?')
    expect(paywall.textContent).toContain('Дорого4 · 67%')
    expect(paywall.textContent).toContain('Год сразу — много')
    expect(paywall.textContent).not.toContain('expensive')
    expect(screen.getAllByRole('button', { name: 'Ответить' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { thread: 444, quote: 'answer-444', back: 'paywall' } })
  })

  it('«Сообщения от людей» shows who waits for an answer first, with the status in words, and the filter «Без ответа»', async () => {
    const waiting = [
      { telegramId: 111, lastKind: 'message' as const, lastText: 'А про падежи?', lastAtUtc: '2026-10-08T12:00:00Z', texts: 2, status: 'repliedBack' as const },
      { telegramId: 222, lastKind: 'survey' as const, lastText: 'Долгие уроки', lastAtUtc: '2026-10-08T11:00:00Z', texts: 1, status: 'new' as const }
    ]
    threads.list.mockImplementation(async (only?: boolean) => ({
      unanswered: 2,
      threads: only ? waiting : [...waiting, { telegramId: 333, lastKind: 'paywall' as const, lastText: 'Год — дорого', lastAtUtc: '2026-10-07T11:00:00Z', texts: 1, status: 'answered' as const },
        { telegramId: 444, lastKind: 'message' as const, lastText: 'Спасибо!', lastAtUtc: '2026-10-06T11:00:00Z', texts: 1, status: 'closed' as const }]
    }))
    render(<AdminFeedbackScreen view="threads" navigate={navigate} />)

    const first = await screen.findByTestId('feedback-thread-111')
    expect(threads.list).toHaveBeenCalledWith(true)
    expect(first.textContent).toContain('человек ответил')
    expect(first.textContent).toContain('А про падежи?')
    expect(first.textContent).toContain('письмо автору · 111 · сообщений: 2')
    expect(screen.getByTestId('feedback-thread-222').textContent).toContain('новое')
    expect(screen.getByTestId('feedback-thread-222').textContent).toContain('ответ в опросе · 222')
    expect(screen.getByRole('radio', { name: 'Без ответа · 2' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByTestId('feedback-thread-333')).toBeNull()

    await userEvent.click(screen.getByRole('radio', { name: 'Все' }))
    expect((await screen.findByTestId('feedback-thread-333')).textContent).toContain('отвечено')
    expect(screen.getByTestId('feedback-thread-444').textContent).toContain('не требует ответа')
    expect(threads.list).toHaveBeenLastCalledWith(false)

    await userEvent.click(first)
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { thread: 111, quote: undefined, back: 'threads' } })
  })

  it('says so when nobody waits for an answer', async () => {
    threads.list.mockResolvedValue({ unanswered: 0, threads: [] })
    render(<AdminFeedbackScreen view="threads" navigate={navigate} />)
    expect(await screen.findByText('Все сообщения разобраны.')).toBeTruthy()
  })

  it('a conversation opens for its person and text, and «Назад» returns to where it was opened from', async () => {
    render(<AdminFeedbackScreen view={{ thread: 111, quote: 'answer-111', back: { survey: KEY } }} navigate={navigate} />)
    expect((await screen.findByTestId('thread-stub')).textContent).toBe('111:answer-111')
    expect(screen.queryByTestId('feedback-list')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: KEY } })
  })

  it('says so when there are no surveys yet, and shows only «Нет доступа.» to anyone the server refuses', async () => {
    api.overview.mockResolvedValueOnce({ ...overview, surveys: [] })
    const first = render(<AdminFeedbackScreen view="surveys" navigate={navigate} />)
    expect(await screen.findByText(/Опросов пока не было/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Собрать опрос' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-survey' })
    first.unmount()

    api.overview.mockRejectedValueOnce(new ApiError(404, ''))
    render(<AdminFeedbackScreen navigate={navigate} />)
    expect((await screen.findByTestId('feedback-problem')).textContent).toBe('Нет доступа.')
    expect(screen.queryByTestId('feedback-list')).toBeNull()
  })
})
