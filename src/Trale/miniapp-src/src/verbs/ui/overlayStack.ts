import { useEffect, useRef, useSyncExternalStore } from 'react'

// Стопка открытых слоёв поверх экрана: карточка глагола, игра на весь экран, шторка с правилами.
// Кнопка «Назад» в Telegram сначала спрашивает стопку: если что-то открыто, закрывается верхний слой,
// а экран под ним остаётся на месте (см. App.tsx).

/** Чем больше уровень, тем выше слой: правила лежат поверх игры, игра — поверх карточки. */
export const OVERLAY = { sheet: 1, screen: 2, help: 3 } as const

interface Entry { close: () => void; level: number }

const stack: Entry[] = []
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(l => l())

/** Зарегистрировать открытый слой. Возвращает функцию, которой слой снимает себя при закрытии. */
export function pushOverlay(close: () => void, level: number = OVERLAY.sheet): () => void {
  const entry = { close, level }
  stack.push(entry)
  changed()
  return () => {
    const at = stack.indexOf(entry)
    if (at < 0) return
    stack.splice(at, 1)
    changed()
  }
}

export const hasOverlay = () => stack.length > 0

/** Закрыть верхний слой. false — закрывать нечего, «Назад» должен увести с экрана. */
export function closeTopOverlay(): boolean {
  // Верхний — с наибольшим уровнем, а среди равных — открытый последним.
  let top: Entry | null = null
  for (const entry of stack) if (!top || entry.level >= top.level) top = entry
  if (!top) return false
  top.close()
  return true
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Слой открыт, пока компонент на экране (и пока active). close — то же, что делает его крестик. */
export function useOverlay(close: () => void, level: number = OVERLAY.sheet, active = true) {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!active) return
    return pushOverlay(() => latest.current(), level)
  }, [active, level])
}

/** Открыт ли хоть один слой — чтобы показать кнопку «Назад» там, где экран сам её не показывает. */
export const useHasOverlay = () => useSyncExternalStore(subscribe, hasOverlay, hasOverlay)
