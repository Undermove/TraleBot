// Вибрация и «меньше движения» для главной. Датчик наклона больше не используем — он ест батарею.

const tg = () => (window as any).Telegram?.WebApp

/** Вибрация в Telegram (или в браузере). */
export const buzz = {
  tick: () => { try { const h = tg()?.HapticFeedback; h ? h.selectionChanged() : navigator.vibrate?.(5) } catch {} },
  soft: () => { try { const h = tg()?.HapticFeedback; h ? h.impactOccurred('soft') : navigator.vibrate?.(8) } catch {} },
  light: () => { try { const h = tg()?.HapticFeedback; h ? h.impactOccurred('light') : navigator.vibrate?.(10) } catch {} },
  heavy: () => { try { const h = tg()?.HapticFeedback; h ? h.impactOccurred('heavy') : navigator.vibrate?.(25) } catch {} },
  rigid: () => { try { const h = tg()?.HapticFeedback; h ? h.impactOccurred('rigid') : navigator.vibrate?.(15) } catch {} },
  success: () => { try { const h = tg()?.HapticFeedback; h ? h.notificationOccurred('success') : navigator.vibrate?.([12, 40, 18]) } catch {} }
}

export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
