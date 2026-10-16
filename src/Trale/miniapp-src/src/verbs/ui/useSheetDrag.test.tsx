import React, { useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSheetDrag } from './useSheetDrag'

function Sheet({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const { offset } = useSheetDrag(panel, onClose)
  return <div ref={panel} data-testid="panel" data-offset={offset} />
}

function touch(el: Element, type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: unknown }
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] })
  act(() => { el.dispatchEvent(e) })
}

describe('useSheetDrag', () => {
  it('closes when pulled down far enough', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const el = screen.getByTestId('panel')
    touch(el, 'touchstart', 100, 100)
    touch(el, 'touchmove', 100, 160)
    expect(el.dataset.offset).toBe('60')
    touch(el, 'touchmove', 100, 260)
    touch(el, 'touchend', 0, 0)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('snaps back after a short slow pull', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const el = screen.getByTestId('panel')
    touch(el, 'touchstart', 100, 100)
    await new Promise(r => setTimeout(r, 200))
    touch(el, 'touchmove', 100, 130)
    touch(el, 'touchend', 0, 0)
    expect(onClose).not.toHaveBeenCalled()
    expect(el.dataset.offset).toBe('0')
  })

  it('ignores sideways swipes and pulls while the content is scrolled', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const el = screen.getByTestId('panel')
    touch(el, 'touchstart', 100, 100)
    touch(el, 'touchmove', 220, 130)
    touch(el, 'touchmove', 300, 300)
    touch(el, 'touchend', 0, 0)
    el.scrollTop = 50
    touch(el, 'touchstart', 100, 100)
    touch(el, 'touchmove', 100, 300)
    touch(el, 'touchend', 0, 0)
    expect(onClose).not.toHaveBeenCalled()
    expect(el.dataset.offset).toBe('0')
  })
})
