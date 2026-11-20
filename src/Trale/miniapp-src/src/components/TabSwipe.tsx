import React, { useRef } from 'react'
import { TABS, type HomeTab } from './HomeTabBar'
import { appEvents } from '../analytics/appEvents'
import type { Screen } from '../types'

// Вкладки листаются свайпом: смахнул влево — следующая, вправо — предыдущая. Новая вкладка въезжает с той
// стороны, куда листали (и при нажатии на панель — тоже). Свайп не срабатывает, если палец начал на том, что само
// листается вбок (карусели, широкие таблицы), на полях ввода, у самого края экрана (там жест системы) и при открытых шторках.

const ORDER: HomeTab[] = TABS.map(t => t.id)
let lastIndex = -1

interface Props {
  tab: HomeTab
  navigate: (s: Screen) => void
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

export default function TabSwipe({ tab, navigate, disabled, locked, onLocked, children }: Props) {
  const index = ORDER.indexOf(tab)
  const from = lastIndex
  lastIndex = index
  const dir = from < 0 || from === index ? 0 : index > from ? 1 : -1
  const start = useRef<{ x: number; y: number; t: number; ok: boolean } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    const p = e.touches[0]
    const edge = 18
    start.current = {
      x: p.clientX, y: p.clientY, t: Date.now(),
      ok: !disabled && e.touches.length === 1 && p.clientX > edge && p.clientX < window.innerWidth - edge && !scrollsSideways(e.target as Element)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current
    start.current = null
    if (!s?.ok) return
    const p = e.changedTouches[0]
    const dx = p.clientX - s.x
    const dy = p.clientY - s.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 700) return
    const to = ORDER[index + (dx < 0 ? 1 : -1)]
    if (!to) return
    const target = TABS.find(t => t.id === to)!
    appEvents.tap(`swipe-${to}`)
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged() } catch {}
    if (locked?.has(to) && onLocked) onLocked(target.screen)
    else navigate(target.screen)
  }

  // Въезд — CSS-анимацией: после неё на блоке не остаётся transform, и всё «fixed» внутри стоит как надо.
  return (
    <div
      key={tab}
      className={dir > 0 ? 'tab-in-right' : dir < 0 ? 'tab-in-left' : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ minHeight: '100dvh' }}
      data-testid="tab-swipe"
    >
      {children}
    </div>
  )
}
