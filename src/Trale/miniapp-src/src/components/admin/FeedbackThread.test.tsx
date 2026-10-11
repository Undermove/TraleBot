import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, adminThreads as mocked, type FeedbackThreadDto, type FeedbackThreadItemDto } from '../../api'
import FeedbackThread from './FeedbackThread'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminThreads: { list: vi.fn(), get: vi.fn(), reply: vi.fn(), dismiss: vi.fn() }
}))
const api = vi.mocked(mocked)

const item = (id: string, over: Partial<FeedbackThreadItemDto>): FeedbackThreadItemDto =>
  ({ id, fromOwner: false, text: '', atUtc: '2026-10-08T10:00:00Z', kind: 'message', question: null, option: null, delivery: null, quote: null, ...over })
const letter = item('a1', { text: 'Не хватает озвучки\nу моих слов' })
const surveyWords = item('a2', { kind: 'survey', question: 'Что было неудобно?', text: 'Долгие уроки', atUtc: '2026-10-08T11:00:00Z' })
const paywallWords = item('a3', { kind: 'paywall', option: 'expensive', text: 'Год — дорого', atUtc: '2026-10-08T12:00:00Z' })
const thread = (items: FeedbackThreadItemDto[], over: Partial<FeedbackThreadDto> = {}): FeedbackThreadDto =>
  ({ telegramId: 111, reachable: true, status: 'new', items, maxReplyLength: 3500, signature: 'Дима, автор TraleBot', ...over })
const mine = (text: string, delivery: FeedbackThreadItemDto['delivery']) => item(`r-${text}`, { fromOwner: true, kind: null, text, delivery, atUtc: '2026-10-08T13:00:00Z' })

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.get.mockResolvedValue(thread([letter, surveyWords, paywallWords]))
  api.reply.mockResolvedValue({ delivery: 'sent', repeated: false })
  api.dismiss.mockResolvedValue({ ok: true })
})

const field = () => screen.getByLabelText('Твой ответ') as HTMLTextAreaElement
const send = () => screen.getByTestId('thread-send') as HTMLButtonElement

describe('FeedbackThread', () => {
  it('shows who it is, where each of their texts came from, and the status', async () => {
    const openUser = vi.fn()
    render(<FeedbackThread telegramId={111} onOpenUser={openUser} />)

    const theirs = await screen.findAllByTestId('thread-theirs')
    expect(theirs.map(t => t.textContent)).toEqual([
      expect.stringMatching(/^письмо автору · .+Не хватает озвучки\nу моих слов$/),
      expect.stringMatching(/^опрос: Что было неудобно\? · .+Долгие уроки$/),
      expect.stringMatching(/^экран покупки · Дорого · .+Год — дорого$/)
    ])
    expect(screen.getByTestId('thread-status').textContent).toBe('новое')
    expect(send().disabled).toBe(true)
    await userEvent.click(screen.getByTestId('thread-user'))
    expect(openUser).toHaveBeenCalledWith(111)
  })

  it('previews the bot message — the quoted words, the signature, the «Ответить» button — and sends the answer once', async () => {
    api.get.mockResolvedValueOnce(thread([letter, surveyWords, paywallWords]))
      .mockResolvedValue(thread([letter, surveyWords, paywallWords, mine('Сделаю месяц дешевле', 'sent')], { status: 'answered' }))
    render(<FeedbackThread telegramId={111} quoteId="a1" onOpenUser={() => {}} />)
    await screen.findAllByTestId('thread-theirs')
    expect(screen.queryByTestId('thread-preview')).toBeNull()

    await userEvent.type(field(), '  Сделаю месяц дешевле ')
    expect(screen.getByTestId('thread-preview').textContent).toBe(
      'Так придёт человеку в бот:Твоё сообщение: «Не хватает озвучки у моих слов»\n\nДима, автор TraleBot: Сделаю месяц дешевлеОтветить')
    await userEvent.dblClick(send())

    await waitFor(() => expect(screen.getByTestId('thread-note').textContent).toBe('Ответ отправлен.'))
    expect(api.reply).toHaveBeenCalledTimes(1)
    expect(api.reply).toHaveBeenCalledWith(111, 'Сделаю месяц дешевле', expect.any(String), 'a1')
    expect(field().value).toBe('')
    expect(screen.getByTestId('thread-owner').textContent).toContain('Сделаю месяц дешевле')
    expect(screen.getByTestId('thread-status').textContent).toBe('отвечено')
    expect(screen.queryByTestId('thread-dismiss')).toBeNull()
  })

  it('without a chosen text quotes the latest one; a new answer gets a new token, a failed one keeps its token', async () => {
    render(<FeedbackThread telegramId={111} onOpenUser={() => {}} />)
    await screen.findAllByTestId('thread-theirs')
    api.reply.mockRejectedValueOnce(new Error('offline'))

    await userEvent.type(field(), 'Первый')
    expect(screen.getByTestId('thread-preview').textContent).toContain('Твоё сообщение: «Год — дорого»')
    await userEvent.click(send())
    await waitFor(() => expect(screen.getByTestId('thread-note').textContent).toContain('нажми ещё раз'))
    expect(field().value).toBe('Первый')
    await userEvent.click(send())
    await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(field().value).toBe(''))
    await userEvent.type(field(), 'Второй')
    await userEvent.click(send())
    await waitFor(() => expect(api.reply).toHaveBeenCalledTimes(3))

    const tokens = api.reply.mock.calls.map(c => c[2])
    expect(tokens[0]).toBe(tokens[1])
    expect(tokens[2]).not.toBe(tokens[0])
    expect(api.reply.mock.calls.every(c => c[3] === 'a3')).toBe(true)
  })

  it('says in plain words when the answer did not reach the person', async () => {
    api.get.mockResolvedValue(thread([letter, mine('Привет', 'blocked'), mine('Ещё раз', 'rejected'), mine('И ещё', 'unknown')], { reachable: false, status: 'answered' }))
    render(<FeedbackThread telegramId={111} onOpenUser={() => {}} />)

    await screen.findAllByTestId('thread-owner')
    expect(screen.getAllByTestId('thread-delivery').map(d => d.textContent)).toEqual([
      'человек заблокировал бота — ответ не доставлен',
      'Telegram не принял сообщение — ответ не доставлен',
      'Telegram не ответил — неизвестно, дошёл ли ответ'
    ])
    expect(screen.getByTestId('thread-unreachable').textContent).toBe('Человек заблокировал бота — ответ до него не дойдёт.')

    api.reply.mockResolvedValue({ delivery: 'blocked', repeated: false })
    await userEvent.type(field(), 'Ау')
    await userEvent.click(send())
    await waitFor(() => expect(screen.getByTestId('thread-note').textContent).toBe('Ответ записан, но человек заблокировал бота — ответ не доставлен.'))
  })

  it('«Не требует ответа» takes the person out of the unanswered without sending anything', async () => {
    api.get.mockResolvedValueOnce(thread([letter])).mockResolvedValue(thread([letter], { status: 'closed' }))
    render(<FeedbackThread telegramId={111} onOpenUser={() => {}} />)

    await userEvent.click(await screen.findByTestId('thread-dismiss'))

    await waitFor(() => expect(screen.getByTestId('thread-status').textContent).toBe('не требует ответа'))
    expect(api.dismiss).toHaveBeenCalledWith(111)
    expect(api.reply).not.toHaveBeenCalled()
    expect(screen.getByTestId('thread-note').textContent).toBe('Убрано из неотвеченных. Человеку ничего не ушло.')
    expect(screen.queryByTestId('thread-dismiss')).toBeNull()
  })

  it('does not let an answer longer than a Telegram message be sent, and shows the server\'s reason for a refusal', async () => {
    api.get.mockResolvedValue(thread([letter], { maxReplyLength: 10 }))
    render(<FeedbackThread telegramId={111} onOpenUser={() => {}} />)
    await screen.findAllByTestId('thread-theirs')

    await userEvent.type(field(), 'Одиннадцать')
    expect(send().disabled).toBe(true)
    expect(screen.getByText('Ответ длиннее 10 символов — сократи.')).toBeTruthy()

    api.reply.mockRejectedValue(new ApiError(400, '{"error":"Этот человек ничего не писал — отвечать не на что."}'))
    await userEvent.clear(field())
    await userEvent.type(field(), 'Короче')
    await userEvent.click(send())
    await waitFor(() => expect(screen.getByTestId('thread-note').textContent).toBe('Этот человек ничего не писал — отвечать не на что.'))
  })

  it('shows nothing of the conversation to anyone the server refuses', async () => {
    api.get.mockRejectedValue(new ApiError(404, ''))
    render(<FeedbackThread telegramId={111} onOpenUser={() => {}} />)
    expect((await screen.findByTestId('thread-problem')).textContent).toBe('Нет доступа или такого человека нет.')
    expect(screen.queryByTestId('thread-send')).toBeNull()
  })
})
