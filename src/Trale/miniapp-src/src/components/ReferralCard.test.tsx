import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api as mockedApi } from '../api'
import ReferralCard, { ROW_SIZE, seatCaption, seatRow } from './ReferralCard'

// Карточка «Позови друга» в профиле: что в ней видит человек в каждом состоянии и что все цифры
// и обещания — из ответа сервера, а не из головы.

vi.mock('../api', () => ({ api: { referral: vi.fn() } }))
const api = vi.mocked(mockedApi)

const base = {
  link: 'https://t.me/trale_bot?start=ref_42',
  shareText: 'Учу грузинский в TraleBot 🇬🇪 Заходи по моей ссылке — тебе дадут 60 дней бесплатно вместо 30.',
  invitedCount: 0,
  activatedCount: 0,
  earnedDays: 0,
  friendLine: 'Другу — 60 дней бесплатно',
  rules: ['Другу — 60 дней бесплатно вместо 30, если он раньше не пользовался TraleBot.', 'Не больше 5 друзей в день и 6 в год.'],
  state: 'trial' as const,
  bonusShortLabel: '+7 дней к пробному',
  inviteLine: 'Позови друга — получишь +7 дней к пробному периоду',
  capReached: false
}

const openTelegramLink = vi.fn()

async function show(patch: Partial<typeof base> | object = {}) {
  api.referral.mockResolvedValue({ ...base, ...patch } as any)
  const view = render(<ReferralCard />)
  await waitFor(() => expect(api.referral).toHaveBeenCalled())
  await Promise.resolve()
  return view
}
const seats = () => screen.getAllByTestId('referral-seat').map((s) => s.getAttribute('data-seat'))

beforeEach(() => {
  api.referral.mockReset()
  openTelegramLink.mockReset()
  ;(window as any).Telegram = { WebApp: { openTelegramLink } }
})
afterEach(() => {
  delete (window as any).Telegram
})

describe('ряд мест', () => {
  it('сначала те, кто начал, потом те, кто только пришёл, остальные свободны', () => {
    expect(seatRow(3, 2)).toEqual({ row: 1, seats: ['started', 'started', 'waiting', 'free', 'free', 'free'] })
    expect(seatRow(0, 0).seats).toEqual(Array(ROW_SIZE).fill('free'))
  })

  it('заполненный ряд открывает следующий', () => {
    expect(seatRow(6, 6)).toEqual({ row: 2, seats: Array(ROW_SIZE).fill('free') })
    expect(seatRow(8, 7)).toEqual({ row: 2, seats: ['started', 'waiting', 'free', 'free', 'free', 'free'] })
  })

  it('ожидающих не больше, чем свободных мест в ряду', () => {
    expect(seatRow(20, 4).seats).toEqual(['started', 'started', 'started', 'started', 'waiting', 'waiting'])
  })
})

describe('подпись под рядом', () => {
  it('пока никого — зовёт занять первое место', () => {
    expect(seatCaption({ invitedCount: 0, activatedCount: 0, earnedDays: 0 })).toBe('Пока никого — первое место ждёт друга')
  })

  it('цифры — ровно те, что пришли с сервера', () => {
    expect(seatCaption({ invitedCount: 3, activatedCount: 2, earnedDays: 14 })).toBe('Пришли: 3 · начали: 2 · тебе +14 дней')
    expect(seatCaption({ invitedCount: 1, activatedCount: 1, earnedDays: 21 })).toBe('Пришли: 1 · начали: 1 · тебе +21 день')
  })

  it('без заработанных дней про дни не говорит', () => {
    expect(seatCaption({ invitedCount: 2, activatedCount: 0, earnedDays: 0 })).toBe('Пришли: 2 · начали: 0')
    expect(seatCaption({ invitedCount: 2, activatedCount: 2 })).toBe('Пришли: 2 · начали: 2')
  })
})

describe('ReferralCard', () => {
  it('никого не приглашал: награда и подарок другу — словами сервера, все места свободны', async () => {
    await show()
    expect(await screen.findByText('Позови друга')).toBeInTheDocument()
    expect(screen.getByTestId('referral-reward')).toHaveTextContent('тебе +7 дней к пробному')
    expect(screen.getByTestId('referral-friend-line')).toHaveTextContent('Другу — 60 дней бесплатно')
    expect(seats()).toEqual(Array(ROW_SIZE).fill('free'))
    expect(screen.getByTestId('referral-caption')).toHaveTextContent('Пока никого — первое место ждёт друга')
    expect(screen.queryByTestId('referral-rules')).toBeNull()
  })

  it('есть приглашённые: лапки и подпись по цифрам из ответа', async () => {
    await show({ state: 'accessEnded', bonusShortLabel: 'неделя доступа', invitedCount: 3, activatedCount: 2, earnedDays: 14 })
    expect(await screen.findByTestId('referral-reward')).toHaveTextContent('тебе неделя доступа')
    expect(seats()).toEqual(['started', 'started', 'waiting', 'free', 'free', 'free'])
    expect(screen.getByTestId('referral-caption')).toHaveTextContent('Пришли: 3 · начали: 2 · тебе +14 дней')
    expect(screen.queryByTestId('referral-row')).toBeNull()
  })

  it('подписчику обещает дни подписки', async () => {
    await show({ state: 'pro', bonusShortLabel: '+14 дней подписки' })
    expect(await screen.findByTestId('referral-reward')).toHaveTextContent('тебе +14 дней подписки')
  })

  it('подписка навсегда: себе ничего не обещает — это подарок другу; ряды идут дальше', async () => {
    await show({ state: 'lifetime', bonusShortLabel: '', inviteLine: '', invitedCount: 7, activatedCount: 7, earnedDays: 0 })
    expect(await screen.findByTestId('referral-reward')).toHaveTextContent('подарок другу')
    expect(screen.getByTestId('referral-card').textContent).not.toMatch(/тебе/i)
    expect(screen.getByTestId('referral-row')).toHaveTextContent('ряд 2')
    expect(seats()).toEqual(['started', 'free', 'free', 'free', 'free', 'free'])
  })

  it('«Позвать друга» открывает пересылку в Telegram с текстом и ссылкой и благодарит без окон', async () => {
    await show({ invitedCount: 1, activatedCount: 1, earnedDays: 7 })
    await userEvent.click(await screen.findByRole('button', { name: 'Позвать друга' }))

    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    const url = new URL(openTelegramLink.mock.calls[0][0])
    expect(`${url.origin}${url.pathname}`).toBe('https://t.me/share/url')
    expect(url.searchParams.get('url')).toBe(base.link)
    expect(url.searchParams.get('text')).toBe(base.shareText)

    expect(screen.getByTestId('referral-caption')).toHaveTextContent('Спасибо! Жду друга — тут появится его лапка.')
    expect(screen.getByRole('button', { name: 'Позвать ещё' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Оживает место, которое займёт следующий друг.
    const pulsing = screen.getAllByTestId('referral-seat').map((s) => s.classList.contains('referral-paw-pulse'))
    expect(pulsing).toEqual([false, true, false, false, false, false])
  })

  it('правила — по нажатию «как это работает», словами сервера; там же ссылку можно скопировать', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await show()
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    await user.click(await screen.findByRole('button', { name: 'как это работает' }))
    const rules = screen.getByTestId('referral-rules')
    for (const line of base.rules) expect(rules).toHaveTextContent(line)

    await user.click(screen.getByRole('button', { name: 'Скопировать ссылку' }))
    expect(writeText).toHaveBeenCalledWith(base.link)
    expect(await screen.findByRole('button', { name: 'Ссылка скопирована' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'как это работает' }))
    expect(screen.queryByTestId('referral-rules')).toBeNull()
  })

  it('годовой лимит исчерпан — карточки нет', async () => {
    const view = await show({ capReached: true, invitedCount: 6, activatedCount: 6 })
    expect(view.container).toBeEmptyDOMElement()
  })

  it('сервер не ответил — карточки нет, профиль не падает', async () => {
    api.referral.mockRejectedValue(new Error('offline'))
    const view = render(<ReferralCard />)
    await waitFor(() => expect(api.referral).toHaveBeenCalled())
    expect(view.container).toBeEmptyDOMElement()
  })
})
