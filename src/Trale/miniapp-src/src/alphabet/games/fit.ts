import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Ряд плиток (буквы слова, ячейки, карточки) по ширине экрана: плитка = clamp(min, (ширина − зазоры) / n, max).
 * Не влезает даже по min — переносим на следующую строку (порядок чтения сохраняется: слева направо, потом ниже).
 * Ширину меряем у контейнера (ResizeObserver), так что ряд никогда не вылезает за экран.
 */
export function rowFit(width: number, n: number, min: number, max: number, gap: number): { size: number; perRow: number } {
  if (n <= 0 || width <= 0) return { size: max, perRow: Math.max(1, n) }
  const one = (width - gap * (n - 1)) / n
  if (one >= min) return { size: Math.min(max, Math.floor(one)), perRow: n }
  const perRow = Math.max(1, Math.floor((width + gap) / (min + gap)))
  const rows = Math.ceil(n / perRow)
  const even = Math.ceil(n / rows)
  return { size: Math.min(max, Math.floor((width - gap * (even - 1)) / even)), perRow: even }
}

export function useRowFit(ref: RefObject<HTMLElement>, n: number, min: number, max: number, gap: number) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  const fallback = typeof window !== 'undefined' ? Math.min(window.innerWidth - 40, 420) : 320
  return rowFit(w || fallback, n, min, max, gap)
}
