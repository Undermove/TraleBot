import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportCampaignOpen } from './api'
import { campaignKeyFromUrl, campaignOpenSettled, giftUntilText, lateCampaignOpen, pluralDays, reportCampaignOpenFromUrl, takeCampaignGift } from './campaignOpen'

vi.mock('./api', () => ({ reportCampaignOpen: vi.fn(() => Promise.resolve({ ok: true })) }))
const report = vi.mocked(reportCampaignOpen)

beforeEach(() => report.mockClear())

describe('campaign open', () => {
  it('reads the campaign from the button address, next to an existing deep link', () => {
    expect(campaignKeyFromUrl('?screen=vocabulary&c=referral-2026-10')).toBe('referral-2026-10')
    expect(campaignKeyFromUrl('?c=ref_test')).toBe('ref_test')
  })

  it('ignores an ordinary launch and garbage', () => {
    expect(campaignKeyFromUrl('')).toBeNull()
    expect(campaignKeyFromUrl('?screen=vocabulary')).toBeNull()
    expect(campaignKeyFromUrl('?c=')).toBeNull()
    expect(campaignKeyFromUrl('?c=%3Cscript%3E')).toBeNull()
  })

  it('reports the open once per launch and only when there is a campaign', () => {
    reportCampaignOpenFromUrl('?screen=vocabulary')
    expect(report).not.toHaveBeenCalled()
    reportCampaignOpenFromUrl('?c=referral-2026-10')
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('referral-2026-10')
  })

  it('a failed report does not break the launch', () => {
    report.mockRejectedValueOnce(new Error('offline'))
    expect(() => reportCampaignOpenFromUrl('?c=referral-2026-10')).not.toThrow()
  })

  it('keeps the gift the open brought — to be said once — and lets the profile wait for it', async () => {
    report.mockResolvedValueOnce({ ok: true, gift: { days: 3, accessUntilUtc: '2026-10-10T12:00:00Z' } } as never)
    reportCampaignOpenFromUrl('?screen=verbs&c=verbs-2026-10')
    await campaignOpenSettled()

    const gift = takeCampaignGift()
    expect(gift).toEqual({ days: 3, accessUntilUtc: '2026-10-10T12:00:00Z' })
    expect(giftUntilText(gift!)).toMatch(/^10 октября|^11 октября|^9 октября/)
    expect(takeCampaignGift()).toBeNull()
  })

  it('an open without a gift leaves nothing to say, and a failed one does not hold the launch', async () => {
    reportCampaignOpenFromUrl('?c=referral-2026-10')
    await campaignOpenSettled()
    expect(takeCampaignGift()).toBeNull()

    report.mockRejectedValueOnce(new Error('offline'))
    reportCampaignOpenFromUrl('?c=referral-2026-10')
    await expect(campaignOpenSettled()).resolves.toBeUndefined()
  })

  it('counts days in Russian', () => {
    expect([1, 2, 3, 5, 11, 21].map(pluralDays)).toEqual(['день', 'дня', 'дня', 'дней', 'дней', 'день'])
  })

  it('a report that did not get through is tried once more, so the gift is not lost to a blink of the network', async () => {
    vi.useFakeTimers()
    try {
      report.mockRejectedValueOnce(new Error('offline'))
      report.mockResolvedValueOnce({ ok: true, gift: { days: 3, accessUntilUtc: '2026-10-10T12:00:00Z' } } as never)
      reportCampaignOpenFromUrl('?screen=verbs&c=verbs-2026-10')
      await vi.advanceTimersByTimeAsync(1600)
      await campaignOpenSettled()

      expect(report).toHaveBeenCalledTimes(2)
      expect(takeCampaignGift()).toEqual({ days: 3, accessUntilUtc: '2026-10-10T12:00:00Z' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('a report that got through in time is not waited for again', async () => {
    reportCampaignOpenFromUrl('?moduleId=my-day&lessonId=1&c=myday-back')
    await campaignOpenSettled()
    await expect(lateCampaignOpen()).resolves.toBe(false)
  })

  it('a slow report: the profile stops waiting, but the gift can still be waited for before the purchase screen', async () => {
    vi.useFakeTimers()
    try {
      let arrive: (r: { ok: boolean }) => void = () => {}
      report.mockReturnValueOnce(new Promise((resolve) => { arrive = resolve }) as never)
      reportCampaignOpenFromUrl('?moduleId=my-day&lessonId=1&c=myday-back')
      await vi.advanceTimersByTimeAsync(2600)
      await campaignOpenSettled() // профиль дальше не ждёт

      const late = lateCampaignOpen()
      arrive({ ok: true })
      await expect(late).resolves.toBe(true)
      await expect(lateCampaignOpen()).resolves.toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a report that never arrives does not hold the launch forever', async () => {
    vi.useFakeTimers()
    try {
      report.mockReturnValueOnce(new Promise(() => {}) as never)
      reportCampaignOpenFromUrl('?moduleId=my-day&lessonId=1&c=myday-back')
      await vi.advanceTimersByTimeAsync(2600)
      const late = lateCampaignOpen()
      await vi.advanceTimersByTimeAsync(6100)
      await expect(late).resolves.toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
