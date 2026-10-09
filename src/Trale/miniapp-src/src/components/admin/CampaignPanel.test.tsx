import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminCampaigns as mocked } from '../../api'
import CampaignPanel from './CampaignPanel'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  adminCampaigns: { audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn() }
}))
const api = vi.mocked(mocked)

const status = {
  key: 'ref-test', audience: 'accessEnded' as const, message: 'Позови друга', buttonText: null, buttonQuery: null,
  total: 100, sample: 100, pending: 100, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
  giftDays: 0, giftOfferEndsAtUtc: null, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0
}
const plan = { key: 'ref-test', dryRun: true, audienceTotal: 553, alreadyInCampaign: 0, picked: 100, leftForLater: 453 }

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.audiences.mockResolvedValue({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512 })
})
afterEach(() => vi.unstubAllGlobals())

async function fill() {
  render(<CampaignPanel />)
  await userEvent.type(screen.getByPlaceholderText('referral-2026-10'), 'ref-test')
  await userEvent.type(screen.getAllByRole('textbox')[1], 'Позови друга')
}

describe('CampaignPanel', () => {
  it('shows how many people each audience has', async () => {
    render(<CampaignPanel />)
    expect(await screen.findByRole('option', { name: 'доступ закончился — 553' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'платят — 3' })).toBeTruthy()
  })

  it('«Посчитать» is a dry run: asks the server to change nothing', async () => {
    api.prepare.mockResolvedValue(plan)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Посчитать' }))
    expect(api.prepare).toHaveBeenCalledTimes(1)
    expect(api.prepare.mock.calls[0][0]).toMatchObject({ key: 'ref-test', audience: 'accessEnded', sampleSize: 100, dryRun: true })
    expect((await screen.findByTestId('campaign-note')).textContent).toContain('будет выбрано 100, останется 453')
    expect(api.send).not.toHaveBeenCalled()
  })

  it('picking the sample asks for confirmation and never sends', async () => {
    const confirm = vi.fn((_text: string) => true)
    vi.stubGlobal('confirm', confirm)
    api.prepare.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, dryRun: false })
    api.status.mockResolvedValue(status)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать пробную группу' }))
    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(confirm.mock.calls[0][0]).toContain('НЕ уйдут')
    expect(api.prepare.mock.calls[1][0]).toMatchObject({ sampleSize: 100, dryRun: false })
    expect(api.send).not.toHaveBeenCalled()
  })

  it('a declined confirmation picks nobody', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    api.prepare.mockResolvedValue(plan)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать всех остальных' }))
    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(1))
    expect(api.prepare.mock.calls[0][0]).toMatchObject({ sampleSize: null, dryRun: true })
  })

  it('sending shows the text, asks for confirmation and sends one batch', async () => {
    const confirm = vi.fn((_text: string) => true)
    vi.stubGlobal('confirm', confirm)
    api.status.mockResolvedValue(status)
    api.send.mockResolvedValue({ sent: 25, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: { ...status, pending: 75, sent: 25 } })
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Статус' }))
    await screen.findByTestId('campaign-status')
    await userEvent.click(screen.getByTestId('campaign-send'))
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1))
    expect(confirm.mock.calls[0][0]).toContain('ОТПРАВИТЬ 25')
    expect(confirm.mock.calls[0][0]).toContain('Позови друга')
    expect(api.send).toHaveBeenCalledWith('ref-test', 25)
    expect((await screen.findByTestId('campaign-note')).textContent).toContain('Отправлено 25')
    expect(screen.getByTestId('campaign-status').textContent).toContain('ждут 75')
  })

  it('does not send when the confirmation is declined or nobody is waiting', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    api.status.mockResolvedValueOnce(status).mockResolvedValueOnce(status).mockResolvedValueOnce({ ...status, pending: 0, sent: 100 })
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Статус' }))
    await screen.findByTestId('campaign-status')
    await userEvent.click(screen.getByTestId('campaign-send'))
    await waitFor(() => expect(api.status).toHaveBeenCalledTimes(2))
    // Пока владелец думал, порцию отправила другая вкладка.
    await userEvent.click(screen.getByTestId('campaign-send'))
    expect((await screen.findByTestId('campaign-note')).textContent).toContain('Отправлять некого')
    expect(api.send).not.toHaveBeenCalled()
  })

  it('a gift of access days goes with the draft, and the status says who got it and what they did next', async () => {
    api.prepare.mockResolvedValue(plan)
    api.status.mockResolvedValue({
      ...status, buttonText: 'Открыть глаголы', buttonQuery: 'screen=verbs', sent: 100, pending: 0, opened: 40,
      giftDays: 3, gifted: 31, playedVerbSession: 22, finishedVerbSession: 17, paidAfterOpen: 2
    })
    await fill()
    await userEvent.clear(screen.getByTestId('campaign-gift-days'))
    await userEvent.type(screen.getByTestId('campaign-gift-days'), '3')
    expect(screen.getByText(/Дни начинаются, когда человек откроет мини-апп кнопкой/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Посчитать' }))
    expect(api.prepare.mock.calls[0][0]).toMatchObject({ giftDays: 3, dryRun: true })

    await userEvent.click(screen.getByRole('button', { name: 'Статус' }))
    const line = (await screen.findByTestId('campaign-status')).textContent!
    expect(line).toContain('получили подарок (3 дн.) 31')
    expect(line).toContain('начали игру с глаголом 22, доиграли 17, оплатили 2')
    expect(screen.getByTestId('campaign-button-url').textContent).toContain('/?screen=verbs&c=ref-test')
  })

  it('the send button is closed until recipients are picked, and says why', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    api.prepare.mockResolvedValueOnce(plan).mockResolvedValueOnce({ ...plan, dryRun: false })
    api.status.mockResolvedValue(status)
    await fill()
    const send = screen.getByTestId('campaign-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(screen.getByTestId('campaign-send-hint').textContent).toContain('Отправка откроется, когда выберешь получателей')

    await userEvent.click(screen.getByRole('button', { name: 'Посчитать' }))
    await screen.findByTestId('campaign-note')
    expect(send.disabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Выбрать пробную группу' }))
    await waitFor(() => expect(send.disabled).toBe(false))
    expect(screen.queryByTestId('campaign-send-hint')).toBeNull()
    expect(api.send).not.toHaveBeenCalled()
  })

  it('has no survey fields: a survey is built in its own section', async () => {
    api.prepare.mockResolvedValue(plan)
    await fill()
    expect(screen.queryByText(/вариант/i)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Посчитать' }))
    expect(api.prepare.mock.calls[0][0]).not.toHaveProperty('surveyOptions')
  })
})
