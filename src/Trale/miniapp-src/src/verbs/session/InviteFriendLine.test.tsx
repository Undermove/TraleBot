import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api as mockedApi } from '../../api'
import Finish from './Finish'
import InviteFriendLine from './InviteFriendLine'

vi.mock('../../api', () => ({ api: { referral: vi.fn() } }))
vi.mock('../ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), haptic: vi.fn(), floater: vi.fn(), burst: vi.fn() }))
const api = vi.mocked(mockedApi)

const offer = {
  link: 'https://t.me/trale_bot?start=ref_42',
  shareText: 'Учу грузинский в TraleBot 🇬🇪 Заходи по моей ссылке — тебе дадут 60 дней бесплатно вместо 30.',
  invitedCount: 0,
  activatedCount: 0,
  rules: [],
  state: 'accessEnded' as const,
  bonusShortLabel: 'неделя доступа',
  inviteLine: 'Позови друга — получишь неделю доступа',
  capReached: false
}

const openTelegramLink = vi.fn()

beforeEach(() => {
  api.referral.mockReset()
  openTelegramLink.mockReset()
  ;(window as any).Telegram = { WebApp: { openTelegramLink } }
})
afterEach(() => { delete (window as any).Telegram })

/** Даём запросу завершиться и убеждаемся, что строки так и нет. */
async function expectNoLine() {
  await waitFor(() => expect(api.referral).toHaveBeenCalled())
  await Promise.resolve()
  expect(screen.queryByTestId('invite-friend-line')).toBeNull()
}

describe('InviteFriendLine', () => {
  it.each([
    ['trial', 'Позови друга — получишь +7 дней к пробному периоду'],
    ['accessEnded', 'Позови друга — получишь неделю доступа'],
    ['pro', 'Позови друга — получишь +14 дней подписки']
  ])('says what the server promises in state %s', async (state, inviteLine) => {
    api.referral.mockResolvedValue({ ...offer, state: state as any, inviteLine })
    render(<InviteFriendLine />)
    expect((await screen.findByTestId('invite-friend-line')).textContent).toBe(inviteLine)
  })

  it('opens the Telegram share window with the own link and the text for the friend', async () => {
    api.referral.mockResolvedValue(offer)
    render(<InviteFriendLine />)
    await userEvent.click(await screen.findByTestId('invite-friend-line'))
    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    const url = new URL(openTelegramLink.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://t.me/share/url')
    expect(url.searchParams.get('url')).toBe(offer.link)
    expect(url.searchParams.get('text')).toBe(offer.shareText)
    expect(url.searchParams.get('text')).not.toMatch(/триал/i)
  })

  it('is not shown to Lifetime — the server sends no offer', async () => {
    api.referral.mockResolvedValue({ ...offer, state: 'lifetime', bonusShortLabel: '', inviteLine: '' })
    render(<InviteFriendLine />)
    await expectNoLine()
  })

  it('is not shown when the yearly cap is reached', async () => {
    api.referral.mockResolvedValue({ ...offer, capReached: true })
    render(<InviteFriendLine />)
    await expectNoLine()
  })

  it('is not shown when the request fails', async () => {
    api.referral.mockRejectedValue(new Error('offline'))
    render(<InviteFriendLine />)
    await expectNoLine()
  })
})

describe('Finish — invite line', () => {
  const state = (examPassed: boolean) => ({ level: 'meet', memory: { examPassed } })
  function renderFinish(props: { exam: any; saved: any }) {
    return render(
      <Finish
        verb={{ ru: 'писать' } as any}
        items={[]}
        touched={new Map()}
        levelBefore={'meet' as any}
        progress={{}}
        onMore={() => {}}
        onDone={() => {}}
        {...props}
      />
    )
  }

  it('shows one quiet line under the buttons after an ordinary session', async () => {
    api.referral.mockResolvedValue(offer)
    renderFinish({ exam: null, saved: { state: state(false), xpEarned: 5 } })
    const line = await screen.findByTestId('invite-friend-line')
    const buttons = screen.getAllByRole('button')
    expect(buttons[buttons.length - 1]).toBe(line)
    expect(screen.getAllByTestId('invite-friend-line')).toHaveLength(1)
  })

  it('shows the line after a passed exam', async () => {
    api.referral.mockResolvedValue(offer)
    renderFinish({ exam: { missed: [] }, saved: { state: state(true), xpEarned: 5 } })
    expect(await screen.findByTestId('invite-friend-line')).toBeTruthy()
  })

  it('never asks on the exam-failed path', async () => {
    api.referral.mockResolvedValue(offer)
    renderFinish({ exam: { missed: [] }, saved: { state: state(false), xpEarned: 0 } })
    expect(screen.getByTestId('session-finish').getAttribute('data-exam')).toBe('failed')
    await Promise.resolve()
    expect(api.referral).not.toHaveBeenCalled()
    expect(screen.queryByTestId('invite-friend-line')).toBeNull()
  })
})
