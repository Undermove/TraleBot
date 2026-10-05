import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from '../../components/Button'
import { fetchVerbStories } from '../../api'
import type { VerbDto } from '../types'
import { STEP, buildItems } from '../ladder/engine'
import type { VerbStoryDto } from '../story/types'
import LevelBadge from './LevelBadge'
import Session from './Session'
import { loadLearning } from './sync'
import type { VerbLearningDto } from './types'

// Вход в игру с вида глагола: уровень и одна кнопка. Что именно будет в сессии, человек не выбирает —
// её собирает постановщик (plan.ts). Показывается только у проверенных глаголов.

/** Подпись кнопки по состоянию: начать, продолжить начатую сессию, повторить, сдать экзамен. */
export function entryLabel(learning: VerbLearningDto): { text: string; quiet: boolean } {
  if (learning.session) return { text: 'Продолжить игру', quiet: false }
  if (learning.level === 'new') return { text: 'Выучить играя', quiet: false }
  const due = learning.progress.forms.filter(f => f.due).length
  if (learning.level === 'learned') return due ? { text: 'Повторить играя', quiet: false } : { text: 'Сыграть ещё', quiet: true }
  if (learning.level === 'examReady') return { text: 'Сыграть и сдать экзамен', quiet: false }
  return { text: due ? 'Повторить и играть дальше' : 'Играть дальше', quiet: false }
}

interface Loaded { learning: VerbLearningDto; stories: VerbStoryDto[] }

export default function SessionEntry({ verb }: { verb: VerbDto }) {
  const items = useMemo(() => buildItems(verb), [verb])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  // Формы непроверенного глагола составила нейросеть — по ним не учим и прогресс не спрашиваем.
  const unverified = verb.status === 'generated'

  function load() {
    return Promise.all([loadLearning(verb.id), fetchVerbStories(verb.id).then(r => r.stories).catch(() => [] as VerbStoryDto[])])
      .then(([learning, stories]) => ({ learning, stories }))
  }

  useEffect(() => {
    if (unverified) return
    let alive = true
    setLoaded(null); setFailed(false)
    load().then(l => { if (alive) setLoaded(l) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verb.id, unverified])

  if (unverified || failed || !items.length || (loaded && !loaded.learning.progress.canLearn)) return null
  // Пока состояние грузится, держим место под кнопку, чтобы таблица не прыгала под пальцем.
  if (!loaded) return <div className="h-[104px]" data-testid="session-entry-loading" />

  const { learning } = loaded
  const label = entryLabel(learning)
  const known = learning.progress.forms.filter(f => f.step > STEP.NEW).length
  return (
    <>
      <div data-testid="session-entry">
        <div className="mb-2 flex items-center justify-center gap-2 text-[12px] text-jewelInk-mid">
          <LevelBadge level={learning.level} />
          {known > 0 && <span data-testid="session-entry-known">· знакомо слов: {known} из {items.length}</span>}
        </div>
        <Button variant={label.quiet ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>{label.text}</Button>
        <div className="mt-1.5 text-center text-[12px] text-jewelInk-mid" data-testid="session-entry-about">
          2–3 минуты · игру подберу сам
        </div>
      </div>
      {open && createPortal(
        <Session
          verb={verb} stories={loaded.stories} learning={learning}
          onExit={latest => {
            setOpen(false)
            if (latest) setLoaded({ ...loaded, learning: latest })
            // Вышли посреди сессии или без связи — спросим сервер: кнопка должна знать про начатую сессию.
            else load().then(setLoaded).catch(() => {})
          }}
        />,
        document.body
      )}
    </>
  )
}
