import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminCampaigns as mockedCampaigns, adminSurveys as mockedSurveys } from '../../api'
import { defaultProgress } from '../../progress'
import SurveyBuilderScreen from '../SurveyBuilderScreen'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  adminCampaigns: { audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn() },
  adminSurveys: { presets: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const campaigns = vi.mocked(mockedCampaigns)
const surveys = vi.mocked(mockedSurveys)

const missing = { id: 'missing', title: 'Чего не хватает', question: 'Чего тебе не хватает в TraleBot?', options: ['Озвучки слов', 'Больше уроков', 'Разговорной практики', 'Другого'] }
const likes = { id: 'likes', title: 'Что нравится', question: 'Что тебе нравится в TraleBot больше всего?', options: ['Уроки', 'Глаголы'] }
const status = {
  key: 'survey-2026-10-missing', audience: 'accessEnded' as const, message: missing.question, buttonText: null, buttonQuery: null,
  total: 100, sample: 100, pending: 100, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
  giftDays: 0, giftOfferEndsAtUtc: null, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0,
  surveyAnswers: missing.options.map(option => ({ option, count: 0 }))
}
const picked = (key: string, n: number, dryRun: boolean) => ({ key, dryRun, audienceTotal: 553, alreadyInCampaign: 0, picked: n, leftForLater: 553 - n })

let navigate: ReturnType<typeof vi.fn>

beforeEach(() => {
  ;[...Object.values(campaigns), ...Object.values(surveys)].forEach(f => (f as ReturnType<typeof vi.fn>).mockReset())
  surveys.presets.mockResolvedValue({ presets: [missing, likes], suggestions: ['Другое', 'Нет времени', 'Дорого'], maxOptions: 4, maxOptionLength: 64 })
  campaigns.audiences.mockResolvedValue({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1 })
  navigate = vi.fn()
  window.scrollTo = vi.fn() as never
})
afterEach(() => vi.unstubAllGlobals())

async function open() {
  render(<SurveyBuilderScreen progress={defaultProgress} navigate={navigate} />)
  await screen.findByTestId('survey-preset-missing')
}
const title = () => screen.getByTestId('survey-step-title').textContent
const next = () => userEvent.click(screen.getByTestId('survey-next'))
const optionTexts = () => within(screen.getByTestId('survey-options')).getAllByTestId(/^survey-option-/).map(b => b.textContent)

/** От заготовки до шага «Отправка», ничего не вводя. */
async function toSending() {
  await open()
  await userEvent.click(screen.getByTestId('survey-preset-missing'))
  await next()
  await next()
  expect(title()).toBe('Отправка')
}

describe('SurveyBuilderScreen', () => {
  it('a ready-made survey goes all the way to sending without typing a word', async () => {
    await open()
    expect(title()).toBe('Выбери опрос')
    expect(screen.getByTestId('survey-preset-missing').textContent).toContain('Чего тебе не хватает в TraleBot?')
    expect(screen.getByTestId('survey-preset-missing').textContent).toContain('Разговорной практики')

    await userEvent.click(screen.getByTestId('survey-preset-missing'))
    expect(title()).toBe('Проверь, как это выглядит')
    expect(screen.getByTestId('survey-preview').textContent).toBe('Чего тебе не хватает в TraleBot?Озвучки словБольше уроковРазговорной практикиДругого')
    expect(screen.queryByTestId('survey-problem')).toBeNull()

    await next()
    expect(title()).toBe('Кому отправить')
    expect(screen.getByTestId('survey-audience-accessEnded').textContent).toContain('553')
    expect(screen.queryByText('только я (посмотреть)')).toBeNull()

    await next()
    expect(title()).toBe('Отправка')
    expect(screen.getByTestId('survey-summary').textContent).toBe('Кому: доступ закончился — 553 чел., сначала пробной группе из 100')
    expect(campaigns.prepare).not.toHaveBeenCalled()
  })

  it('buttons are renamed by a tap, removed by the cross and added from the ready ones — up to four, at least two', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-missing'))
    expect(screen.queryByTestId('survey-add-option')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Другого' }))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Разговорной практики' }))
    expect(optionTexts()).toEqual(['Озвучки слов', 'Больше уроков'])

    await userEvent.click(screen.getByTestId('survey-option-1'))
    await userEvent.clear(screen.getByLabelText('Вариант 2'))
    await userEvent.type(screen.getByLabelText('Вариант 2'), 'Новых глаголов{Enter}')
    await userEvent.click(within(screen.getByTestId('survey-suggestions')).getByRole('button', { name: 'Нет времени' }))
    expect(optionTexts()).toEqual(['Озвучки слов', 'Новых глаголов', 'Нет времени'])
    expect(within(screen.getByTestId('survey-suggestions')).queryByRole('button', { name: 'Нет времени' })).toBeNull()

    await userEvent.click(screen.getByTestId('survey-question'))
    await userEvent.clear(screen.getByLabelText('Текст вопроса'))
    await userEvent.type(screen.getByLabelText('Текст вопроса'), 'Чего не хватает?')
    expect(screen.getByTestId('survey-preview').textContent).toBe('Чего не хватает?Озвучки словНовых глаголовНет времени')

    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Нет времени' }))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Новых глаголов' }))
    expect(screen.getByTestId('survey-problem').textContent).toBe('Нужно хотя бы два варианта ответа.')
    expect((screen.getByTestId('survey-next') as HTMLButtonElement).disabled).toBe(true)
  })

  it('«Свой вопрос» starts empty and does not go further until there is a question and two different buttons', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-custom'))
    expect(screen.getByTestId('survey-problem').textContent).toBe('Напиши вопрос.')

    await userEvent.type(screen.getByLabelText('Текст вопроса'), 'Как тебе новые уроки?')
    await userEvent.click(screen.getByTestId('survey-add-option'))
    await userEvent.type(screen.getByLabelText('Вариант 1'), 'Дорого{Enter}')
    await userEvent.click(screen.getByTestId('survey-add-option'))
    await userEvent.type(screen.getByLabelText('Вариант 2'), 'Дорого{Enter}')
    expect(screen.getByTestId('survey-problem').textContent).toBe('Два варианта совпадают.')

    expect((screen.getByTestId('survey-next') as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(screen.getByTestId('survey-option-1'))
    await userEvent.clear(screen.getByLabelText('Вариант 2'))
    await userEvent.type(screen.getByLabelText('Вариант 2'), 'Сложно{Enter}')
    expect(screen.queryByTestId('survey-problem')).toBeNull()
    expect((screen.getByTestId('survey-next') as HTMLButtonElement).disabled).toBe(false)
  })

  it('«Отправить себе» sends a trial survey to the owner only, under a name made by the server', async () => {
    campaigns.prepare.mockResolvedValue(picked('survey-2026-10-missing-test', 1, false))
    campaigns.send.mockResolvedValue({ sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: { ...status, pending: 0, sent: 1 } })
    await toSending()

    await userEvent.click(screen.getByTestId('survey-send-me'))

    expect((await screen.findByTestId('survey-note')).textContent).toContain('Отправил тебе в чат с ботом')
    expect(campaigns.prepare).toHaveBeenCalledTimes(1)
    expect(campaigns.prepare.mock.calls[0][0]).toMatchObject({
      key: '', newSurveySlug: 'missing-test', audience: 'owner', message: missing.question, surveyOptions: missing.options, sampleSize: null, dryRun: false
    })
    expect(campaigns.send).toHaveBeenCalledWith('survey-2026-10-missing-test', 1)
    expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('survey-back')).toBeTruthy()
  })

  it('a batch cannot be sent until recipients are picked; picking asks first and sends nothing', async () => {
    const confirm = vi.fn((_text: string) => true)
    vi.stubGlobal('confirm', confirm)
    campaigns.prepare.mockResolvedValueOnce(picked('survey-2026-10-missing', 100, true)).mockResolvedValueOnce(picked('survey-2026-10-missing', 100, false))
    campaigns.status.mockResolvedValue(status)
    campaigns.send.mockResolvedValue({ sent: 25, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: { ...status, pending: 75, sent: 25 } })
    await toSending()
    const send = screen.getByTestId('survey-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(screen.getByTestId('survey-send-hint').textContent).toBe('Отправка откроется, когда выберешь получателей.')

    await userEvent.click(screen.getByTestId('survey-pick'))

    await waitFor(() => expect(send.disabled).toBe(false))
    expect(confirm.mock.calls[0][0]).toContain('Выбрать пробную группу: 100 чел. (доступ закончился)')
    expect(confirm.mock.calls[0][0]).toContain('НЕ уйдут')
    expect(campaigns.prepare.mock.calls.map(c => c[0])).toMatchObject([
      { key: '', newSurveySlug: 'missing', audience: 'accessEnded', sampleSize: 100, dryRun: true },
      { key: '', newSurveySlug: 'missing', audience: 'accessEnded', sampleSize: 100, dryRun: false }
    ])
    expect(campaigns.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('survey-back')).toBeNull()
    expect(screen.getByText(/вопрос и кнопки уже не поменять/)).toBeTruthy()

    await userEvent.click(send)
    await waitFor(() => expect(campaigns.send).toHaveBeenCalledWith('survey-2026-10-missing', 25))
    expect(confirm.mock.calls[1][0]).toContain('ОТПРАВИТЬ опрос 25 людям')
    expect((await screen.findByTestId('survey-note')).textContent).toContain('Отправлено 25')
    expect(screen.getByTestId('survey-status').textContent).toContain('ждут 75')

    await userEvent.click(screen.getByTestId('survey-open-results'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: 'survey-2026-10-missing' } })
  })

  it('a declined confirmation picks nobody and leaves the survey editable', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    campaigns.prepare.mockResolvedValue(picked('survey-2026-10-missing', 100, true))
    await toSending()

    await userEvent.click(screen.getByTestId('survey-pick'))

    await waitFor(() => expect(campaigns.prepare).toHaveBeenCalledTimes(1))
    expect(campaigns.prepare.mock.calls[0][0]).toMatchObject({ dryRun: true })
    expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('survey-back')).toBeTruthy()
  })

  it('shows nothing but «Нет доступа.» to anyone the server refuses', async () => {
    const { ApiError } = await import('../../api')
    surveys.presets.mockRejectedValue(new ApiError(404, ''))
    render(<SurveyBuilderScreen progress={defaultProgress} navigate={navigate} />)
    expect(await screen.findByText('Нет доступа.')).toBeTruthy()
    expect(screen.queryByTestId('survey-step-title')).toBeNull()
  })
})
