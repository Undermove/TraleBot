import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Screen } from '../../types'
import {
  ApiError, api as mockedApi, adminCampaigns as mockedCampaigns, adminSections as mocked,
  type AdminOverviewDto, type AdminPaymentsDto, type AdminUserDetail, type AdminUserRowDto, type AdminUsersPageDto, type CampaignListItemDto
} from '../../api'
import { enterAdmin, leaveAdmin } from '../../admin/adminNav'
import AdminMoreScreen from '../AdminMoreScreen'
import AdminScreen from '../AdminScreen'
import AdminUsersScreen from '../AdminUsersScreen'
import AdminUserScreen from '../AdminUserScreen'
import AdminPaymentsScreen from '../AdminPaymentsScreen'
import AdminBroadcastsScreen from '../AdminBroadcastsScreen'

vi.mock('../../api', async () => ({
  ...(await vi.importActual<typeof import('../../api')>('../../api')),
  api: { adminUserDetail: vi.fn(), adminGrantPro: vi.fn(), adminRevokePro: vi.fn(), adminStats: vi.fn(), adminSignups: vi.fn() },
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
  leaveAdmin()
  try { localStorage.clear() } catch {}
})

function at(...path: Screen[]) {
  path.forEach(s => enterAdmin(s as Parameters<typeof enterAdmin>[0]))
}
afterEach(() => vi.unstubAllGlobals())

const stats = {
  totalUsers: 848, activeUsers: 808, proUsers: 6, trialUsers: 17, freeUsers: 825, newUsersToday: 3, newUsersWeek: 21, newUsersMonth: 64,
  totalRevenueStars: 1500, revenueWeekStars: 100, totalPurchases: 6, totalRefunds: 1, totalVocabularyEntries: 9100, averageVocabularyPerUser: 10.7, conversionPostTrialPct: 0.7
}

describe('AdminScreen — статистика', () => {
  beforeEach(() => {
    api.adminStats.mockResolvedValue(stats as never)
    api.adminSignups.mockResolvedValue({ days: 30, points: [{ date: '2026-10-08', count: 3 }] })
    sections.overview.mockResolvedValue(overview)
  })

  it('is the screen it always was — the same tiles in the same order and the signups chart — with four more numbers in the same grids', async () => {
    render(<AdminScreen navigate={navigate} />)

    const page = await screen.findByTestId('admin-stats')
    await waitFor(() => expect(page.textContent).toContain('Новые юзеры'))
    // Подписи плиток по порядку: прежние, как на main, и за ними новые.
    const labels = [...page.querySelectorAll('.jewel-tile .mn-eyebrow')].map(e => e.textContent)
    expect(labels).toEqual([
      'Всего', 'Активных', 'Pro', 'На триале', 'Free', 'Конверсия',
      'Всего ⭐', 'За неделю ⭐', 'Покупок', 'Возвратов', 'Оплат за 30 дней', 'Подписок действует',
      'Слов в словарях', 'Слов на юзера', 'Новых сегодня', 'За неделю', 'Занимались сегодня', 'Занимались за неделю'
    ])
    expect([...page.querySelectorAll(':scope .mn-eyebrow.mb-2, :scope .flex > .mn-eyebrow')].map(e => e.textContent)).toEqual(['Пользователи', 'Выручка', 'Активность', 'Новые юзеры'])
    expect(page.textContent).toContain('Конверсия0.7%')
    expect(page.textContent).toContain('Подписок действует2')
    expect(page.textContent).toContain('Занимались за неделю61')
    expect(screen.getAllByRole('button', { name: /^(7|30|90)д$/ })).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: '90д' }))
    await waitFor(() => expect(api.adminSignups).toHaveBeenLastCalledWith(90))
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'profile' })
  })

  it('still shows the old tiles when the new numbers could not be read; says «Нет доступа.» to a non-owner; offers a retry', async () => {
    sections.overview.mockRejectedValueOnce(new Error('offline'))
    const partial = render(<AdminScreen navigate={navigate} />)
    await waitFor(() => expect(screen.getByTestId('admin-stats').textContent).toContain('Возвратов1'))
    expect(screen.getByTestId('admin-stats').textContent).not.toContain('Подписок действует')
    partial.unmount()

    api.adminStats.mockRejectedValueOnce(new ApiError(404, ''))
    const denied = render(<AdminScreen navigate={navigate} />)
    expect((await screen.findByTestId('admin-denied')).textContent).toBe('Нет доступа.')
    denied.unmount()

    api.adminStats.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(stats as never)
    render(<AdminScreen navigate={navigate} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Попробовать ещё раз' }))
    await waitFor(() => expect(screen.getByTestId('admin-stats').textContent).toContain('Пользователи'))
  })
})

describe('AdminMoreScreen', () => {
  it('leads to verbs (with how many wait), payments and system', async () => {
    sections.overview.mockResolvedValue(overview)
    render(<AdminMoreScreen navigate={navigate} />)
    expect((await screen.findByTestId('admin-verbs-waits')).textContent).toBe('ждут: 5')
    const opens: [string, Screen][] = [['admin-more-verbs', { kind: 'verb-review' }], ['admin-more-payments', { kind: 'admin-payments' }], ['admin-more-system', { kind: 'admin-system' }]]
    for (const [testId, target] of opens) {
      await userEvent.click(screen.getByTestId(testId))
      expect(navigate).toHaveBeenLastCalledWith(target)
    }
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

  it('remembers the filter, the search and the loaded list when the owner comes back to the tab', async () => {
    sections.users.mockResolvedValue(page([row(1), row(2)]))
    const first = render(<AdminUsersScreen navigate={navigate} />)
    await screen.findByTestId('user-1')
    await userEvent.click(screen.getByRole('radio', { name: 'платят · 2' }))
    await waitFor(() => expect(sections.users).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'paying' })))
    await screen.findByTestId('user-2')
    const calls = sections.users.mock.calls.length
    first.unmount()

    render(<AdminUsersScreen navigate={navigate} />)
    expect(screen.getByTestId('user-2')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'платят · 2' }).getAttribute('aria-checked')).toBe('true')
    expect(sections.users.mock.calls.length).toBe(calls)
  })

  it('says «Нет доступа.» to a non-owner', async () => {
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
    at({ kind: 'admin-users' }, { kind: 'admin-user', telegramId: 5000000100 })
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

  it('offers to continue a draft left on this device, or to delete it', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    localStorage.setItem('trale_admin_draft_broadcast', JSON.stringify({ step: 3, message: 'Новые уроки про падежи\nЗагляни!' }))
    campaigns.list.mockResolvedValue({ campaigns: [] })
    const first = render(<AdminBroadcastsScreen navigate={navigate} />)
    expect((await screen.findByTestId('broadcast-draft')).textContent).toContain('Новые уроки про падежи')
    await userEvent.click(screen.getByTestId('broadcast-draft-continue'))
    expect(navigate).toHaveBeenLastCalledWith({ kind: 'admin-broadcast', draft: true })
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(screen.queryByTestId('broadcast-draft')).toBeNull()
    expect(localStorage.getItem('trale_admin_draft_broadcast')).toBeNull()
    first.unmount()
  })

  it('says so when there were none', async () => {
    campaigns.list.mockResolvedValue({ campaigns: [] })
    render(<AdminBroadcastsScreen navigate={navigate} />)
    expect((await screen.findByTestId('admin-empty')).textContent).toContain('Рассылок пока не было.')
  })
})
