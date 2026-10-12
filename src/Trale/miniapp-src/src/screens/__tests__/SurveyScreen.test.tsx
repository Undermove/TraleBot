import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, surveyApi as mocked } from '../../api'
import { defaultProgress } from '../../progress'
import SurveyScreen from '../SurveyScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  surveyApi: { open: vi.fn(), answer: vi.fn(), finish: vi.fn() }
}))
vi.mock('../../components/Mascot', () => ({ default: () => null }))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const api = vi.mocked(mocked)

const survey = {
  intro: null,
  questions: [
    { id: 'q1', text: 'Ты сейчас учишь грузинский?', kind: 'choice' as const, options: ['Пауза, вернусь', 'Нет, бросил(а)'], allowOther: false },
    { id: 'q2', text: 'Что тебе не понравилось в TraleBot? Пиши как есть.', kind: 'text' as const, options: [], allowOther: false }
  ]
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.answer.mockResolvedValue({ ok: true })
  api.finish.mockResolvedValue({ ok: true })
  window.scrollTo = vi.fn() as never
})

describe('SurveyScreen', () => {
  it('opens the form after the answer given in the bot and sends each answer to that survey', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-left', survey, finished: false, answers: { q1: { option: 'Пауза, вернусь', other: false, text: null } } })
    const back = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-left" onBack={back} />)

    expect((await screen.findByTestId('survey-progress')).textContent).toBe('Вопрос 2 из 2')
    expect(api.open).toHaveBeenCalledWith('survey-2026-10-left')
    await userEvent.type(screen.getByLabelText('Твой ответ'), 'Скучные уроки')
    await userEvent.click(screen.getByTestId('survey-page-next'))

    await waitFor(() => expect(api.finish).toHaveBeenCalledWith('survey-2026-10-left'))
    expect(api.answer).toHaveBeenCalledWith('survey-2026-10-left', 'q2', { option: null, other: false, text: 'Скучные уроки' })
    await userEvent.click(await screen.findByRole('button', { name: 'Вернуться' }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  const promised = { outcome: 'promised' as const, days: 30, untilUtc: null }
  const given = { outcome: 'given' as const, days: 30, untilUtc: new Date(Date.now() + 30 * 86400000).toISOString() }

  it('a survey with a gift opens straight on the first question with the promise above it; the month comes after the last question', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-paid', survey, finished: false, answers: {}, gift: promised })
    api.finish.mockResolvedValue({ ok: true, gift: given })
    const back = vi.fn(), restart = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-paid" onBack={back} restart={restart} />)

    expect((await screen.findByTestId('survey-progress')).textContent).toBe('Вопрос 1 из 2')
    expect(screen.getByTestId('survey-gift-promise').textContent).toBe('Два коротких вопроса — и месяц полного доступа твой')
    expect(screen.queryByTestId('survey-gift')).toBeNull()

    await userEvent.click(screen.getByRole('radio', { name: 'Пауза, вернусь' }))
    await userEvent.click(screen.getByTestId('survey-page-next'))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))

    expect(await screen.findByTestId('survey-thanks')).toBeTruthy()
    expect(screen.getByTestId('survey-gift-title').textContent).toBe('Месяц полного доступа включён')
    expect(screen.getByTestId('survey-gift-line').textContent).toContain('Действует до')
    // The rest of the app was loaded before the gift: leaving restarts it, so the new access is known everywhere.
    await userEvent.click(screen.getByRole('button', { name: 'В приложение' }))
    expect(restart).toHaveBeenCalledTimes(1)
    expect(back).not.toHaveBeenCalled()
  })

  it('whoever skipped every question is told that one answer brings the month, and goes back to the questions', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-paid', survey, finished: false, answers: {}, gift: promised })
    api.finish.mockResolvedValueOnce({ ok: true, gift: { outcome: 'needsAnswer', days: 30, untilUtc: null } }).mockResolvedValueOnce({ ok: true, gift: given })
    const back = vi.fn(), restart = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-paid" onBack={back} restart={restart} />)

    await screen.findByTestId('survey-progress')
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))

    expect((await screen.findByTestId('survey-gift-title')).textContent).toBe('Ответь хотя бы на один вопрос, и месяц твой')
    expect(screen.queryByText('Спасибо!')).toBeNull()
    expect(api.answer).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('survey-back-to-questions'))
    expect(screen.getByTestId('survey-progress').textContent).toBe('Вопрос 1 из 2')
    await userEvent.click(screen.getByRole('radio', { name: 'Пауза, вернусь' }))
    await userEvent.click(screen.getByTestId('survey-page-next'))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    expect((await screen.findByTestId('survey-gift-title')).textContent).toBe('Месяц полного доступа включён')
    expect(api.finish).toHaveBeenCalledTimes(2)
  })

  it('opening and closing a gift survey asks for nothing and restarts nothing', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-paid', survey, finished: false, answers: {}, gift: promised })
    const back = vi.fn(), restart = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-paid" onBack={back} restart={restart} />)

    await screen.findByTestId('survey-progress')
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(restart).not.toHaveBeenCalled()
    expect(api.finish).not.toHaveBeenCalled()
  })

  it('someone who has been through a gift survey sees «уже ответил» and until when the access runs', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-paid', survey, finished: true, answers: {}, gift: { outcome: 'addedToSubscription', days: 30, untilUtc: '2099-03-05T12:00:00Z' } })
    const back = vi.fn(), restart = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-paid" onBack={back} restart={restart} />)

    expect(await screen.findByTestId('survey-already')).toBeTruthy()
    expect(screen.getByTestId('survey-gift-title').textContent).toBe('Месяц полного доступа добавлен')
    expect(screen.getByTestId('survey-gift-line').textContent).toBe('Подписка теперь действует до 5 марта 2099.')
    await userEvent.click(screen.getByRole('button', { name: 'В приложение' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(restart).not.toHaveBeenCalled()
  })

  it('the owner’s trial walks the same screens with a note and never restarts the app for access that was not given', async () => {
    api.open.mockResolvedValue({ key: 'survey-2026-10-paid-test', survey, finished: false, answers: {}, gift: { ...promised, trial: true } })
    api.finish.mockResolvedValue({ ok: true, gift: { ...given, trial: true } })
    const back = vi.fn(), restart = vi.fn()
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-paid-test" onBack={back} restart={restart} />)

    expect((await screen.findByTestId('survey-gift-trial')).textContent).toContain('дни не начисляются')
    await userEvent.click(screen.getByRole('radio', { name: 'Пауза, вернусь' }))
    await userEvent.click(screen.getByTestId('survey-page-next'))
    await userEvent.click(screen.getByRole('button', { name: 'Пропустить вопрос' }))
    expect((await screen.findByTestId('survey-gift-title')).textContent).toBe('Месяц полного доступа включён')
    expect(screen.getByTestId('survey-gift-trial').textContent).toContain('дни не начислены')
    await userEvent.click(screen.getByRole('button', { name: 'В приложение' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(restart).not.toHaveBeenCalled()
  })

  it('someone the survey was not sent to sees no questions', async () => {
    api.open.mockRejectedValue(new ApiError(404, ''))
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-left" onBack={() => {}} />)
    expect((await screen.findByTestId('survey-problem')).textContent).toContain('Этот опрос уже закрыт или был отправлен не тебе.')
    expect(screen.queryByTestId('survey-page')).toBeNull()
  })
})
