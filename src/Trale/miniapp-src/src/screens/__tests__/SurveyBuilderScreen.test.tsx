import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Screen } from '../../types'
import {
  adminCampaigns as mockedCampaigns, adminFeedback as mockedFeedback, adminSurveys as mockedSurveys,
  type SurveyBuilderKitDto, type SurveyQuestionDto
} from '../../api'
import { defaultProgress } from '../../progress'
import SurveyBuilderScreen, { questionProblem } from '../SurveyBuilderScreen'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  FEEDBACK_MAX_LENGTH: 2000,
  adminCampaigns: { audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn() },
  adminSurveys: { presets: vi.fn() },
  adminFeedback: { overview: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
vi.mock('../../components/Mascot', () => ({ default: () => null }))
const campaigns = vi.mocked(mockedCampaigns)
const surveys = vi.mocked(mockedSurveys)
const feedback = vi.mocked(mockedFeedback)

const ifGone: SurveyQuestionDto = { text: 'Что ты почувствуешь, если TraleBot завтра исчезнет?', kind: 'choice', options: ['Очень расстроюсь', 'Немного расстроюсь', 'Мне всё равно', 'Уже не пользуюсь'], allowOther: false,
  optionKeys: ['very', 'somewhat', 'indifferent', 'unused'], headlineOption: 'very', headlineWithout: 'unused' }
const whyGeorgian: SurveyQuestionDto = { text: 'Зачем тебе грузинский?', kind: 'choice', options: ['Живу в Грузии', 'Собираюсь переехать', 'Еду в поездку', 'Семья или близкие', 'Просто интересно'], allowOther: true }
const annoyed: SurveyQuestionDto = { text: 'А что в последний раз раздражало или мешало?', kind: 'text', options: [], allowOther: false }
const paywall: SurveyQuestionDto = { text: 'Что остановило от покупки полного доступа?', kind: 'choice', options: ['Дорого', 'Пока не нужно'], allowOther: true }
const intro = 'Привет! Это автор TraleBot.'
const kit: SurveyBuilderKitDto = {
  presets: [{ id: 'users', title: 'Тем, кто пользуется', about: 'Насколько TraleBot нужен', form: { intro, questions: [ifGone, whyGeorgian, annoyed] } }],
  bank: [ifGone, whyGeorgian, annoyed, paywall],
  suggestions: ['Нет времени', 'Дорого'],
  intro,
  otherLabel: 'Другое',
  limits: { questions: 6, options: 6, botOptions: 4, optionLength: 64, questionLength: 300 }
}
const form = { intro, questions: [ifGone, whyGeorgian, annoyed] }
const status = {
  key: 'survey-2026-10-users', audience: 'accessEnded' as const, message: `${intro}\n\n${ifGone.text}`, buttonText: null, buttonQuery: null,
  total: 100, sample: 100, pending: 100, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
  giftDays: 0, giftOfferEndsAtUtc: null, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0,
  surveyAnswers: ifGone.options.map(option => ({ option, count: 0 })),
  survey: { intro, questions: form.questions.map((q, i) => ({ ...q, id: `q${i + 1}` })) }
}
const picked = (key: string, n: number, dryRun: boolean) => ({ key, dryRun, audienceTotal: 553, alreadyInCampaign: 0, picked: n, leftForLater: 553 - n })
const survey = (key: string, title: string, sent: number, total: number) => ({
  key, title, questions: 3, createdAtUtc: '2026-10-08T10:00:00Z', audience: 'accessEnded' as const, picked: total, pending: total - sent,
  funnel: { sent, answeredFirst: 0, openedForm: 0, finished: 0 }
})
const listed = (items: ReturnType<typeof survey>[]) => ({ recent: [], paywall: { shown: 0, options: [] }, messages: 0, surveys: items })

let navigate: Mock<(s: Screen) => void>

beforeEach(() => {
  ;[...Object.values(campaigns), ...Object.values(surveys), ...Object.values(feedback)].forEach(f => (f as ReturnType<typeof vi.fn>).mockReset())
  surveys.presets.mockResolvedValue(kit)
  campaigns.audiences.mockResolvedValue({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512 })
  feedback.overview.mockResolvedValue(listed([]))
  navigate = vi.fn<(s: Screen) => void>()
  window.scrollTo = vi.fn() as never
})
afterEach(() => vi.unstubAllGlobals())

async function open() {
  render(<SurveyBuilderScreen navigate={navigate} />)
  await screen.findByTestId('survey-preset-users')
}
const title = () => screen.getByTestId('survey-step-title').textContent
const next = () => userEvent.click(screen.getByTestId('survey-next'))
const cards = () => within(screen.getByTestId('survey-questions')).getAllByTestId(/^survey-question-\d$/)
const cardTexts = () => cards().map(c => within(c).getByTestId(/^survey-question-open-/).textContent)

/** От заготовки до шага «Отправка», ничего не вводя. */
async function toSending() {
  await open()
  await userEvent.click(screen.getByTestId('survey-preset-users'))
  await next()
  await next()
  expect(title()).toBe('Отправка')
}

describe('questionProblem', () => {
  it('the first question lives in the bot: it has options, four at most; later ones may be free or have six', () => {
    expect(questionProblem(annoyed, true, kit)).toContain('Первый вопрос приходит в бот кнопками — ему нужны варианты')
    expect(questionProblem(whyGeorgian, true, kit)).toContain('у него не больше 4 вариантов')
    expect(questionProblem(annoyed, false, kit)).toBeNull()
    expect(questionProblem(whyGeorgian, false, kit)).toBeNull()
    expect(questionProblem(ifGone, true, kit)).toBeNull()
    expect(questionProblem({ ...ifGone, options: ['Да'] }, false, kit)).toBe('Нужно хотя бы два варианта ответа.')
    expect(questionProblem({ ...ifGone, options: ['Да', ' Да '] }, false, kit)).toBe('Два варианта совпадают.')
    expect(questionProblem({ ...ifGone, options: ['1', '2', '3', '4', '5', '6', '7'] }, false, kit)).toBe('Не больше 6 вариантов ответа.')
    expect(questionProblem({ ...paywall, options: ['Дорого', 'Другое'] }, false, kit)).toContain('«Другое» уже добавляет переключатель')
    expect(questionProblem({ ...ifGone, text: '  ' }, false, kit)).toBe('Напиши текст вопроса.')
  })
})

describe('SurveyBuilderScreen', () => {
  it('a ready-made form goes all the way to sending without typing a word', async () => {
    await open()
    expect(title()).toBe('Выбери опрос')
    const preset = screen.getByTestId('survey-preset-users')
    expect(preset.textContent).toContain('Тем, кто пользуется')
    expect(preset.textContent).toContain('вопросов: 3')
    expect(preset.textContent).toContain('2.Зачем тебе грузинский?')

    await userEvent.click(preset)
    expect(title()).toBe('Вопросы')
    expect(screen.getByTestId('survey-preview').textContent).toBe(`${intro}\n\n${ifGone.text}Очень расстроюсьНемного расстроюсьМне всё равноУже не пользуюсь`)
    expect(cardTexts()).toEqual([
      `Вопрос 1 · в боте${ifGone.text}Очень расстроюсь · Немного расстроюсь · Мне всё равно · Уже не пользуюсь`,
      `Вопрос 2${whyGeorgian.text}Живу в Грузии · Собираюсь переехать · Еду в поездку · Семья или близкие · Просто интересно · Другое`,
      `Вопрос 3${annoyed.text}свободный ответ`
    ])
    expect(screen.queryByTestId('survey-problem')).toBeNull()

    await next()
    expect(title()).toBe('Кому отправить')
    expect(screen.getByTestId('survey-audience-activeLately').textContent).toBe('занимались за последние 30 дней61')
    expect(screen.getByTestId('survey-audience-inactiveLong').textContent).toBe('не занимались больше 30 дней512')
    expect(screen.queryByText('только я (посмотреть)')).toBeNull()

    await next()
    expect(title()).toBe('Отправка')
    expect(screen.getByTestId('survey-summary').textContent).toBe('Вопросов: 3 — первый в боте, остальные в мини-аппе. Кому: доступ закончился — 553 чел., сначала пробной группе из 100')
    expect(campaigns.prepare).not.toHaveBeenCalled()
  })

  it('a question opens on its own screen: text, options by taps, the «Другое» switch', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-users'))
    await userEvent.click(screen.getByTestId('survey-question-open-1'))

    const editor = screen.getByTestId('survey-question-editor')
    expect(editor.textContent).toContain('Вопрос 2 из 3')
    expect(screen.queryByTestId('survey-questions')).toBeNull()
    expect(screen.queryByTestId('survey-next')).toBeNull()
    expect(screen.getByTestId('survey-other').getAttribute('aria-checked')).toBe('true')

    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Семья или близкие' }))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Еду в поездку' }))
    await userEvent.click(screen.getByTestId('survey-option-2'))
    await userEvent.clear(screen.getByLabelText('Вариант 3'))
    await userEvent.type(screen.getByLabelText('Вариант 3'), 'Для работы{Enter}')
    await userEvent.click(within(screen.getByTestId('survey-suggestions')).getByRole('button', { name: 'Нет времени' }))
    await userEvent.click(screen.getByTestId('survey-other'))
    await userEvent.clear(screen.getByLabelText('Текст вопроса'))
    await userEvent.type(screen.getByLabelText('Текст вопроса'), 'Для чего тебе грузинский?')
    await userEvent.click(screen.getByTestId('survey-question-done'))

    expect(cardTexts()[1]).toBe('Вопрос 2Для чего тебе грузинский?Живу в Грузии · Собираюсь переехать · Для работы · Нет времени')
    expect(cardTexts()[0]).toContain(ifGone.text)
  })

  it('the headline number keeps to its two options through renaming, and the builder says so when one of them is removed', async () => {
    campaigns.prepare.mockResolvedValue(picked('survey-2026-10-users-test', 1, false))
    campaigns.send.mockResolvedValue({ sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status })
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-users'))
    expect(screen.getByTestId('survey-question-headline-0').textContent).toBe('с главной цифрой в результатах')
    expect(screen.queryByTestId('survey-question-headline-1')).toBeNull()

    await userEvent.click(screen.getByTestId('survey-question-open-0'))
    expect(screen.getByTestId('survey-headline-ok').textContent).toContain('доля «Очень расстроюсь» среди ответивших, не считая тех, кто выбрал «Уже не пользуюсь»')
    await userEvent.click(screen.getByTestId('survey-option-0'))
    await userEvent.clear(screen.getByLabelText('Вариант 1'))
    await userEvent.type(screen.getByLabelText('Вариант 1'), 'Ещё как!{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Немного расстроюсь' }))
    expect(screen.getByTestId('survey-headline-ok').textContent).toContain('доля «Ещё как!» среди ответивших, не считая тех, кто выбрал «Уже не пользуюсь»')
    expect(screen.queryByTestId('survey-headline-lost')).toBeNull()
    await userEvent.click(screen.getByTestId('survey-question-done'))
    await next()
    await next()
    await userEvent.click(screen.getByTestId('survey-send-me'))
    await waitFor(() => expect(campaigns.prepare).toHaveBeenCalledTimes(1))
    expect(campaigns.prepare.mock.calls[0][0].survey?.questions[0]).toMatchObject({
      options: ['Ещё как!', 'Мне всё равно', 'Уже не пользуюсь'], optionKeys: ['very', 'indifferent', 'unused'], headlineOption: 'very', headlineWithout: 'unused'
    })

    await userEvent.click(screen.getByTestId('survey-back'))
    await userEvent.click(screen.getByTestId('survey-back'))
    await userEvent.click(screen.getByTestId('survey-question-open-0'))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вариант Уже не пользуюсь' }))
    expect(screen.queryByTestId('survey-headline-ok')).toBeNull()
    expect(screen.getByTestId('survey-headline-lost').textContent).toContain('Главной цифры по этому вопросу в результатах не будет: убран один из двух вариантов')
    await userEvent.click(screen.getByTestId('survey-question-done'))
    expect(screen.getByTestId('survey-question-headline-0').textContent).toContain('главной цифры в результатах не будет')
    expect(screen.queryByTestId('survey-headline-removed')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Убрать вопрос 1' }))
    expect(screen.getByTestId('survey-headline-removed').textContent).toContain('Ты его убрал, цифры в результатах не будет')
    await userEvent.click(screen.getByTestId('survey-add-question'))
    await userEvent.click(within(screen.getByTestId('survey-bank')).getByRole('button', { name: new RegExp(ifGone.text.slice(0, 20)) }))
    expect(screen.queryByTestId('survey-headline-removed')).toBeNull()
  })

  it('the first question cannot be free or have more than four options — the builder says why and does not go on', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-users'))

    await userEvent.click(screen.getByRole('button', { name: 'Поднять вопрос 2' }))
    expect(cardTexts()[0]).toContain(whyGeorgian.text)
    expect(screen.getByTestId('survey-question-problem-0').textContent).toContain('у него не больше 4 вариантов')
    expect(screen.getByTestId('survey-problem').textContent).toBe('Поправь вопрос 1: он отмечен красным.')
    expect((screen.getByTestId('survey-next') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('survey-try') as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Опустить вопрос 1' }))
    expect(screen.queryByTestId('survey-problem')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вопрос 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Убрать вопрос 1' }))
    expect(cardTexts()).toEqual([`Вопрос 1 · в боте${annoyed.text}свободный ответ`])
    expect(screen.getByTestId('survey-question-problem-0').textContent).toContain('ему нужны варианты ответа')

    await userEvent.click(screen.getByTestId('survey-question-open-0'))
    expect((screen.getByRole('radio', { name: 'Свободный ответ' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('survey-editor-problem').textContent).toContain('ему нужны варианты ответа')
  })

  it('questions are added from the ready ones or written, up to six', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-custom'))
    const bank = screen.getByTestId('survey-bank')
    expect(within(bank).getAllByRole('button').map(b => b.textContent).slice(0, 2)).toEqual(['Свой вопрос с вариантами', 'Свой вопрос — свободный ответ'])

    await userEvent.click(within(bank).getByRole('button', { name: new RegExp(paywall.text.slice(0, 20)) }))
    expect(cardTexts()).toEqual([`Вопрос 1 · в боте${paywall.text}Дорого · Пока не нужно · Другое`])

    await userEvent.click(screen.getByTestId('survey-add-question'))
    expect(screen.getByTestId('survey-bank').textContent).not.toContain(paywall.text)
    await userEvent.click(screen.getByTestId('survey-new-text'))
    expect(screen.getByTestId('survey-question-editor').textContent).toContain('Вопрос 2 из 2')
    await userEvent.type(screen.getByLabelText('Текст вопроса'), 'Что ещё хочешь сказать?')
    await userEvent.click(screen.getByTestId('survey-question-done'))
    expect(cardTexts()[1]).toBe('Вопрос 2Что ещё хочешь сказать?свободный ответ')

    for (const q of [ifGone, whyGeorgian, annoyed]) {
      await userEvent.click(screen.getByTestId('survey-add-question'))
      await userEvent.click(within(screen.getByTestId('survey-bank')).getByRole('button', { name: new RegExp(q.text.slice(0, 20)) }))
    }
    await userEvent.click(screen.getByTestId('survey-add-question'))
    await userEvent.click(screen.getByTestId('survey-new-text'))
    await userEvent.click(screen.getByTestId('survey-question-done'))
    expect(cards()).toHaveLength(6)
    expect(screen.queryByTestId('survey-add-question')).toBeNull()
    expect(screen.getByText('В опросе не больше 6 вопросов.')).toBeTruthy()
  })

  it('«Посмотреть как пользователь» walks the form and records nothing', async () => {
    await open()
    await userEvent.click(screen.getByTestId('survey-preset-users'))
    await userEvent.click(screen.getByTestId('survey-try'))

    const preview = screen.getByTestId('survey-try-form')
    expect(preview.textContent).toContain('Ответы никуда не записываются')
    expect(screen.getByTestId('survey-progress').textContent).toBe('Вопрос 1 из 3')
    await userEvent.click(screen.getByRole('radio', { name: 'Мне всё равно' }))
    await userEvent.click(screen.getByTestId('survey-page-next'))
    await waitFor(() => expect(screen.getByTestId('survey-progress').textContent).toBe('Вопрос 2 из 3'))
    await userEvent.click(screen.getByRole('radio', { name: 'Другое' }))
    expect(screen.getByLabelText('Свой ответ')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Закрыть предпросмотр' }))

    expect(title()).toBe('Вопросы')
    expect(campaigns.prepare).not.toHaveBeenCalled()
    expect(campaigns.send).not.toHaveBeenCalled()
  })

  it('«Отправить себе» sends the whole form as a trial to the owner only, under a name made by the server', async () => {
    campaigns.prepare.mockResolvedValue(picked('survey-2026-10-users-test', 1, false))
    campaigns.send.mockResolvedValue({ sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: { ...status, pending: 0, sent: 1 } })
    await toSending()

    await userEvent.click(screen.getByTestId('survey-send-me'))

    expect((await screen.findByTestId('survey-note')).textContent).toContain('пройди форму до конца')
    expect(campaigns.prepare).toHaveBeenCalledTimes(1)
    expect(campaigns.prepare.mock.calls[0][0]).toMatchObject({ key: '', newSurveySlug: 'users-test', audience: 'owner', survey: form, sampleSize: null, dryRun: false })
    expect(campaigns.send).toHaveBeenCalledWith('survey-2026-10-users-test', 1)
    expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('survey-back')).toBeTruthy()
  })

  it('a batch cannot be sent until recipients are picked; picking asks first and sends nothing', async () => {
    const confirm = vi.fn((_text: string) => true)
    vi.stubGlobal('confirm', confirm)
    campaigns.prepare.mockResolvedValueOnce(picked('survey-2026-10-users', 100, true)).mockResolvedValueOnce(picked('survey-2026-10-users', 100, false))
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
      { key: '', newSurveySlug: 'users', audience: 'accessEnded', sampleSize: 100, dryRun: true, survey: form },
      { key: '', newSurveySlug: 'users', audience: 'accessEnded', sampleSize: 100, dryRun: false, survey: form }
    ])
    expect(campaigns.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('survey-back')).toBeNull()
    expect(screen.getByText(/вопросы уже не поменять/)).toBeTruthy()

    await userEvent.click(send)
    await waitFor(() => expect(campaigns.send).toHaveBeenCalledWith('survey-2026-10-users', 25))
    expect(confirm.mock.calls[1][0]).toContain('ОТПРАВИТЬ опрос 25 людям')
    expect(confirm.mock.calls[1][0]).toContain(ifGone.text)
    expect(screen.getByTestId('survey-status').textContent).toContain('ждут 75')

    await userEvent.click(screen.getByTestId('survey-open-results'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-feedback', view: { survey: 'survey-2026-10-users' } })
  })

  it('a declined confirmation picks nobody and leaves the survey editable', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    campaigns.prepare.mockResolvedValue(picked('survey-2026-10-users', 100, true))
    await toSending()

    await userEvent.click(screen.getByTestId('survey-pick'))

    await waitFor(() => expect(campaigns.prepare).toHaveBeenCalledTimes(1))
    expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('survey-back')).toBeTruthy()
  })

  it('a survey left half sent waits on the first step; «Продолжить» opens its sending with the same form', async () => {
    feedback.overview.mockResolvedValue(listed([
      survey('survey-2026-10-users', ifGone.text, 75, 553),
      survey('survey-2026-09-left', 'Ты сейчас учишь грузинский?', 17, 17)
    ]))
    campaigns.status.mockResolvedValue({ ...status, total: 553, sample: 0, pending: 478, sent: 75 })
    await open()

    const left = await screen.findByTestId('survey-unfinished')
    expect(left.textContent).toContain(`${ifGone.text}отправлено 75 из 553`)
    expect(left.textContent).not.toContain('Ты сейчас учишь грузинский?')
    expect(left.textContent).not.toContain('survey-2026')

    await userEvent.click(within(left).getByRole('button', { name: 'Продолжить' }))

    await waitFor(() => expect(title()).toBe('Отправка'))
    expect(campaigns.status).toHaveBeenCalledWith('survey-2026-10-users')
    expect(screen.getByTestId('survey-preview').textContent).toContain(ifGone.text)
    expect(screen.getByTestId('survey-summary').textContent).toBe('Вопросов: 3 — первый в боте, остальные в мини-аппе. Кому: доступ закончился — 553 чел.')
    expect(screen.getByTestId('survey-status').textContent).toContain('Выбрано 553 · ждут 478 · дошло 75')
    expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('survey-pick') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('survey-back')).toBeNull()
  })

  it('opened for a survey by its name, goes on sending and then picks the rest of the group under the same name', async () => {
    const confirm = vi.fn((_text: string) => true)
    vi.stubGlobal('confirm', confirm)
    const sampleLeft = { ...status, pending: 20, sent: 80 }
    const sampleDone = { ...sampleLeft, pending: 0, sent: 100 }
    campaigns.status.mockResolvedValueOnce(sampleLeft).mockResolvedValueOnce(sampleLeft).mockResolvedValue({ ...sampleDone, total: 553, pending: 453 })
    campaigns.send.mockResolvedValue({ sent: 20, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: sampleDone })
    campaigns.prepare.mockResolvedValueOnce(picked('survey-2026-10-users', 453, true)).mockResolvedValueOnce(picked('survey-2026-10-users', 453, false))
    render(<SurveyBuilderScreen resume="survey-2026-10-users" navigate={navigate} />)
    await waitFor(() => expect(title()).toBe('Отправка'))

    await userEvent.click(screen.getByTestId('survey-send'))
    await waitFor(() => expect(campaigns.send).toHaveBeenCalledWith('survey-2026-10-users', 25))
    await waitFor(() => expect((screen.getByTestId('survey-send') as HTMLButtonElement).disabled).toBe(true))

    await userEvent.click(screen.getByRole('button', { name: 'Выбрать всех остальных' }))
    await waitFor(() => expect(campaigns.prepare).toHaveBeenCalledTimes(2))
    expect(campaigns.prepare.mock.calls[1][0]).toMatchObject({ key: 'survey-2026-10-users', audience: 'accessEnded', sampleSize: null, dryRun: false })
    expect(campaigns.prepare.mock.calls[1][0].survey?.questions.map(q => q.text)).toEqual(form.questions.map(q => q.text))
    await waitFor(() => expect(screen.getByTestId('survey-status').textContent).toContain('Выбрано 553 · ждут 453'))
  })

  it('shows nothing but the reason to anyone the server refuses or for a name of no survey', async () => {
    const { ApiError } = await import('../../api')
    surveys.presets.mockRejectedValueOnce(new ApiError(404, ''))
    const first = render(<SurveyBuilderScreen navigate={navigate} />)
    expect(await screen.findByText('Нет доступа.')).toBeTruthy()
    expect(screen.queryByTestId('survey-step-title')).toBeNull()
    first.unmount()

    campaigns.status.mockRejectedValue(new ApiError(404, ''))
    render(<SurveyBuilderScreen resume="survey-2026-10-gone" navigate={navigate} />)
    expect(await screen.findByText('Такого опроса нет.')).toBeTruthy()
    expect(screen.queryByTestId('survey-send')).toBeNull()
  })
})
