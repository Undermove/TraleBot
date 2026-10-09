import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Screen } from '../../types'
import {
  ApiError, api as mockedApi, adminCampaigns as mockedCampaigns, adminSections as mocked,
  type AdminOverviewDto, type AdminPaymentsDto, type AdminUserDetail, type AdminUserRowDto, type AdminUsersPageDto, type CampaignListItemDto
} from '../../api'
import AdminScreen from '../AdminScreen'
import AdminUsersScreen from '../AdminUsersScreen'
import AdminUserScreen from '../AdminUserScreen'
import AdminPaymentsScreen from '../AdminPaymentsScreen'
import AdminBroadcastsScreen from '../AdminBroadcastsScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  api: { adminUserDetail: vi.fn(), adminGrantPro: vi.fn(), adminRevokePro: vi.fn() },
  adminSections: { overview: vi.fn(), users: vi.fn(), payments: vi.fn(), jobs: vi.fn() },
  adminCampaigns: { list: vi.fn(), audiences: vi.fn(), prepare: vi.fn(), send: vi.fn(), status: vi.fn() }
}))
vi.mock('../../components/LoaderLetter', () => ({ default: () => null }))
const sections = vi.mocked(mocked)
const api = vi.mocked(mockedApi)
const campaigns = vi.mocked(mockedCampaigns)

const overview: AdminOverviewDto = {
  totalUsers: 848, newUsers7d: 21, studiedToday: 9, studied7d: 61, payments30d: 2, stars30d: 700, activeSubscriptions: 2, onTrial: 17,
  unansweredMessages: 3, unfinishedSurveys: 1, unfinishedBroadcasts: 2, verbsToReview: 5
}
const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString()
const row = (telegramId: number, over: Partial<AdminUserRowDto> = {}): AdminUserRowDto =>
  ({ telegramId, access: 'ended', isActive: true, registeredAtUtc: '2026-03-01T10:00:00Z', lastActivityUtc: daysAgo(3), acquisitionSource: null, vocabularyCount: 12, ...over })
const page = (users: AdminUserRowDto[], total = users.length): AdminUsersPageDto =>
  ({ total, users, counts: { all: 848, paying: 2, trial: 17, accessEnded: 829, blocked: 40 } })

let navigate: Mock<(s: Screen) => void>
beforeEach(() => {
  ;[...Object.values(sections), ...Object.values(api), ...Object.values(campaigns)].forEach(f => (f as ReturnType<typeof vi.fn>).mockReset())
  navigate = vi.fn<(s: Screen) => void>()
})
afterEach(() => vi.unstubAllGlobals())

describe('AdminScreen — обзор', () => {
  it('shows the main numbers and every section with what waits in it', async () => {
    sections.overview.mockResolvedValue(overview)
    render(<AdminScreen navigate={navigate} />)

    const figures = await screen.findByTestId('admin-figures')
    expect(figures.textContent).toBe('21новых за 7 днейвсего людей 84861занимались за 7 днейза сутки 92оплат за 30 днейзвёзд 7002действующих подписокна пробном периоде 17')
    const tiles = within(screen.getByTestId('admin-sections')).getAllByRole('button')
    expect(tiles.map(t => t.textContent!.split(/[А-Я]/).length > 0 && t.querySelector('.font-extrabold')!.textContent)).toEqual([
      'Пользователи', 'Обратная связьбез ответа: 3 · не дослано: 1', 'Рассылкине дослано: 2', 'Глаголыждут: 5', 'Оплаты', 'Система'
    ])

    const opens: [string, Screen][] = [
      ['admin-section-users', { kind: 'admin-users' }], ['admin-section-feedback', { kind: 'admin-feedback' }],
      ['admin-section-broadcasts', { kind: 'admin-broadcasts' }], ['admin-section-verbs', { kind: 'verb-review' }],
      ['admin-section-payments', { kind: 'admin-payments' }], ['admin-section-system', { kind: 'admin-system' }]
    ]
    for (const [testId, target] of opens) {
      await userEvent.click(screen.getByTestId(testId))
      expect(navigate).toHaveBeenLastCalledWith(target)
    }
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'profile' })
  })

  it('shows no badges when nothing waits; says «Нет доступа.» to a non-owner; offers a retry after a failure', async () => {
    sections.overview.mockResolvedValueOnce({ ...overview, unansweredMessages: 0, unfinishedSurveys: 0, unfinishedBroadcasts: 0, verbsToReview: 0 })
    const calm = render(<AdminScreen navigate={navigate} />)
    await screen.findByTestId('admin-sections')
    expect(screen.queryByTestId('admin-feedback-waits')).toBeNull()
    expect(screen.queryByTestId('admin-broadcasts-waits')).toBeNull()
    expect(screen.queryByTestId('admin-verbs-waits')).toBeNull()
    calm.unmount()

    sections.overview.mockRejectedValueOnce(new ApiError(404, ''))
    const denied = render(<AdminScreen navigate={navigate} />)
    expect((await screen.findByTestId('admin-denied')).textContent).toBe('Нет доступа.')
    expect(screen.queryByTestId('admin-sections')).toBeNull()
    denied.unmount()

    sections.overview.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(overview)
    render(<AdminScreen navigate={navigate} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Попробовать ещё раз' }))
    expect(await screen.findByTestId('admin-sections')).toBeTruthy()
  })
})

describe('AdminUsersScreen', () => {
  it('lists people with access, last study and source; filters, sorts, searches and loads more', async () => {
    const first = Array.from({ length: 30 }, (_, i) => row(5000000100 + i))
    first[0] = row(5000000100, { access: 'paying', acquisitionSource: 'ref_309149393', lastActivityUtc: daysAgo(0.1) })
    first[1] = row(5000000101, { isActive: false, lastActivityUtc: null, acquisitionSource: 'seo_grammar_cases' })
    sections.users.mockImplementation(async q => (q?.search ? page([]) : q?.skip ? page([row(5000000200)], 31) : q?.filter === 'paying' ? page([first[0]]) : page(first, 31)))
    render(<AdminUsersScreen navigate={navigate} />)

    const paying = await screen.findByTestId('user-5000000100')
    expect(sections.users).toHaveBeenLastCalledWith({ search: undefined, filter: 'all', sort: 'activity', skip: 0, take: 30 })
    expect(paying.textContent).toContain('платит')
    expect(paying.textContent).toContain('занятия: сегодня')
    expect(paying.textContent).toContain('откуда: по приглашению (309149393)')
    expect(screen.getByTestId('user-5000000101').textContent).toContain('занятия: нет занятий')
    expect(screen.getByTestId('user-5000000101').textContent).toContain('откуда: с сайта (grammar_cases) · заблокировал бота')
    expect(screen.getByTestId('users-total').textContent).toBe('Найдено: 31')
    expect(within(screen.getByTestId('users-filters')).getAllByRole('radio').map(r => r.textContent))
      .toEqual(['все · 848', 'платят · 2', 'пробный период · 17', 'доступ закончился · 829', 'заблокировали бота · 40'])

    await userEvent.click(screen.getByTestId('admin-more'))
    await screen.findByTestId('user-5000000200')
    expect(sections.users).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 30 }))
    expect(screen.getAllByTestId(/^user-\d+$/)).toHaveLength(31)
    expect(screen.queryByTestId('admin-more')).toBeNull()

    await userEvent.click(screen.getByRole('radio', { name: 'платят · 2' }))
    await waitFor(() => expect(screen.getAllByTestId(/^user-\d+$/)).toHaveLength(1))
    expect(sections.users).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'paying', skip: 0 }))
    await userEvent.click(screen.getByRole('radio', { name: 'больше слов' }))
    await waitFor(() => expect(sections.users).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'words' })))

    await userEvent.type(screen.getByLabelText('Поиск по Telegram id'), '999')
    expect((await screen.findByTestId('admin-empty')).textContent).toContain('Никого не нашлось')
    expect(sections.users).toHaveBeenLastCalledWith(expect.objectContaining({ search: '999' }))

    await userEvent.clear(screen.getByLabelText('Поиск по Telegram id'))
    await userEvent.click(await screen.findByTestId('user-5000000100'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-user', telegramId: 5000000100 })
  })

  it('opens on the filter it was asked for and says «Нет доступа.» to a non-owner', async () => {
    sections.users.mockResolvedValueOnce(page([row(1)]))
    const one = render(<AdminUsersScreen filter="blocked" navigate={navigate} />)
    await screen.findByTestId('user-1')
    expect(sections.users).toHaveBeenCalledWith(expect.objectContaining({ filter: 'blocked' }))
    one.unmount()

    sections.users.mockRejectedValue(new ApiError(404, ''))
    render(<AdminUsersScreen navigate={navigate} />)
    expect(await screen.findByTestId('admin-denied')).toBeTruthy()
  })
})

const card: AdminUserDetail = {
  telegramId: 5000000100, userId: 'u1', isPro: true, isActive: true, subscriptionPlan: 'Month', subscribedUntilUtc: '2026-11-01T10:00:00Z',
  proPurchasedAtUtc: '2026-10-01T10:00:00Z', registeredAtUtc: '2026-03-01T10:00:00Z', currentLanguage: 'Georgian', vocabularyCount: 42, xp: 310,
  streak: 4, level: 'beginner', lastActivityUtc: null,
  payments: [{ chargeId: 'c1', plan: 'Month', amount: 100, currency: 'XTR', purchasedAtUtc: '2026-10-01T10:00:00Z', refundedAtUtc: null }],
  acquisitionSource: 'ref_309149393', access: 'Paying', accessUntilUtc: '2026-11-01T10:00:00Z', notificationsEnabled: true, lastStudiedAtUtc: daysAgo(1),
  lessonsCompleted: 14, quizzesStarted: 3, verbSessionsStarted: 5, verbSessionsFinished: 4, writtenTexts: 2,
  surveyAnswers: [{ campaignKey: 'survey-2026-10-users', question: 'Насколько TraleBot тебе нужен?', option: 'Без него никак', text: null, atUtc: '2026-10-08T10:00:00Z' }]
} as AdminUserDetail

describe('AdminUserScreen', () => {
  it('says where the person came from, what access they have, what they did, paid and answered — and lets the owner write', async () => {
    api.adminUserDetail.mockResolvedValue(card)
    render(<AdminUserScreen telegramId={5000000100} navigate={navigate} />)

    const summary = await screen.findByTestId('user-summary')
    expect(summary.textContent).toContain('откудапо приглашению (309149393)')
    expect(summary.textContent).toContain('доступплатит, до 1 нояб. 2026 г. · 1 месяц')
    expect(summary.textContent).toContain('занятиявчера')
    expect(summary.textContent).toContain('ботна связи')
    expect(screen.getByTestId('user-activity').textContent).toContain('14уроков пройдено')
    expect(screen.getByTestId('user-activity').textContent).toContain('5игр с глаголамидоиграно 4')
    expect(screen.getByTestId('user-payments').textContent).toContain('100 зв.')
    expect(screen.getByTestId('user-answers').textContent).toContain('Насколько TraleBot тебе нужен?')
    expect(screen.getByTestId('user-answers').textContent).toContain('Без него никак')

    await userEvent.click(screen.getByTestId('user-write'))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-feedback', view: { thread: 5000000100 } })
    await userEvent.click(within(screen.getByTestId('user-answers')).getByRole('button'))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-feedback', view: { survey: 'survey-2026-10-users' } })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-users' })
  })

  it('a silent newcomer has an empty card that still offers to write first; a blocked bot is said in red', async () => {
    api.adminUserDetail.mockResolvedValue({
      ...card, isPro: false, isActive: false, subscriptionPlan: null, access: 'Ended', accessUntilUtc: null, acquisitionSource: null, lastStudiedAtUtc: null,
      payments: [], surveyAnswers: [], writtenTexts: 0
    } as AdminUserDetail)
    render(<AdminUserScreen telegramId={5000000100} navigate={navigate} />)

    const summary = await screen.findByTestId('user-summary')
    expect(summary.textContent).toContain('откуданеизвестно')
    expect(summary.textContent).toContain('доступдоступ закончился')
    expect(summary.textContent).toContain('занятиянет занятий')
    expect(summary.textContent).toContain('ботзаблокировал бота')
    expect(screen.getByTestId('user-write').textContent).toContain('можно написать первым')
    expect(screen.getAllByTestId('admin-empty').map(e => e.textContent)).toEqual(['Оплат не было.', 'В опросах не отвечал.'])
    expect(screen.queryByTestId('user-revoke')).toBeNull()
  })

  it('granting and revoking a subscription ask first and do nothing when declined', async () => {
    const confirm = vi.fn((_text: string) => false)
    vi.stubGlobal('confirm', confirm)
    api.adminUserDetail.mockResolvedValue(card)
    api.adminGrantPro.mockResolvedValue({ ok: true })
    api.adminRevokePro.mockResolvedValue({ ok: true })
    render(<AdminUserScreen telegramId={5000000100} navigate={navigate} />)

    await userEvent.click(within(await screen.findByTestId('user-grant')).getByRole('button', { name: '1 год' }))
    await userEvent.click(screen.getByTestId('user-revoke'))
    expect(confirm.mock.calls.map(c => c[0])).toEqual(['Выдать подписку «1 год» пользователю 5000000100?', 'Отозвать подписку у пользователя 5000000100?'])
    expect(api.adminGrantPro).not.toHaveBeenCalled()
    expect(api.adminRevokePro).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await userEvent.click(within(screen.getByTestId('user-grant')).getByRole('button', { name: '1 год' }))
    await waitFor(() => expect(screen.getByTestId('user-note').textContent).toBe('Выдано: 1 год.'))
    expect(api.adminGrantPro).toHaveBeenCalledWith(5000000100, 'Year')
  })
})

describe('AdminPaymentsScreen', () => {
  const payments: AdminPaymentsDto = {
    total: 31, starsTotal: 1850, refunds: 1,
    payments: [
      { telegramId: 111, purchasedAtUtc: '2026-10-07T10:00:00Z', plan: 'Year', amount: 600, currency: 'XTR', refundedAtUtc: null },
      { telegramId: 222, purchasedAtUtc: '2026-09-01T10:00:00Z', plan: 'Month', amount: 100, currency: 'XTR', refundedAtUtc: '2026-09-01T11:00:00Z' }
    ],
    endingSoon: [{ telegramId: 333, plan: 'Month', untilUtc: '2026-10-14T10:00:00Z' }],
    endedLately: []
  }

  it('shows who ends soon, every payment with refunds marked, and loads more', async () => {
    sections.payments.mockImplementation(async (skip?: number) => (skip ? { ...payments, payments: [{ ...payments.payments[0], telegramId: 444 }] } : payments))
    render(<AdminPaymentsScreen navigate={navigate} />)

    expect((await screen.findByTestId('payments-ending')).textContent).toBe('333до 14 окт. 2026 г. · 1 месяц')
    expect(screen.getByText('За последние 30 дней ни у кого не закончилась.')).toBeTruthy()
    const list = screen.getByTestId('payments-list')
    expect(list.textContent).toContain('1117 окт. 2026 г. · 1 год600 зв.')
    expect(list.textContent).toContain('100 зв. · возврат')
    await userEvent.click(screen.getByTestId('admin-more'))
    await waitFor(() => expect(sections.payments).toHaveBeenLastCalledWith(2, 30))
    expect((await screen.findByTestId('payments-list')).textContent).toContain('444')

    await userEvent.click(within(screen.getByTestId('payments-ending')).getByRole('button'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin-user', telegramId: 333 })
  })
})

describe('AdminBroadcastsScreen', () => {
  const item = (key: string, over: Partial<CampaignListItemDto> = {}): CampaignListItemDto => ({
    key, isSurvey: false, message: 'Новые уроки про падежи\nЗагляни!', audience: 'accessEnded', createdAtUtc: '2026-10-08T10:00:00Z', buttonText: 'Открыть', giftDays: 3,
    picked: 553, pending: 478, sent: 73, opened: 21, gifted: 14, state: 'running', ...over
  })

  it('lists campaigns with how far each got, and opens one or starts a new one', async () => {
    campaigns.list.mockResolvedValue({ campaigns: [item('broadcast-2026-10'), item('broadcast-2026-09', { state: 'done', pending: 0, buttonText: null, giftDays: 0 }), item('draft', { state: 'draft', picked: 0, pending: 0 })] })
    render(<AdminBroadcastsScreen navigate={navigate} />)

    const running = await screen.findByTestId('broadcast-broadcast-2026-10')
    expect(campaigns.list).toHaveBeenCalledWith(false)
    expect(running.textContent).toBe('идёт8 октябряНовые уроки про падеждоступ закончился · отправлено 75 из 553открыли по кнопке 21 · подарков выдано 14 (3 дн.)'.replace('падеж', 'падежи'))
    expect(screen.getByTestId('broadcast-broadcast-2026-09').textContent).toContain('завершена')
    expect(screen.getByTestId('broadcast-broadcast-2026-09').textContent).toContain('без кнопки')
    expect(screen.getByTestId('broadcast-draft').textContent).toContain('черновик')

    await userEvent.click(running)
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-broadcast', key: 'broadcast-2026-10' })
    await userEvent.click(screen.getByTestId('broadcast-new'))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-broadcast' })
  })

  it('says so when there were none', async () => {
    campaigns.list.mockResolvedValue({ campaigns: [] })
    render(<AdminBroadcastsScreen navigate={navigate} />)
    expect((await screen.findByTestId('admin-empty')).textContent).toBe('Рассылок пока не было.')
  })
})
