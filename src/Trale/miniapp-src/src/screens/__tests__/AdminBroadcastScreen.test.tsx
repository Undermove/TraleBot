import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Screen } from '../../types'
import { ApiError, adminCampaigns as mocked, type CampaignStatusDto } from '../../api'
import { goInnerBack } from '../../admin/adminNav'
import AdminBroadcastScreen from '../AdminBroadcastScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminCampaigns: { list: vi.fn(), audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const api = vi.mocked(mocked)

const KEY = 'broadcast-2026-10'
const status: CampaignStatusDto = {
  key: KEY, audience: 'accessEnded', message: 'Новые уроки про падежи', buttonText: 'Открыть глаголы', buttonQuery: 'screen=verbs',
  total: 100, sample: 100, pending: 100, sent: 0, blocked: 0, rejected: 0, unknown: 0, opened: 0,
  giftDays: 3, giftOfferEndsAtUtc: null, gifted: 0, playedVerbSession: 0, finishedVerbSession: 0, paidAfterOpen: 0
} as CampaignStatusDto
const picked = (key: string, n: number, dryRun: boolean, already = 0) => ({ key, dryRun, audienceTotal: 553, alreadyInCampaign: already, picked: n, leftForLater: 553 - n })

let navigate: Mock<(s: Screen) => void>
let confirm: Mock<(text: string) => boolean>
beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.audiences.mockResolvedValue({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512 })
  navigate = vi.fn<(s: Screen) => void>()
  confirm = vi.fn<(text: string) => boolean>(() => true)
  vi.stubGlobal('confirm', confirm)
  window.scrollTo = vi.fn() as never
})
afterEach(() => vi.unstubAllGlobals())

const title = () => screen.getByTestId('broadcast-step-title').textContent
const next = () => userEvent.click(screen.getByTestId('broadcast-next'))
const nextButton = () => screen.getByTestId('broadcast-next') as HTMLButtonElement

/** Новая рассылка до шага «Отправка»: текст, кнопка в раздел «Глаголы», подарок 3 дня, группа по умолчанию. */
async function toSending() {
  render(<AdminBroadcastScreen navigate={navigate} />)
  await userEvent.type(screen.getByLabelText('Текст сообщения'), 'Новые уроки про падежи')
  await next()
  await userEvent.clear(screen.getByLabelText('Текст кнопки'))
  await userEvent.type(screen.getByLabelText('Текст кнопки'), 'Открыть глаголы')
  await userEvent.click(screen.getByRole('radio', { name: 'Раздел «Глаголы»' }))
  await next()
  await userEvent.click(screen.getByRole('radio', { name: '3 дн. полного доступа' }))
  await next()
  await next()
  expect(title()).toBe('Отправка')
}

describe('AdminBroadcastScreen — новая рассылка', () => {
  it('goes step by step and does not go on until the step is filled', async () => {
    render(<AdminBroadcastScreen navigate={navigate} />)
    expect(title()).toBe('Текст')
    expect(screen.getByTestId('broadcast-problem').textContent).toBe('Напиши текст сообщения.')
    expect(nextButton().disabled).toBe(true)

    await userEvent.type(screen.getByLabelText('Текст сообщения'), 'Привет')
    await next()
    expect(title()).toBe('Кнопка')
    expect(within(screen.getByTestId('broadcast-destinations')).getAllByRole('radio').map(r => r.textContent))
      .toEqual(['Главная', 'Раздел «Глаголы»', 'Мой словарь', 'Экран покупки', '«Написать автору»', 'Покормить Бомбору', 'Свой адрес'])
    await userEvent.clear(screen.getByLabelText('Текст кнопки'))
    expect(screen.getByTestId('broadcast-problem').textContent).toBe('Напиши текст кнопки или выбери «Без кнопки».')
    await userEvent.click(screen.getByRole('radio', { name: 'Без кнопки' }))
    expect(screen.queryByTestId('broadcast-destinations')).toBeNull()
    await next()

    expect(title()).toBe('Подарок')
    expect(screen.getByTestId('broadcast-gift-needs-button').textContent).toContain('у этого сообщения кнопки нет')
    expect((screen.getByRole('radio', { name: '3 дн. полного доступа' }) as HTMLButtonElement).disabled).toBe(true)

    // Системное «Назад» Telegram ведёт на шаг раньше, а не из рассылки.
    expect(goInnerBack()).toBe(true)
    await waitFor(() => expect(title()).toBe('Кнопка'))
    await userEvent.click(screen.getByTestId('broadcast-back'))
    expect(title()).toBe('Текст')
    expect((screen.getByLabelText('Текст сообщения') as HTMLTextAreaElement).value).toBe('Привет')
    expect(goInnerBack()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-broadcasts' })
  })

  it('the button goes to a screen chosen by name; «Отправить себе» sends a trial to the owner only', async () => {
    api.prepare.mockResolvedValue(picked(`${KEY}-test`, 1, false))
    api.send.mockResolvedValue({ sent: 1, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status })
    await toSending()
    expect(screen.getByTestId('broadcast-summary').textContent).toBe('Кнопка ведёт: Раздел «Глаголы». Подарок: 3 дн. доступа. Кому: доступ закончился — 553 чел., сначала пробной группе из 100')
    expect(screen.getByTestId('broadcast-preview').textContent).toBe('Новые уроки про падежиОткрыть глаголы')
    expect((screen.getByTestId('broadcast-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('broadcast-send-hint').textContent).toBe('Отправка откроется, когда выберешь получателей.')
    expect(screen.queryByTestId('broadcast-another')).toBeNull()

    await userEvent.click(screen.getByTestId('broadcast-send-me'))

    expect((await screen.findByTestId('broadcast-note')).textContent).toContain('Отправил тебе в чат с ботом')
    expect(api.prepare).toHaveBeenCalledTimes(1)
    expect(api.prepare.mock.calls[0][0]).toMatchObject({
      key: '', newBroadcast: true, newBroadcastSuffix: 'test', audience: 'owner', message: 'Новые уроки про падежи',
      buttonText: 'Открыть глаголы', buttonQuery: 'screen=verbs', giftDays: 3, sampleSize: null, dryRun: false
    })
    expect(api.send).toHaveBeenCalledWith(`${KEY}-test`, 1)
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByTestId('broadcast-back')).toBeTruthy()
  })

  it('recipients are picked after a confirmation; the server names the campaign; a batch asks again and says the gift', async () => {
    api.prepare.mockResolvedValueOnce(picked(KEY, 100, true)).mockResolvedValueOnce(picked(KEY, 100, false))
    api.status.mockResolvedValue(status)
    api.send.mockResolvedValue({ sent: 25, blocked: 0, rejected: 0, unknown: 0, retryAfterSeconds: 0, status: { ...status, pending: 75, sent: 25, opened: 4, gifted: 3 } })
    await toSending()

    await userEvent.click(screen.getByTestId('broadcast-pick'))

    await waitFor(() => expect((screen.getByTestId('broadcast-send') as HTMLButtonElement).disabled).toBe(false))
    expect(confirm.mock.calls[0][0]).toContain('Выбрать пробную группу: 100 чел. (доступ закончился)?')
    expect(confirm.mock.calls[0][0]).toContain('НЕ уйдут')
    expect(api.prepare.mock.calls.map(c => c[0])).toMatchObject([
      { key: '', newBroadcast: true, audience: 'accessEnded', sampleSize: 100, dryRun: true },
      { key: '', newBroadcast: true, audience: 'accessEnded', sampleSize: 100, dryRun: false }
    ])
    expect(api.send).not.toHaveBeenCalled()
    expect(screen.queryByTestId('broadcast-back')).toBeNull()
    expect(screen.getByText(/Имя рассылки: broadcast-2026-10\./)).toBeTruthy()

    await userEvent.click(screen.getByTestId('broadcast-send'))
    await waitFor(() => expect(api.send).toHaveBeenCalledWith(KEY, 25))
    expect(confirm.mock.calls[1][0]).toContain('ОТПРАВИТЬ 25 сообщений?')
    expect(confirm.mock.calls[1][0]).toContain('С подарком: 3 дн. доступа')
    expect(screen.getByTestId('broadcast-status').textContent).toBe('Выбрано 100 · ждут 75 · дошло 25 · заблокировали 0 · отказ 0 · без ответа Telegram 0 · открыли по кнопке 4 · подарков выдано 3')
  })

  it('a declined confirmation picks nobody; an own name and an own address go as typed', async () => {
    confirm.mockReturnValue(false)
    api.prepare.mockResolvedValue(picked('autumn-news', 553, true))
    render(<AdminBroadcastScreen navigate={navigate} />)
    await userEvent.type(screen.getByLabelText('Текст сообщения'), 'Привет')
    await next()
    await userEvent.click(screen.getByRole('radio', { name: 'Свой адрес' }))
    await userEvent.type(screen.getByLabelText('Свой адрес'), 'module id')
    expect(screen.getByTestId('broadcast-problem').textContent).toContain('без пробелов')
    await userEvent.clear(screen.getByLabelText('Свой адрес'))
    await userEvent.type(screen.getByLabelText('Свой адрес'), '?moduleId=cases&lessonId=1')
    await next()
    await next()
    await userEvent.click(screen.getByRole('radio', { name: /Сразу всем/ }))
    await userEvent.type(screen.getByLabelText('Имя кампании'), 'Autumn News')
    expect(screen.getByTestId('broadcast-problem').textContent).toContain('латиница в нижнем регистре')
    await userEvent.clear(screen.getByLabelText('Имя кампании'))
    await userEvent.type(screen.getByLabelText('Имя кампании'), 'autumn-news')
    await next()

    await userEvent.click(screen.getByTestId('broadcast-pick'))

    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(1))
    expect(api.prepare.mock.calls[0][0]).toMatchObject({
      key: 'autumn-news', newBroadcast: false, buttonQuery: 'moduleId=cases&lessonId=1', giftDays: 0, sampleSize: null, dryRun: true
    })
    expect((screen.getByTestId('broadcast-send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('broadcast-back')).toBeTruthy()
  })
})

describe('AdminBroadcastScreen — открытая рассылка', () => {
  it('opens on its sending with what is already done, and sends the rest of the group under the same name', async () => {
    api.status.mockResolvedValueOnce({ ...status, pending: 0, sent: 100, opened: 30, gifted: 20 }).mockResolvedValue({ ...status, total: 553, pending: 453, sent: 100 })
    api.prepare.mockResolvedValueOnce(picked(KEY, 453, true, 100)).mockResolvedValueOnce(picked(KEY, 453, false, 100))
    render(<AdminBroadcastScreen campaignKey={KEY} navigate={navigate} />)

    await waitFor(() => expect(title()).toBe('Отправка'))
    expect(api.status).toHaveBeenCalledWith(KEY)
    expect(screen.getByTestId('broadcast-preview').textContent).toBe('Новые уроки про падежиОткрыть глаголы')
    expect(screen.getByTestId('broadcast-summary').textContent).toContain('Кнопка ведёт: Раздел «Глаголы». Подарок: 3 дн. доступа. Кому: доступ закончился — 553 чел.')
    expect(screen.getByTestId('broadcast-status').textContent).toContain('дошло 100 · заблокировали 0 · отказ 0 · без ответа Telegram 0 · открыли по кнопке 30 · подарков выдано 20')
    expect(screen.getByTestId('broadcast-send-hint').textContent).toContain('Можно выбрать остальных или ещё одну группу')
    expect(screen.queryByTestId('broadcast-next')).toBeNull()

    await userEvent.click(screen.getByTestId('broadcast-pick'))
    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(confirm.mock.calls[0][0]).toContain('Выбрать всех остальных: 453 чел.')
    expect(confirm.mock.calls[0][0]).toContain('Ещё 100 из этой группы уже в рассылке — второй раз они её не получат.')
    expect(api.prepare.mock.calls[1][0]).toMatchObject({ key: KEY, newBroadcast: false, audience: 'accessEnded', sampleSize: null, dryRun: false, buttonQuery: 'screen=verbs', giftDays: 3 })
    await waitFor(() => expect(screen.getByTestId('broadcast-status').textContent).toContain('Выбрано 553 · ждут 453'))
  })

  it('one more group joins the same campaign — the screen says nobody gets the message or the gift twice', async () => {
    api.status.mockResolvedValue({ ...status, pending: 0, sent: 100 })
    api.prepare.mockResolvedValueOnce(picked(KEY, 40, true, 21)).mockResolvedValueOnce(picked(KEY, 40, false, 21))
    render(<AdminBroadcastScreen campaignKey={KEY} navigate={navigate} />)

    const another = await screen.findByTestId('broadcast-another')
    expect(another.textContent).toContain('Это будет та же рассылка: кто уже получил сообщение, второй раз его не получит, и подарок достаётся человеку один раз')
    expect(within(another).queryByRole('radio', { name: /доступ закончился/ })).toBeNull()
    expect(screen.queryByTestId('broadcast-pick-another')).toBeNull()

    await userEvent.click(within(another).getByRole('radio', { name: 'занимались за последние 30 дней · 61' }))
    await userEvent.click(screen.getByTestId('broadcast-pick-another'))

    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(confirm.mock.calls[0][0]).toContain('Выбрать ещё одну группу: 40 чел. (занимались за последние 30 дней)?')
    expect(confirm.mock.calls[0][0]).toContain('Ещё 21 из этой группы уже в рассылке')
    expect(api.prepare.mock.calls[1][0]).toMatchObject({ key: KEY, audience: 'activeLately', anotherAudience: true, sampleSize: null, dryRun: false })
    expect(api.send).not.toHaveBeenCalled()
  })

  it('shows «Нет доступа.» for a name the server does not give', async () => {
    api.status.mockRejectedValue(new ApiError(404, ''))
    render(<AdminBroadcastScreen campaignKey="broadcast-2026-01" navigate={navigate} />)
    expect(await screen.findByTestId('admin-denied')).toBeTruthy()
    expect(screen.queryByTestId('broadcast-send')).toBeNull()
  })
})
