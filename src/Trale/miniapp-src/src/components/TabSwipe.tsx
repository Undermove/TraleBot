import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TABS, type HomeTab } from './HomeTabBar'
import { appEvents } from '../analytics/appEvents'
import type { Screen } from '../types'

// Вкладки листаются пальцем: экран едет за ним, соседний выезжает рядом, отпустил — доезжает или возвращается.
// Соседа монтируем на время жеста, и после перелистывания это тот же экземпляр: ничего не грузится второй раз.
// Двигаем только transform. Жест не начинается на том, что само листается вбок, на полях ввода,
// у самого края экрана (там жест системы) и при открытых шторках.

const ORDER: HomeTab[] = TABS.map(t => t.id)
let lastIndex = -1
const EASE = 'transform .26s cubic-bezier(.2,.8,.2,1)'

interface Props {
  tab: HomeTab
  navigate: (s: Screen) => void
  /** Нарисовать соседнюю вкладку, пока её тащат. */
  renderTab: (t: HomeTab) => React.ReactNode
  /** Шторка или клавиатура — не листать. */
  disabled?: boolean
  locked?: ReadonlySet<HomeTab>
  onLocked?: (s: Screen) => void
  children: React.ReactNode
}

function scrollsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches('input, textarea, [contenteditable], [data-no-swipe]')) return true
    const st = getComputedStyle(n)
    if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true
  }
  return false
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Gesture { x: number; y: number; t: number; ok: boolean; dragging: boolean; off: number; lastX: number; lastT: number; v: number; to: HomeTab | null }

export default function TabSwipe({ tab, navigate, renderTab, disabled, locked, onLocked, children }: Props) {
  const index = ORDER.indexOf(tab)
  const root = useRef<HTMLDivElement>(null)
  const cur = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLDivElement>(null)
  const g = useRef<Gesture | null>(null)
  const settling = useRef(false)
  const swiped = useRef(false)
  const [peek, setPeek] = useState<HomeTab | null>(null)

  // Откуда пришли — с той стороны въезжает новая вкладка при нажатии на панель. После свайпа она уже на месте.
  const enter = useRef<{ tab: HomeTab; dir: number } | null>(null)
  if (enter.current?.tab !== tab) {
    const from = lastIndex
    lastIndex = index
    enter.current = { tab, dir: swiped.current || from < 0 || from === index ? 0 : index > from ? 1 : -1 }
    swiped.current = false
  }

  function place(off: number, animated = false) {
    const W = window.innerWidth
    const transition = animated ? EASE : 'none'
    if (cur.current) { cur.current.style.transition = transition; cur.current.style.transform = `translate3d(${off}px,0,0)` }
    if (next.current) { next.current.style.transition = transition; next.current.style.transform = `translate3d(${off + (off < 0 ? W : -W)}px,0,0)` }
  }

  // Сосед появился уже в середине жеста — сразу на своё место.
  useLayoutEffect(() => { if (peek && g.current?.dragging) place(g.current.off) }, [peek])
  // Жест кончился: на экране не остаётся transform, и всё «fixed» внутри снова стоит как надо.
  useLayoutEffect(() => {
    if (peek || !cur.current) return
    cur.current.style.transform = ''
    cur.current.style.transition = ''
  }, [peek, tab])

  const live = useRef({ move: (_: TouchEvent) => {} })
  live.current.move = (e: TouchEvent) => {
    const s = g.current
    if (!s?.ok || settling.current) return
    const p = e.touches[0]
    const dx = p.clientX - s.x
    const dy = p.clientY - s.y
    if (!s.dragging) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) s.dragging = true
      else { if (Math.abs(dy) > 10) s.ok = false; return }
    }
    if (e.cancelable) e.preventDefault()
    const now = Date.now()
    if (now > s.lastT) s.v = (p.clientX - s.lastX) / (now - s.lastT)
    s.lastX = p.clientX
    s.lastT = now
    const to = ORDER[index + (dx < 0 ? 1 : -1)] ?? null
    if (to !== s.to) { s.to = to; setPeek(to && !locked?.has(to) ? to : null) }
    // За краем и перед закрытой вкладкой экран тянется туго.
    s.off = to && !locked?.has(to) ? dx : dx * 0.22
    place(s.off)
  }
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onMove = (e: TouchEvent) => live.current.move(e)
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    if (settling.current) return
    const p = e.touches[0]
    const edge = 18
    const now = Date.now()
    g.current = {
      x: p.clientX, y: p.clientY, t: now, lastX: p.clientX, lastT: now, v: 0, off: 0, dragging: false, to: null,
      ok: !disabled && e.touches.length === 1 && p.clientX > edge && p.clientX < window.innerWidth - edge && !scrollsSideways(e.target as Element)
    }
  }

  function go(to: HomeTab) {
    const target = TABS.find(t => t.id === to)!
    appEvents.tap(`swipe-${to}`)
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged() } catch {}
    if (locked?.has(to) && onLocked) { onLocked(target.screen); return false }
    swiped.current = true
    navigate(target.screen)
    return true
  }

  function settle(off: number, then: () => void) {
    if (reduced()) { then(); return }
    settling.current = true
    place(off, true)
    setTimeout(() => { settling.current = false; then() }, 270)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = g.current
    g.current = null
    if (!s?.ok) return
    const p = e.changedTouches[0]
    const dx = p.clientX - s.x
    if (!s.dragging) {
      // Быстрый взмах, между началом и концом которого не успело прийти ни одного движения.
      const dy = p.clientY - s.y
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 700) return
      const to = ORDER[index + (dx < 0 ? 1 : -1)]
      if (to && go(to)) swiped.current = false
      return
    }
    const W = window.innerWidth
    const flick = Math.abs(s.v) > 0.45 && Math.sign(s.v) === Math.sign(dx) && Math.abs(dx) > 24
    const far = Math.abs(dx) > W * 0.28
    const to = Math.sign(s.v || dx) === Math.sign(dx) || far ? s.to : null
    if (to && (flick || far)) {
      if (locked?.has(to)) { settle(0, () => { setPeek(null); go(to) }); return }
      settle(dx < 0 ? -W : W, () => { setPeek(null); go(to) })
      return
    }
    settle(0, () => setPeek(null))
  }

  function onTouchCancel() {
    const s = g.current
    g.current = null
    if (s?.dragging) settle(0, () => setPeek(null))
  }

  const dir = enter.current?.dir ?? 0
  const panes = peek && peek !== tab ? [tab, peek] : [tab]
  return (
    <div ref={root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}
      style={{ minHeight: '100dvh', touchAction: 'pan-y', overflowX: 'clip' }} data-testid="tab-swipe" data-peek={peek ?? undefined}>
      {panes.map(id => id === tab ? (
        <div key={id} ref={cur} className={dir > 0 ? 'tab-in-right' : dir < 0 ? 'tab-in-left' : undefined} style={{ minHeight: '100dvh' }}>
          {children}
        </div>
      ) : (
        <div key={id} ref={next} aria-hidden="true" data-testid="tab-swipe-next" className="bg-cream"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', overflow: 'hidden', zIndex: 1, pointerEvents: 'none', willChange: 'transform', transform: 'translate3d(100%,0,0)' }}>
          {renderTab(id)}
        </div>
      ))}
    </div>
  )
}
