import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, feedback as mocked } from '../../api'
import { defaultProgress } from '../../progress'
import FeedbackScreen from '../FeedbackScreen'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  FEEDBACK_MAX_LENGTH: 2000,
  feedback: { send: vi.fn() }
}))
vi.mock('../../components/Mascot', () => ({ default: () => null }))
const api = vi.mocked(mocked)

beforeEach(() => api.send.mockReset())

const field = () => screen.getByLabelText('Твоё сообщение') as HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: 'Отправить' }) as HTMLButtonElement

describe('FeedbackScreen', () => {
  it('sends the trimmed text and says thanks', async () => {
    api.send.mockResolvedValue({ ok: true })
    const back = vi.fn()
    render(<FeedbackScreen progress={defaultProgress} onBack={back} />)
    expect(sendButton().disabled).toBe(true)

    await userEvent.type(field(), '  Не хватает аудио  ')
    await userEvent.click(sendButton())

    expect(api.send).toHaveBeenCalledWith('Не хватает аудио', undefined)
    expect((await screen.findByTestId('feedback-sent')).textContent).toContain('Спасибо!')
    await userEvent.click(screen.getByRole('button', { name: 'Вернуться' }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('opened from a survey, ties the message to that campaign', async () => {
    api.send.mockResolvedValue({ ok: true })
    render(<FeedbackScreen progress={defaultProgress} campaign="why-2026-10" onBack={() => {}} />)
    expect(screen.getByText('Расскажи подробнее — пары слов хватит.')).toBeTruthy()

    await userEvent.type(field(), 'Дорого')
    await userEvent.click(sendButton())

    expect(api.send).toHaveBeenCalledWith('Дорого', 'why-2026-10')
  })

  it('does not send blank text and does not let more than 2000 characters in', async () => {
    render(<FeedbackScreen progress={defaultProgress} onBack={() => {}} />)
    await userEvent.type(field(), '   ')
    expect(sendButton().disabled).toBe(true)
    expect(field().maxLength).toBe(2000)

    fireEvent.change(field(), { target: { value: 'я'.repeat(1234) } })
    expect(screen.getByTestId('feedback-counter').textContent).toBe('1234 / 2000')
    expect(api.send).not.toHaveBeenCalled()
  })

  it('keeps the text and explains when the daily limit is reached or the send failed', async () => {
    api.send.mockRejectedValueOnce(new ApiError(429, '{"error":"too_often"}')).mockRejectedValueOnce(new Error('offline'))
    render(<FeedbackScreen progress={defaultProgress} onBack={() => {}} />)
    await userEvent.type(field(), 'Шестое за день')

    await userEvent.click(sendButton())
    expect((await screen.findByTestId('feedback-error')).textContent).toBe('На сегодня хватит — напиши завтра, я всё прочитаю.')
    expect(field().value).toBe('Шестое за день')

    await userEvent.click(sendButton())
    expect((await screen.findByTestId('feedback-error')).textContent).toBe('Не получилось отправить. Попробуй ещё раз.')
    expect(field().value).toBe('Шестое за день')
  })
})
