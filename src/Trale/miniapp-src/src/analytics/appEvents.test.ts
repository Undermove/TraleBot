import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { __setAppEventSender, appEvents, flushAppEvents, type AppEventDto } from './appEvents'

describe('app events tracker', () => {
  let batches: AppEventDto[][] = []
  beforeEach(() => { batches = []; vi.useFakeTimers(); __setAppEventSender(b => { batches.push(b) }) })
  afterEach(() => { __setAppEventSender(null); vi.useRealTimers(); delete (window as any).Telegram })

  it('is off in tests and outside Telegram unless a sender is set', () => {
    __setAppEventSender(null)
    appEvents.opened()
    appEvents.screen('dashboard')
    flushAppEvents()
    expect(batches).toHaveLength(0)
  })

  it('sends the open right away, with the client and the link it came by', () => {
    ;(window as any).Telegram = { WebApp: { platform: 'ios', initDataUnsafe: { start_param: 'verbs_site' } } }
    appEvents.opened()
    expect(batches).toHaveLength(1)
    expect(batches[0][0]).toMatchObject({ event: 'app_open', platform: 'ios', startParam: 'verbs_site' })
    expect(batches[0][0].value).toBeGreaterThanOrEqual(0)
  })

  it('marks a load where the server did not know the person', () => {
    appEvents.ready(false)
    appEvents.ready(true)
    expect(batches.flat().map(e => [e.event, e.target])).toEqual([['app_ready', 'no-auth'], ['app_ready', undefined]])
  })

  it('counts a screen once per visit and skips loading and admin', () => {
    appEvents.screen('loading')
    appEvents.screen('dashboard')
    appEvents.screen('dashboard')
    appEvents.screen('admin-users')
    appEvents.screen('verbs')
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(4100)
    expect(batches.flat().map(e => e.target)).toEqual(['dashboard', 'verbs'])
  })

  it('hiding the app sends the screen it was left on and how long it was open', () => {
    appEvents.opened()
    appEvents.screen('onboarding')
    vi.advanceTimersByTime(1000)
    vi.setSystemTime(Date.now() + 30_000)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    const hide = batches.flat().find(e => e.event === 'app_hide')!
    expect(hide.target).toBe('onboarding')
    expect(hide.value).toBeGreaterThanOrEqual(30)
  })
})
