import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportCampaignOpen } from './api'
import { campaignKeyFromUrl, reportCampaignOpenFromUrl } from './campaignOpen'

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
})
