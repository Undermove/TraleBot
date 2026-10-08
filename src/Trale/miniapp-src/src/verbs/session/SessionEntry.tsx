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
import { isPrefixSession } from '../family/prefixPlan'

// Вход в игру с вида глагола: уровень и одна кнопка. Что именно будет в сессии, человек не выбирает —
// её собирает постановщик (plan.ts). Показывается только у проверенных глаголов.

/** Подпись кнопки по состоянию: начать, продолжить начатую сессию, повторить, сдать экзамен. */
export function entryLabel(learning: VerbLearningDto): { text: string; quiet: boolean } {
  if (learning.session) return { text: 'Продолжить игру', quiet: false }
  // Глагол из семьи при выученном основном: осталась только приставка.
  if (isPrefixSession(learning) && learning.level !== 'learned') return { text: 'Выучить приставку — 2 минуты', quiet: false }
  if (learning.level === 'new') return { text: 'Выучить играя', quiet: false }
  const due = learning.progress.forms.filter(f => f.due).length
  if (learning.level === 'learned') return due ? { text: 'Повторить играя', quiet: false } : { text: 'Сыграть ещё', quiet: true }
  if (learning.level === 'examReady') return { text: 'Сыграть и сдать экзамен', quiet: false }
  return { text: due ? 'Повторить и играть дальше' : 'Играть дальше', quiet: false }
}

interface Loaded { learning: VerbLearningDto; stories: VerbStoryDto[] }

interface Props {
  verb: VerbDto
  /** Открыть другой глагол в этой же карточке — основной глагол семьи. */
  onOpenVerb?: (verbId: string) => void
}

export default function SessionEntry({ verb, onOpenVerb }: Props) {
  const items = useMemo(() => buildItems(verb), [verb])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  function load() {
    return Promise.all([loadLearning(verb.id), fetchVerbStories(verb.id).then(r => r.stories).catch(() => [] as VerbStoryDto[])])
      .then(([learning, stories]) => ({ learning, stories }))
  }

  useEffect(() => {
    let alive = true
    setLoaded(null); setFailed(false)
    load().then(l => { if (alive) setLoaded(l) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verb.id])

  if (failed || !items.length || (loaded && !loaded.learning.progress.canLearn)) return null
  // Пока состояние грузится, держим место под кнопку, чтобы таблица не прыгала под пальцем.
  if (!loaded) return <div className="h-[104px]" data-testid="session-entry-loading" />

  const { learning } = loaded
  const label = entryLabel(learning)
  const known = learning.progress.forms.filter(f => f.step > STEP.NEW).length
  const family = learning.family
  const prefix = isPrefixSession(learning)
  // Тот же глагол, что основной, только с приставкой, а основной ещё не выучен: сначала — он.
  const baseFirst = !!family && family.role === 'member' && !family.baseLearned && learning.level !== 'learned' && !learning.session && !!onOpenVerb
  return (
    <>
      <div data-testid="session-entry" data-mode={baseFirst ? 'base-first' : prefix ? 'prefix' : 'full'}>
        {baseFirst ? (
          <>
            <Button onClick={() => onOpenVerb!(family!.baseId)}>
              <span data-testid="session-entry-base">Сначала «{family!.baseName}»</span>
            </Button>
            <div className="mt-2 text-center text-[12px] text-jewelInk-mid" data-testid="session-entry-about">
              Окончания здесь те же, что у «{family!.baseName}». Выучишь его — тут останется только приставка, на две минуты.
            </div>
            <button className="mt-1 w-full min-h-[44px] text-[12px] text-navy underline" data-testid="session-entry-alone" onClick={() => setOpen(true)}>
              {known > 0 ? 'Продолжить этот глагол отдельно' : 'Учить этот глагол отдельно'}
            </button>
          </>
        ) : (
          <>
            <Button variant={label.quiet ? 'ghost' : 'primary'} onClick={() => setOpen(true)}>{label.text}</Button>
            {/* Под кнопкой одна строка: у нового глагола — что будет, дальше — уровень. */}
            <div className="mt-2 flex items-center justify-center text-[12px] text-jewelInk-mid">
              {known > 0
                ? <LevelBadge level={learning.level} />
                : prefix
                  ? <span data-testid="session-entry-about">окончания ты уже знаешь по «{family!.baseName}» — спрошу только направление</span>
                  : <span data-testid="session-entry-about">2–3 минуты · игру подберу сам</span>}
            </div>
          </>
        )}
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
