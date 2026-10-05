import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from '../../components/Button'
import type { VerbDto } from '../types'
import { STEP, buildItems, type LadderItem, type Progress } from './engine'
import { loadProgress, type LoadedProgress } from './progressStore'
import Ladder from './Ladder'

// Вход в «лесенку» с карточки глагола: одна главная кнопка, которая помнит, где человек остановился.
// Показывается только у проверенных глаголов; игра открывается на весь экран поверх карточки.

const forms = (n: number) => {
  const d = n % 10, h = n % 100
  return d === 1 && h !== 11 ? 'форму' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'формы' : 'форм'
}

/** Подпись кнопки по прогрессу: начать, продолжить, повторить. */
export function entryLabel(items: LadderItem[], progress: Progress): { text: string; quiet: boolean } {
  const step = (i: LadderItem) => progress[i.key]?.step ?? STEP.NEW
  if (!items.some(i => step(i) > STEP.NEW)) return { text: 'Выучить играя', quiet: false }
  const due = items.filter(i => step(i) >= STEP.MASTERED && progress[i.key].due).length
  if (items.every(i => step(i) >= STEP.MASTERED)) {
    return due
      ? { text: `Повторить · ${due} ${forms(due)}`, quiet: false }
      : { text: `Выучено · ${items.length} из ${items.length}`, quiet: true }
  }
  // Считаем по лучшей ступени: число выученных на кнопке не уменьшается.
  const learned = items.filter(i => (progress[i.key]?.best ?? 0) >= STEP.MASTERED).length
  return { text: `Продолжить · ${learned} из ${items.length}`, quiet: false }
}

export default function LadderEntry({ verb }: { verb: VerbDto }) {
  const items = useMemo(() => buildItems(verb), [verb])
  const [loaded, setLoaded] = useState<LoadedProgress | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  // Формы непроверенного глагола составила нейросеть — по ним не учим и прогресс не спрашиваем.
  const unverified = verb.status === 'generated'

  useEffect(() => {
    if (unverified) return
    let alive = true
    setLoaded(null); setFailed(false)
    loadProgress(verb.id).then(p => { if (alive) setLoaded(p) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [verb.id, unverified])

  if (unverified || failed || !items.length || (loaded && !loaded.canLearn)) return null
  // Пока прогресс грузится, держим место под кнопку, чтобы таблица не прыгала под пальцем.
  if (!loaded) return <div className="h-14" data-testid="ladder-entry-loading" />

  const label = entryLabel(items, loaded.progress)
  return (
    <>
      <Button variant={label.quiet ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>{label.text}</Button>
      {open && createPortal(
        <Ladder
          verb={verb}
          initial={loaded.progress}
          onExit={progress => { setLoaded({ canLearn: true, progress }); setOpen(false) }}
        />,
        document.body
      )}
    </>
  )
}
