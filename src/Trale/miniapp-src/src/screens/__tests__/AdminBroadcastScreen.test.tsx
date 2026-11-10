import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Screen } from '../../types'
import { ApiError, adminCampaigns as mocked, type CampaignStatusDto } from '../../api'
import { enterAdmin, goInnerBack, leaveAdmin } from '../../admin/adminNav'
import AdminBroadcastScreen from '../AdminBroadcastScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  adminCampaigns: { list: vi.fn(), audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn(), sendAll: vi.fn(), stop: vi.fn() }
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
  api.audiences.mockResolvedValue({ accessEnded: 553, onTrial: 17, paying: 3, proLapsed: 0, owner: 1, activeLately: 61, inactiveLong: 512, paid: 8, neverPaid: 565 })
  navigate = vi.fn<(s: Screen) => void>()
  confirm = vi.fn<(text: string) => boolean>(() => true)
  vi.stubGlobal('confirm', confirm)
  window.scrollTo = vi.fn() as never
  leaveAdmin()
  enterAdmin({ kind: 'admin-broadcasts' })
  enterAdmin({ kind: 'admin-broadcast' })
  try { localStorage.clear() } catch {}
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
    // Незаконченное сохранено на устройстве; «Закрыть» спрашивает и уводит к списку рассылок.
    expect(JSON.parse(localStorage.getItem('trale_admin_draft_broadcast')!)).toMatchObject({ step: 1, message: 'Привет', hasButton: false })
    confirm.mockReturnValueOnce(false)
    await userEvent.click(screen.getByTestId('admin-close'))
    expect(confirm.mock.calls[confirm.mock.calls.length - 1][0]).toContain('Черновик останется на этом устройстве')
    expect(navigate).not.toHaveBeenCalled()
    // С первого шага системное «Назад» — то же, что «Закрыть».
    expect(goInnerBack()).toBe(true)
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-broadcasts' })
  })

  it('opened with a draft, continues from the step where it was left; picking recipients clears the draft', async () => {
    localStorage.setItem('trale_admin_draft_broadcast', JSON.stringify({
      step: 4, message: 'Из черновика', hasButton: true, buttonText: 'Открыть', destination: 'verbs', customQuery: '', giftDays: 7,
      audience: 'activeLately', sampleFirst: false, sampleSize: 100, ownName: ''
    }))
    api.prepare.mockResolvedValueOnce(picked(KEY, 61, true)).mockResolvedValueOnce(picked(KEY, 61, false))
    api.status.mockResolvedValue(status)
    render(<AdminBroadcastScreen useDraft navigate={navigate} />)

    expect(title()).toBe('Кому')
    expect(screen.getByTestId('broadcast-audience-activeLately').getAttribute('aria-checked')).toBe('true')
    await next()
    expect(screen.getByTestId('broadcast-summary').textContent).toBe('Кнопка ведёт: Раздел «Глаголы». Подарок: 7 дн. доступа. Кому: занимались за последние 30 дней — 61 чел.')
    await userEvent.click(screen.getByTestId('broadcast-pick'))
    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(localStorage.getItem('trale_admin_draft_broadcast')).toBeNull())
  })

  it('without being asked for the draft, a new broadcast starts clean', () => {
    localStorage.setItem('trale_admin_draft_broadcast', JSON.stringify({ step: 4, message: 'Из черновика' }))
    render(<AdminBroadcastScreen navigate={navigate} />)
    expect(title()).toBe('Текст')
    expect((screen.getByLabelText('Текст сообщения') as HTMLTextAreaElement).value).toBe('')
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

describe('AdminBroadcastScreen — готовая рассылка одним куском', () => {
  const READY = 'имя: myday-back\nкому: inactiveLong\nпроба: 50\nподарок: 7\nкнопка: Посмотреть первую серию\nадрес: moduleId=my-day&lessonId=1\n---\nНовый модуль — «Мой день»'

  it('fills every step from the pasted text and picks the sample with exactly those parameters', async () => {
    api.prepare.mockImplementation(async body => picked('myday-back', 50, body.dryRun))
    api.status.mockResolvedValue({ ...status, key: 'myday-back', pending: 50 })
    render(<AdminBroadcastScreen navigate={navigate} />)
    await userEvent.click(screen.getByTestId('broadcast-paste-open'))
    await userEvent.click(screen.getByLabelText('Готовая рассылка'))
    await userEvent.paste(READY)
    await userEvent.click(screen.getByTestId('broadcast-paste-apply'))

    expect(title()).toBe('Отправка')
    expect(screen.getByTestId('broadcast-summary').textContent)
      .toBe('Кнопка ведёт: /?moduleId=my-day&lessonId=1. Подарок: 7 дн. доступа. Кому: не занимались больше 30 дней — 512 чел., сначала пробной группе из 50')
    await userEvent.click(screen.getByTestId('broadcast-pick'))
    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(api.prepare).toHaveBeenLastCalledWith({
      key: 'myday-back', newBroadcast: false, audience: 'inactiveLong', message: 'Новый модуль — «Мой день»',
      buttonText: 'Посмотреть первую серию', buttonQuery: 'moduleId=my-day&lessonId=1', giftDays: 7, sampleSize: 50, dryRun: false
    })
  })

  it('says what is wrong with a broken paste and stays on the first step', async () => {
    render(<AdminBroadcastScreen navigate={navigate} />)
    await userEvent.click(screen.getByTestId('broadcast-paste-open'))
    await userEvent.click(screen.getByLabelText('Готовая рассылка'))
    await userEvent.paste('кому: всем\n---\nПривет')
    await userEvent.click(screen.getByTestId('broadcast-paste-apply'))
    expect(screen.getByTestId('broadcast-paste-problem').textContent).toContain('Кому')
    expect(title()).toBe('Текст')
  })

  it('hands sending everyone to the server with one confirmation and shows how it goes until it is done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.status.mockResolvedValueOnce({ ...status, pending: 60 }).mockResolvedValueOnce({ ...status, pending: 60 })
    api.sendAll.mockResolvedValue({ ...status, pending: 60, sendingAll: true })
    render(<AdminBroadcastScreen navigate={navigate} campaignKey={KEY} />)
    await userEvent.click(await screen.findByTestId('broadcast-send-all'))

    expect(api.sendAll).toHaveBeenCalledWith(KEY)
    expect(api.send).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect((await screen.findByTestId('broadcast-sending')).textContent).toContain('можно закрыть')

    api.status.mockResolvedValue({ ...status, pending: 0, sent: 60, sendingAll: false })
    await waitFor(() => expect(screen.getByTestId('broadcast-note').textContent).toContain('Готово. Дошло 60'), { timeout: 5000 })
    expect(screen.queryByTestId('broadcast-sending')).toBeNull()
    vi.useRealTimers()
  })

  it('stops the server sending and leaves the rest waiting', async () => {
    api.status.mockResolvedValue({ ...status, pending: 40, sent: 20, sendingAll: true })
    api.stop.mockResolvedValue({ ...status, pending: 40, sent: 20, sendingAll: false })
    render(<AdminBroadcastScreen navigate={navigate} campaignKey={KEY} />)
    await userEvent.click(await screen.findByTestId('broadcast-stop'))
    expect(api.stop).toHaveBeenCalledWith(KEY)
    expect(screen.getByTestId('broadcast-note').textContent).toContain('ждут 40')
    expect(screen.getByTestId('broadcast-send-all')).toBeTruthy()
  })
})

describe('AdminBroadcastScreen — отправка по расписанию', () => {
  const LATER = 'имя: prices-last-days\nкому: neverPaid\nкнопка: Купить по старой цене\nадрес: paywall=1\nкогда: 28.11.2099 12:00\nпояс: Тбилиси\n---\nДо повышения цен осталось 3 дня.'
  const AT = '2099-11-28T08:00:00.000Z'
  const scheduled = { ...status, key: 'prices-last-days', audience: 'neverPaid', message: 'До повышения цен осталось 3 дня.', giftDays: 0, total: 0, pending: 0, scheduledAtUtc: AT, scheduledTimeZone: 'Asia/Tbilisi' } as CampaignStatusDto

  it('a pasted broadcast with a time is scheduled by one button: nobody is picked, the server gets the moment in UTC', async () => {
    api.prepare.mockImplementation(async body => picked('prices-last-days', body.dryRun ? 565 : 0, body.dryRun))
    api.status.mockResolvedValue(scheduled)
    render(<AdminBroadcastScreen navigate={navigate} pasted={LATER} />)

    expect(title()).toBe('Отправка')
    expect((screen.getByTestId('broadcast-schedule-date') as HTMLInputElement).value).toBe('2099-11-28')
    expect((screen.getByTestId('broadcast-schedule-time') as HTMLInputElement).value).toBe('12:00')
    expect((screen.getByTestId('broadcast-schedule-zone') as HTMLSelectElement).value).toBe('Asia/Tbilisi')
    await userEvent.click(screen.getByTestId('broadcast-schedule'))

    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(confirm.mock.calls[0][0]).toContain('ЗАПЛАНИРОВАТЬ на 28.11.2099 12:00 (Тбилиси)?')
    expect(confirm.mock.calls[0][0]).toContain('сейчас это 565 чел.')
    expect(api.prepare).toHaveBeenLastCalledWith({
      key: 'prices-last-days', newBroadcast: false, audience: 'neverPaid', message: 'До повышения цен осталось 3 дня.',
      buttonText: 'Купить по старой цене', buttonQuery: 'paywall=1', giftDays: 0, sampleSize: null, dryRun: false,
      sendAtUtc: AT, sendAtTimeZone: 'Asia/Tbilisi'
    })
    const state = await screen.findByTestId('broadcast-scheduled')
    expect(state.textContent).toContain('Запланирована на 28.11.2099 12:00 (Тбилиси)')
    expect(state.textContent).toContain('Мини-апп можно закрыть')
    expect(screen.queryByTestId('broadcast-note')).toBeNull()
    // Пока рассылка ждёт своего часа, выбирать и отправлять руками нечего.
    for (const gone of ['broadcast-schedule', 'broadcast-pick', 'broadcast-send-all', 'broadcast-send', 'broadcast-another', 'broadcast-status'])
      expect(screen.queryByTestId(gone)).toBeNull()
    expect(screen.getByTestId('broadcast-send-me')).toBeTruthy()
    expect(api.send).not.toHaveBeenCalled()
    expect(api.sendAll).not.toHaveBeenCalled()
  })

  it('the day, the hour and the zone are chosen on the sending step: tomorrow at noon by Tbilisi to begin with; without a day there is nothing to schedule', async () => {
    api.prepare.mockImplementation(async body => picked(KEY, body.dryRun ? 553 : 0, body.dryRun))
    api.status.mockResolvedValue({ ...status, total: 0, pending: 0, scheduledAtUtc: '2099-07-01T10:30:00.000Z', scheduledTimeZone: 'Europe/Berlin' })
    await toSending()
    const day = new Date(Date.now() + 24 * 3600 * 1000)
    expect((screen.getByLabelText('День отправки') as HTMLInputElement).value)
      .toBe(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
    expect((screen.getByLabelText('Время отправки') as HTMLInputElement).value).toBe('12:00')
    expect((screen.getByLabelText('Часовой пояс') as HTMLSelectElement).value).toBe('Asia/Tbilisi')
    await userEvent.clear(screen.getByLabelText('День отправки'))
    expect((screen.getByTestId('broadcast-schedule') as HTMLButtonElement).disabled).toBe(true)

    await userEvent.type(screen.getByLabelText('День отправки'), '2099-07-01')
    await userEvent.clear(screen.getByLabelText('Время отправки'))
    await userEvent.type(screen.getByLabelText('Время отправки'), '12:30')
    await userEvent.selectOptions(screen.getByLabelText('Часовой пояс'), 'Europe/Berlin')
    await userEvent.click(screen.getByTestId('broadcast-schedule'))

    await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2))
    expect(api.prepare.mock.calls[1][0]).toMatchObject({ sampleSize: null, dryRun: false, sendAtUtc: '2099-07-01T10:30:00.000Z', sendAtTimeZone: 'Europe/Berlin' })
    expect((await screen.findByTestId('broadcast-scheduled')).textContent).toContain('01.07.2099 12:30 (Берлин)')
  })

  it('a time that has passed is not sent to the server; a declined confirmation schedules nothing', async () => {
    api.prepare.mockImplementation(async body => picked(KEY, 553, body.dryRun))
    await toSending()
    await userEvent.clear(screen.getByLabelText('День отправки'))
    await userEvent.type(screen.getByLabelText('День отправки'), '2020-01-01')
    await userEvent.click(screen.getByTestId('broadcast-schedule'))
    expect(screen.getByTestId('broadcast-note').textContent).toContain('уже прошло')
    expect(api.prepare).not.toHaveBeenCalled()

    confirm.mockReturnValue(false)
    await userEvent.clear(screen.getByLabelText('День отправки'))
    await userEvent.type(screen.getByLabelText('День отправки'), '2099-01-01')
    await userEvent.click(screen.getByTestId('broadcast-schedule'))
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(api.prepare).toHaveBeenCalledTimes(1)
    expect(api.prepare.mock.calls[0][0]).toMatchObject({ dryRun: true })
    expect(screen.queryByTestId('broadcast-scheduled')).toBeNull()
  })

  it('a scheduled broadcast opens with its time and can be called off', async () => {
    api.status.mockResolvedValue(scheduled)
    api.stop.mockResolvedValue({ ...scheduled, scheduledAtUtc: null, scheduledTimeZone: null })
    render(<AdminBroadcastScreen navigate={navigate} campaignKey="prices-last-days" />)

    expect((await screen.findByTestId('broadcast-scheduled')).textContent).toContain('28.11.2099 12:00 (Тбилиси)')
    expect(screen.queryByTestId('broadcast-send-hint')).toBeNull()
    await userEvent.click(screen.getByTestId('broadcast-schedule-cancel'))

    expect(api.stop).toHaveBeenCalledWith('prices-last-days')
    expect(screen.getByTestId('broadcast-note').textContent).toBe('Расписание отменил. Сообщения не ушли.')
    expect(screen.queryByTestId('broadcast-scheduled')).toBeNull()
    expect(screen.getByTestId('broadcast-schedule')).toBeTruthy()
    expect(screen.getByTestId('broadcast-pick')).toBeTruthy()
  })

  it('when its hour comes while the screen is open, the screen shows the sending and then the result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.status.mockResolvedValueOnce(scheduled)
    render(<AdminBroadcastScreen navigate={navigate} campaignKey="prices-last-days" />)
    await screen.findByTestId('broadcast-scheduled')

    api.status.mockResolvedValue({ ...scheduled, scheduledAtUtc: null, total: 565, pending: 0, sent: 565 })
    await vi.advanceTimersByTimeAsync(15000)
    await waitFor(() => expect(screen.getByTestId('broadcast-note').textContent).toContain('Готово. Дошло 565'))
    expect(screen.queryByTestId('broadcast-scheduled')).toBeNull()
    vi.useRealTimers()
  })
})

describe('AdminBroadcastScreen — вставка из буфера одним нажатием', () => {
  const READY = 'имя: myday-active\nкому: activeLately\nподарок: 7\nкнопка: Посмотреть первую серию\nадрес: moduleId=my-day&lessonId=1\n---\nНовый модуль — «Мой день»'

  it('reads the clipboard on the first step and goes straight to sending', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn(async () => READY) } })
    render(<AdminBroadcastScreen navigate={navigate} />)
    await userEvent.click(screen.getByTestId('broadcast-paste-open'))
    await waitFor(() => expect(title()).toBe('Отправка'))
    expect(screen.getByTestId('broadcast-summary').textContent).toContain('Кому: занимались за последние 30 дней')
  })

  it('opens straight on sending with the text the list button read from the clipboard', async () => {
    render(<AdminBroadcastScreen navigate={navigate} pasted={READY} />)
    await waitFor(() => expect(title()).toBe('Отправка'))
    expect(screen.getByTestId('broadcast-summary').textContent).toContain('Подарок: 7 дн. доступа')
  })

  it('shows the field with the reason when the clipboard holds something else', async () => {
    render(<AdminBroadcastScreen navigate={navigate} pasted="просто текст" />)
    expect(await screen.findByTestId('broadcast-paste-problem')).toBeTruthy()
    expect((screen.getByLabelText('Готовая рассылка') as HTMLTextAreaElement).value).toBe('просто текст')
    expect(title()).toBe('Текст')
  })
})
