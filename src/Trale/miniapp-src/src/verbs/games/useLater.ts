import { useEffect, useRef } from 'react'

/** setTimeout, который сам отменяется, когда игру закрыли: отложенный ход не должен сработать на закрытом экране. */
export function useLater(): (fn: () => void, ms: number) => void {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
}
