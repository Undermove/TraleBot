import { useEffect, useRef, useState } from 'react'
import { keep, keptValue, setFocused } from './adminNav'

/** useState, значение которого переживает уход с экрана: вернулся во вкладку — фильтры, поиск и список на месте. */
export function useKept<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => keptValue(key, initial))
  return [value, (next: T) => { keep(key, next); setValue(next) }]
}

/** Пока экран открыт и условие верно — сфокусированный режим: нижняя панель вкладок спрятана. */
export function useFocusMode(on: boolean) {
  useEffect(() => {
    setFocused(on)
    return () => setFocused(false)
  }, [on])
}

const DRAFT = 'trale_admin_draft_'

/** Черновик незаконченного сценария — на этом устройстве, чтобы случайное закрытие его не стёрло. */
export const draft = {
  read<T>(name: string): T | null {
    try { const raw = localStorage.getItem(DRAFT + name); return raw ? (JSON.parse(raw) as T) : null } catch { return null }
  },
  write(name: string, value: unknown) { try { localStorage.setItem(DRAFT + name, JSON.stringify(value)) } catch {} },
  clear(name: string) { try { localStorage.removeItem(DRAFT + name) } catch {} }
}

/** Сохранять черновик при каждом изменении, пока save не null. */
export function useDraft(name: string, save: unknown | null) {
  const first = useRef(true)
  const json = save === null ? null : JSON.stringify(save)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (json !== null) draft.write(name, JSON.parse(json))
  }, [name, json])
}
