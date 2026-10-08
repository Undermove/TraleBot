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

  it('someone the survey was not sent to sees no questions', async () => {
    api.open.mockRejectedValue(new ApiError(404, ''))
    render(<SurveyScreen progress={defaultProgress} surveyKey="survey-2026-10-left" onBack={() => {}} />)
    expect((await screen.findByTestId('survey-problem')).textContent).toContain('Этот опрос уже закрыт или был отправлен не тебе.')
    expect(screen.queryByTestId('survey-page')).toBeNull()
  })
})
