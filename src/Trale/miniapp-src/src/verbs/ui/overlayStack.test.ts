import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { OVERLAY, closeTopOverlay, hasOverlay, pushOverlay, useHasOverlay, useOverlay } from './overlayStack'

describe('overlay stack behind the Telegram Back button', () => {
  const opened: (() => void)[] = []
  const open = (close: () => void, level?: number) => { const remove = pushOverlay(close, level); opened.push(remove); return remove }
  afterEach(() => { opened.splice(0).forEach(remove => remove()) })

  it('has nothing to close when no overlay is open', () => {
    expect(hasOverlay()).toBe(false)
    expect(closeTopOverlay()).toBe(false)
  })

  it('closes the overlay opened last and leaves the ones under it', () => {
    const sheet = vi.fn(), game = vi.fn()
    open(sheet, OVERLAY.sheet)
    open(game, OVERLAY.screen)

    expect(closeTopOverlay()).toBe(true)

    expect(game).toHaveBeenCalledTimes(1)
    expect(sheet).not.toHaveBeenCalled()
  })

  it('closes a higher layer first even when it registered earlier (rules sheet mounted together with its game)', () => {
    const help = vi.fn(), game = vi.fn()
    open(help, OVERLAY.help)
    open(game, OVERLAY.screen)

    closeTopOverlay()

    expect(help).toHaveBeenCalledTimes(1)
    expect(game).not.toHaveBeenCalled()
  })

  it('among overlays of the same level closes the newest: a verb card opened from another card', () => {
    const first = vi.fn(), second = vi.fn()
    open(first)
    open(second)

    closeTopOverlay()

    expect(second).toHaveBeenCalled()
    expect(first).not.toHaveBeenCalled()
  })

  it('forgets an overlay once it has removed itself', () => {
    const sheet = vi.fn()
    const remove = open(sheet)

    remove()
    remove()

    expect(hasOverlay()).toBe(false)
    expect(closeTopOverlay()).toBe(false)
    expect(sheet).not.toHaveBeenCalled()
  })

  it('useOverlay registers while mounted and active, and always calls the latest close', () => {
    const before = vi.fn(), after = vi.fn()
    const { rerender, unmount } = renderHook(({ close, active }) => useOverlay(close, OVERLAY.screen, active), {
      initialProps: { close: before, active: false }
    })
    expect(hasOverlay()).toBe(false)

    rerender({ close: before, active: true })
    rerender({ close: after, active: true })
    closeTopOverlay()

    expect(after).toHaveBeenCalledTimes(1)
    expect(before).not.toHaveBeenCalled()

    unmount()
    expect(hasOverlay()).toBe(false)
  })

  it('useHasOverlay follows the stack so the app can show the Back button', () => {
    const { result } = renderHook(() => useHasOverlay())
    expect(result.current).toBe(false)

    let remove = () => {}
    act(() => { remove = open(vi.fn()) })
    expect(result.current).toBe(true)

    act(() => remove())
    expect(result.current).toBe(false)
  })
})
