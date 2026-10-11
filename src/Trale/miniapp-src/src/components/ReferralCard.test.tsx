import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api as mockedApi } from '../api'
import ReferralCard, { ROW_SIZE, seatCaption, seatRow, wasReferralOpened } from './ReferralCard'

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
/** Показать карточку и раскрыть её нажатием на строку. */
async function showOpen(patch: Partial<typeof base> | object = {}) {
  const view = await show(patch)
  await userEvent.click(await screen.findByTestId('referral-toggle'))
  return view
}
const seats = () => screen.getAllByTestId('referral-seat').map((s) => s.getAttribute('data-seat'))
const miniSeats = () => [...screen.getByTestId('referral-mini-seats').querySelectorAll('svg')].map((s) => s.getAttribute('data-seat'))
const card = () => screen.getByTestId('referral-card')
const reducedMotion = (on: boolean) => {
  ;(window as any).matchMedia = (query: string) => ({ matches: on && query.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} })
}

beforeEach(() => {
  localStorage.clear()
  reducedMotion(false)
  api.referral.mockReset()
  openTelegramLink.mockReset()
  ;(window as any).Telegram = { WebApp: { openTelegramLink } }
})
afterEach(() => {
  delete (window as any).Telegram
  delete (window as any).matchMedia
  vi.restoreAllMocks()
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

describe('свёрнутая строка', () => {
  it('по умолчанию свёрнута: название, мелкий ряд мест и награда; остальное скрыто', async () => {
    await show({ invitedCount: 3, activatedCount: 2, earnedDays: 14 })
    const toggle = await screen.findByTestId('referral-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Позови друга')
    expect(screen.getByTestId('referral-reward')).toHaveTextContent('тебе +7 дней к пробному')
    expect(miniSeats()).toEqual(['started', 'started', 'waiting', 'free', 'free', 'free'])
    expect(screen.getByTestId('referral-body')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('referral-body')).toHaveStyle({ visibility: 'hidden' })
  })

  it('нажатие на строку раскрывает на месте, повторное — сворачивает', async () => {
    await show()
    const toggle = await screen.findByTestId('referral-toggle')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(card()).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('referral-body')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByTestId('referral-body')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByRole('button', { name: 'Позвать друга' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('referral-body')).toHaveStyle({ visibility: 'hidden' })
    expect(screen.getByTestId('referral-mini-seats')).toBeInTheDocument()
  })

  it('пока не раскрывали — зовёт: качается первое свободное место, по награде идёт блик', async () => {
    await show({ invitedCount: 2, activatedCount: 2, earnedDays: 14 })
    await screen.findByTestId('referral-toggle')
    expect(card()).toHaveAttribute('data-attract', 'true')
    const calling = [...screen.getByTestId('referral-mini-seats').querySelectorAll('svg')].map((s) => s.classList.contains('referral-paw-call'))
    expect(calling).toEqual([false, false, true, false, false, false])
    expect(screen.getByTestId('referral-reward')).toHaveClass('referral-shine')
  })

  it('после первого раскрытия больше не зовёт — и в следующий заход тоже', async () => {
    const first = await show()
    const toggle = await screen.findByTestId('referral-toggle')
    expect(wasReferralOpened()).toBe(false)
    await userEvent.click(toggle)
    await userEvent.click(toggle)

    expect(wasReferralOpened()).toBe(true)
    expect(card()).toHaveAttribute('data-attract', 'false')
    expect(screen.getByTestId('referral-mini-seats').querySelector('.referral-paw-call')).toBeNull()
    expect(screen.getByTestId('referral-reward')).not.toHaveClass('referral-shine')

    first.unmount()
    await show()
    await screen.findByTestId('referral-toggle')
    expect(card()).toHaveAttribute('data-attract', 'false')
    expect(screen.getByTestId('referral-toggle')).toHaveAttribute('aria-expanded', 'false')
  })

  it('при «уменьшить движение» не зовёт и не качает лапку после приглашения', async () => {
    reducedMotion(true)
    await show()
    const toggle = await screen.findByTestId('referral-toggle')
    expect(card()).toHaveAttribute('data-attract', 'false')
    expect(document.querySelector('.referral-paw-call')).toBeNull()
    expect(screen.getByTestId('referral-reward')).not.toHaveClass('referral-shine')

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: 'Позвать друга' }))
    expect(screen.getByTestId('referral-caption')).toHaveTextContent('Спасибо!')
    expect(document.querySelector('.referral-paw-pulse')).toBeNull()
  })

  it('без хранилища не падает: раскрывается, а зов вернётся в следующий раз', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    await show()
    const toggle = await screen.findByTestId('referral-toggle')
    expect(card()).toHaveAttribute('data-attract', 'true')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(card()).toHaveAttribute('data-attract', 'false')
  })
})

describe('ReferralCard', () => {
  it('никого не приглашал: награда и подарок другу — словами сервера, все места свободны', async () => {
    await showOpen()
    expect(await screen.findByText('Позови друга')).toBeInTheDocument()
    expect(screen.getByTestId('referral-reward')).toHaveTextContent('тебе +7 дней к пробному')
    expect(screen.getByTestId('referral-friend-line')).toHaveTextContent('Другу — 60 дней бесплатно')
    expect(seats()).toEqual(Array(ROW_SIZE).fill('free'))
    expect(screen.getByTestId('referral-caption')).toHaveTextContent('Пока никого — первое место ждёт друга')
    expect(screen.queryByTestId('referral-rules')).toBeNull()
  })

  it('есть приглашённые: лапки и подпись по цифрам из ответа', async () => {
    await showOpen({ state: 'accessEnded', bonusShortLabel: 'неделя доступа', invitedCount: 3, activatedCount: 2, earnedDays: 14 })
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
    await showOpen({ state: 'lifetime', bonusShortLabel: '', inviteLine: '', invitedCount: 7, activatedCount: 7, earnedDays: 0 })
    expect(await screen.findByTestId('referral-reward')).toHaveTextContent('подарок другу')
    expect(screen.getByTestId('referral-card').textContent).not.toMatch(/тебе/i)
    expect(screen.getByTestId('referral-row')).toHaveTextContent('ряд 2')
    expect(seats()).toEqual(['started', 'free', 'free', 'free', 'free', 'free'])
  })

  it('«Позвать друга» открывает пересылку в Telegram с текстом и ссылкой и благодарит без окон', async () => {
    await showOpen({ invitedCount: 1, activatedCount: 1, earnedDays: 7 })
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
    await showOpen()
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
