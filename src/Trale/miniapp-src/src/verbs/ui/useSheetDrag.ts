import { useEffect, useRef, useState, type RefObject } from 'react'

/** Сколько надо протянуть вниз, чтобы шторка закрылась (или быстрый рывок — см. FLICK). */
export const CLOSE_DISTANCE = 110
const FLICK_DISTANCE = 40
const FLICK_SPEED = 0.5 // px/ms
const SLOP = 6

/**
 * Смахнуть шторку вниз, как в Telegram: тянется пальцем, когда содержимое прокручено до верха,
 * и закрывается, если протянули далеко или дёрнули быстро; иначе возвращается на место.
 * Горизонтальные жесты (строка семьи, таблица) не перехватываются.
 * Слушатели нативные и не passive: иначе не отменить прокрутку, пока шторка едет за пальцем.
 */
export function useSheetDrag(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const el = panel.current
    if (!el) return
    let start: { x: number; y: number; t: number } | null = null
    let mode: 'undecided' | 'drag' | 'ignore' = 'ignore'
    let dy = 0

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || el.scrollTop > 0) { mode = 'ignore'; return }
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: performance.now() }
      mode = 'undecided'
      dy = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!start || mode === 'ignore') return
      const t = e.touches[0]
      const ddy = t.clientY - start.y
      const ddx = t.clientX - start.x
      if (mode === 'undecided') {
        if (Math.abs(ddy) < SLOP && Math.abs(ddx) < SLOP) return
        mode = ddy > 0 && Math.abs(ddy) > Math.abs(ddx) && el.scrollTop <= 0 ? 'drag' : 'ignore'
        if (mode === 'ignore') return
        setDragging(true)
      }
      if (e.cancelable) e.preventDefault()
      dy = Math.max(0, ddy)
      setOffset(dy)
    }
    const onEnd = () => {
      if (mode !== 'drag' || !start) { mode = 'ignore'; return }
      const speed = dy / Math.max(1, performance.now() - start.t)
      mode = 'ignore'
      start = null
      setDragging(false)
      if (dy > CLOSE_DISTANCE || (dy > FLICK_DISTANCE && speed > FLICK_SPEED)) close.current()
      else setOffset(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [panel])

  return { offset, dragging }
}
