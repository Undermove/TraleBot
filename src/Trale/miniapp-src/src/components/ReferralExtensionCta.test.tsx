import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { api as mockedApi } from '../api'
import ReferralExtensionCta from './ReferralExtensionCta'

vi.mock('../api', () => ({ api: { referral: vi.fn() } }))
const api = vi.mocked(mockedApi)

const base = {
  link: 'https://t.me/trale_bot?start=ref_42',
  shareText: 'текст для друга',
  invitedCount: 0,
  activatedCount: 0,
  rules: [],
  capReached: false
}

beforeEach(() => api.referral.mockReset())

describe('ReferralExtensionCta', () => {
  it.each([
    ['trial', '+7 дней к пробному', 'Позови друга — получишь +7 дней к пробному периоду', '+7 дней к пробному — бесплатно'],
    ['accessEnded', 'неделя доступа', 'Позови друга — получишь неделю доступа', 'Неделя доступа — бесплатно'],
    ['pro', '+14 дней подписки', 'Позови друга — получишь +14 дней подписки', '+14 дней подписки — бесплатно']
  ])('block: promises exactly what the server says in state %s', async (state, bonusShortLabel, inviteLine, title) => {
    api.referral.mockResolvedValue({ ...base, state: state as any, bonusShortLabel, inviteLine })
    render(<ReferralExtensionCta variant="block" />)
    const cta = await screen.findByTestId('referral-extension-cta')
    expect(cta.textContent).toContain(title)
    expect(cta.textContent).toContain(`${inviteLine}, когда он начнёт заниматься`)
    expect(cta.textContent).not.toMatch(/триал/i)
  })

  it('inline: shows the short label', async () => {
    api.referral.mockResolvedValue({ ...base, state: 'accessEnded', bonusShortLabel: 'неделя доступа', inviteLine: 'Позови друга — получишь неделю доступа' })
    render(<ReferralExtensionCta variant="inline" />)
    expect((await screen.findByTestId('referral-extension-cta')).textContent).toBe('неделя доступа')
  })

  it('shows nothing when the server has no offer (Lifetime)', async () => {
    api.referral.mockResolvedValue({ ...base, state: 'lifetime', bonusShortLabel: '', inviteLine: '' })
    render(<ReferralExtensionCta variant="block" />)
    await waitFor(() => expect(api.referral).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('referral-extension-cta')).toBeNull()
  })
})
