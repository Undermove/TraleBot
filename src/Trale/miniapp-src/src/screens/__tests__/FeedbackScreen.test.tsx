import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, feedback as mocked } from '../../api'
import { defaultProgress } from '../../progress'
import FeedbackScreen from '../FeedbackScreen'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  FEEDBACK_MAX_LENGTH: 2000,
  feedback: { send: vi.fn(), thread: vi.fn() }
}))
vi.mock('../../components/Mascot', () => ({ default: () => null }))
const api = vi.mocked(mocked)

beforeEach(() => {
  api.send.mockReset()
  api.thread.mockReset()
  api.thread.mockResolvedValue({ items: [] })
})

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

  it('promises an answer in the chat with the bot and shows the conversation once the author has answered', async () => {
    api.send.mockResolvedValue({ ok: true })
    api.thread.mockResolvedValue({ items: [
      { fromOwner: false, text: 'Когда будут новые уроки?', atUtc: '2026-10-08T10:00:00Z' },
      { fromOwner: true, text: 'В октябре', atUtc: '2026-10-08T11:00:00Z' }
    ] })
    render(<FeedbackScreen progress={defaultProgress} onBack={() => {}} />)

    const thread = await screen.findByTestId('feedback-thread')
    expect(thread.textContent).toBe('Наша перепискаКогда будут новые уроки?Дима, автор TraleBotВ октябре')
    expect(screen.getByText('Напиши ответ — я прочитаю.')).toBeTruthy()
    expect(screen.getByText('Отвечу сюда же, в чат с ботом.')).toBeTruthy()
    expect(screen.queryByText(/чат поддержки/)).toBeNull()

    await userEvent.type(field(), 'А про падежи?')
    await userEvent.click(sendButton())
    expect(api.send).toHaveBeenCalledWith('А про падежи?', undefined)
    expect((await screen.findByTestId('feedback-sent')).textContent).toContain('Отвечу сюда же, в чат с ботом.')
  })

  it('shows no conversation to someone the author has not answered, and opens even when it cannot be loaded', async () => {
    api.thread.mockRejectedValue(new Error('offline'))
    render(<FeedbackScreen progress={defaultProgress} onBack={() => {}} />)
    expect(screen.getByText('Что нравится, чего не хватает, что неудобно — пиши как есть.')).toBeTruthy()
    expect(screen.queryByTestId('feedback-thread')).toBeNull()
    expect(sendButton()).toBeTruthy()
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
