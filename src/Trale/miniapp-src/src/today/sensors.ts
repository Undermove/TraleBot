import { useEffect } from 'react'
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion'

// Датчики телефона для главной: наклон (сцена чуть сдвигается за телефоном — как игрушка в руке)
// В Telegram 9.0+ — его DeviceOrientation, иначе — события
// браузера (Android отдаёт их без спроса; iOS спрашивает разрешение — там не просим, просто без наклона).
// На компьютере наклон заменяет мышь.

const tg = () => (window as any).Telegram?.WebApp
const tgAtLeast = (v: string) => { try { return Boolean(tg()?.isVersionAtLeast?.(v)) } catch { return false } }
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/** Наклон телефона: x и y от −1 до 1, сглаженные пружиной. */
export function useTilt(enabled = true): { x: MotionValue<number>; y: MotionValue<number> } {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, { stiffness: 60, damping: 14 })
  const y = useSpring(rawY, { stiffness: 60, damping: 14 })

  useEffect(() => {
    if (!enabled) return
    let base: { beta: number; gamma: number } | null = null
    // Отсчёт от того, как человек держит телефон в первый момент, а не от «лёжа на столе».
    const apply = (beta: number, gamma: number) => {
      if (base == null) base = { beta, gamma }
      rawX.set(clamp((gamma - base.gamma) / 25))
      rawY.set(clamp((beta - base.beta) / 25))
    }
    const cleanups: (() => void)[] = []
    const app = tg()
    const sensor = tgAtLeast('9.0') ? app?.DeviceOrientation : null
    if (sensor?.start) {
      const onChange = () => {
        // Telegram отдаёт углы в радианах.
        const k = 180 / Math.PI
        if (sensor.beta != null && sensor.gamma != null) apply(sensor.beta * k, sensor.gamma * k)
      }
      try {
        sensor.start({ refresh_rate: 40 })
        app.onEvent('deviceOrientationChanged', onChange)
        cleanups.push(() => { try { app.offEvent('deviceOrientationChanged', onChange); sensor.stop() } catch {} })
      } catch {}
    } else {
      const onOrient = (e: DeviceOrientationEvent) => { if (e.beta != null && e.gamma != null) apply(e.beta, e.gamma) }
      window.addEventListener('deviceorientation', onOrient)
      cleanups.push(() => window.removeEventListener('deviceorientation', onOrient))
    }
    // Мышь — на компьютере; на телефоне указателя нет, событие не придёт.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      rawX.set(clamp((e.clientX / window.innerWidth) * 2 - 1))
      rawY.set(clamp((e.clientY / window.innerHeight) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    cleanups.push(() => window.removeEventListener('pointermove', onMove))
    return () => cleanups.forEach(c => c())
  }, [enabled])

  return { x, y }
}

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
