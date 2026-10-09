import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api as mockedApi, feedback as mockedFeedback } from '../api'
import ProPaywall from './ProPaywall'

vi.mock('../api', async () => ({
  ...(await vi.importActual<typeof import('../api')>('../api')),
  api: { plans: vi.fn(), purchase: vi.fn(), me: vi.fn() },
  feedback: { paywallQuestionDue: vi.fn(), paywallQuestion: vi.fn(), paywallAnswer: vi.fn(), send: vi.fn() }
}))
vi.mock('./Mascot', () => ({ default: () => null }))
const api = vi.mocked(mockedApi)
const feedback = vi.mocked(mockedFeedback)

const plans = { plans: [{ id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' }] }

beforeEach(() => {
  ;[...Object.values(api), ...Object.values(feedback)].forEach(f => (f as ReturnType<typeof vi.fn>).mockReset())
  api.plans.mockResolvedValue(plans as never)
  feedback.paywallQuestionDue.mockResolvedValue({ due: true })
  feedback.paywallQuestion.mockResolvedValue({ show: true, id: 'question-1' })
  feedback.paywallAnswer.mockResolvedValue({ ok: true })
})

/** Шторка с загруженными тарифами; onClose — закрылась ли она совсем. */
async function open() {
  const onClose = vi.fn()
  const onPurchaseSuccess = vi.fn()
  render(<ProPaywall trigger="module" onClose={onClose} onPurchaseSuccess={onPurchaseSuccess} />)
  await screen.findByText('1 месяц')
  await waitFor(() => expect(feedback.paywallQuestionDue).toHaveBeenCalledTimes(1))
  return { onClose, onPurchaseSuccess }
}

const decline = () => userEvent.click(screen.getByRole('button', { name: 'Нет, пока нет' }))

describe('ProPaywall — «Что смутило?»', () => {
  it('closing without a purchase asks one question in the same sheet', async () => {
    const { onClose } = await open()
    expect(feedback.paywallQuestion).not.toHaveBeenCalled()

    await decline()

    expect(await screen.findByTestId('paywall-question')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Что смутило?' })).toBeTruthy()
    expect(screen.getAllByRole('radio').map(r => r.textContent)).toEqual(['Дорого', 'Пока не нужно', 'Непонятно, что я получу', 'Другое'])
    expect(screen.queryByText('1 месяц')).toBeNull()
    expect(feedback.paywallQuestion).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('the chosen option and the words go to the shown question, then the sheet closes', async () => {
    const { onClose } = await open()
    await decline()
    await screen.findByTestId('paywall-question')
    expect((screen.getByRole('button', { name: 'Отправить' }) as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(screen.getByRole('radio', { name: 'Дорого' }))
    await userEvent.type(screen.getByLabelText('Своими словами'), ' Звёзды неудобно покупать ')
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

    expect(feedback.paywallAnswer).toHaveBeenCalledWith('question-1', 'expensive', 'Звёзды неудобно покупать')
    expect(await screen.findByTestId('paywall-question-thanks')).toBeTruthy()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })

  it('the question can be closed without an answer', async () => {
    const { onClose } = await open()
    await decline()
    await screen.findByTestId('paywall-question')

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(feedback.paywallAnswer).not.toHaveBeenCalled()
  })

  it('nothing is asked when the server says no question is due', async () => {
    feedback.paywallQuestionDue.mockResolvedValue({ due: false })
    const { onClose } = await open()

    await decline()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(feedback.paywallQuestion).not.toHaveBeenCalled()
    expect(screen.queryByTestId('paywall-question')).toBeNull()
  })

  it('the sheet just closes when the server decides at the last moment not to show', async () => {
    feedback.paywallQuestion.mockResolvedValueOnce({ show: false, id: null })
    const first = await open()
    await decline()
    await waitFor(() => expect(first.onClose).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('paywall-question')).toBeNull()
  })

  it('a failed check or a failed request never keeps the sheet open', async () => {
    feedback.paywallQuestionDue.mockRejectedValue(new Error('offline'))
    const { onClose } = await open()
    await decline()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(feedback.paywallQuestion).not.toHaveBeenCalled()
  })

  it('nothing is asked after a purchase', async () => {
    api.purchase.mockResolvedValue({ alreadyPro: true } as never)
    const { onClose, onPurchaseSuccess } = await open()

    await userEvent.click(screen.getByRole('button', { name: /Купить за 100/ }))
    await screen.findByText('Оплата прошла')
    await userEvent.click(screen.getByRole('button', { name: 'Начать учиться' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onPurchaseSuccess).toHaveBeenCalledTimes(1)
    expect(feedback.paywallQuestion).not.toHaveBeenCalled()
  })
})
