import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import LoaderLetter from '../../components/LoaderLetter'
import Button from '../../components/Button'
import { fetchVerb, fetchVerbStories } from '../../api'
import Session from '../session/Session'
import { loadLearning } from '../session/sync'
import type { VerbLearningDto } from '../session/types'
import type { VerbStoryDto } from '../story/types'
import type { VerbDto } from '../types'
import VerbSheet from '../VerbSheet'

interface Loaded { verb: VerbDto; learning: VerbLearningDto; stories: VerbStoryDto[] }

/**
 * Сессия глагола прямо из раздела, без захода в карточку: кнопка «Играть 2 минуты».
 * Грузит то же, что вход в игру на карточке (SessionEntry), и открывает ту же сессию.
 * finished — сессию доиграли и результат сохранён.
 */
export default function PlaySession({ verbId, onExit }: { verbId: string; onExit: (finished: boolean) => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([fetchVerb(verbId), loadLearning(verbId), fetchVerbStories(verbId).then(r => r.stories).catch(() => [] as VerbStoryDto[])])
      .then(([verb, learning, stories]) => { if (alive) setLoaded({ verb, learning, stories }) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [verbId])

  if (failed) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-cream flex flex-col items-center justify-center gap-4 px-8 text-center" data-testid="verbs-play-failed">
        <div className="text-[15px] text-jewelInk-mid">Не получилось открыть игру. Проверь связь и попробуй ещё раз.</div>
        <Button variant="ghost" onClick={() => onExit(false)}>Назад</Button>
      </div>,
      document.body
    )
  }
  if (!loaded) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-cream flex items-center justify-center" data-testid="verbs-play-loading"><LoaderLetter size={96} /></div>,
      document.body
    )
  }
  // Глагол, в который играть нельзя (нет форм для заданий), — показываем его карточку.
  if (!loaded.learning.progress.canLearn) return <VerbSheet verbId={verbId} onClose={() => onExit(false)} />

  return createPortal(
    <Session verb={loaded.verb} stories={loaded.stories} learning={loaded.learning} onExit={latest => onExit(latest !== null)} />,
    document.body
  )
}
