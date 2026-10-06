import './juice.css'

// Отклик: вибрация (в Telegram — HapticFeedback, в браузере — vibrate) и конфетти без библиотек.

type Haptic = 'tap' | 'good' | 'bad'

export function haptic(kind: Haptic) {
  const tg = (window as any).Telegram?.WebApp?.HapticFeedback
  try {
    if (tg) {
      if (kind === 'tap') tg.impactOccurred('light')
      else tg.notificationOccurred(kind === 'good' ? 'success' : 'error')
    } else navigator.vibrate?.(kind === 'tap' ? 8 : kind === 'good' ? [12, 40, 18] : [30, 30, 30])
  } catch {}
}

const COLORS = ['#1B5FB0', '#E01A3C', '#F5B820', '#FCD76D', '#3A7FCC']

/** Конфетти из точки. size: 'small' — искорки на обычный верный ответ, 'big' — на веху. icon — SVG-разметка, которая летит вместе с конфетти. */
export function burst(at?: { x: number; y: number } | Element | null, size: 'small' | 'big' = 'small', icon?: string) {
  const box = at instanceof Element ? at.getBoundingClientRect() : null
  const x = box ? box.left + box.width / 2 : (at as any)?.x ?? window.innerWidth / 2
  const y = box ? box.top + box.height / 2 : (at as any)?.y ?? window.innerHeight * 0.35
  const count = size === 'big' ? 34 : 14
  const reach = size === 'big' ? 190 : 90
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const dist = reach * (0.5 + Math.random() * 0.7)
    el.className = 'j-piece'
    if (icon && i % 4 === 0) el.innerHTML = icon
    else {
      const s = 6 + Math.random() * 6
      Object.assign(el.style, { width: `${s}px`, height: `${s * (Math.random() > 0.5 ? 1 : 0.5)}px`, background: COLORS[i % COLORS.length], borderRadius: Math.random() > 0.5 ? '50%' : '2px' })
    }
    el.style.left = `${x}px`; el.style.top = `${y}px`
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    el.style.setProperty('--dy', `${Math.sin(angle) * dist + (size === 'big' ? 120 : 50)}px`)
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`)
    el.style.setProperty('--dur', `${650 + Math.random() * 500}ms`)
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1300)
  }
}

/** Всплывающая надпись («+1») или иконка над элементом. */
export function floater(content: string, at: Element | null, color = '#1B5FB0') {
  if (!at) return
  const box = at.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'j-floater'
  if (content.startsWith('<svg')) el.innerHTML = content; else el.textContent = content
  Object.assign(el.style, { left: `${box.left + box.width / 2 - 12}px`, top: `${box.top - 6}px`, color, fontSize: '22px' })
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 950)
}

export function good(at?: Element | null, size: 'small' | 'big' = 'small', icon?: string) {
  haptic('good'); burst(at ?? null, size, icon)
}
export const bad = () => haptic('bad')
