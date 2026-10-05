import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchVerb } from '../../api'
import type { VerbDto } from '../types'
import { BlocksIcon, BoneIcon, ClockIcon } from '../ui/icons'
import { availableGames, type GameId } from './availability'
import Bones from './Bones'
import Builder from './Builder'
import { schemeOf } from './formParts'
import TimeMachine from './TimeMachine'

const GAMES: Record<GameId, { title: string; Icon: (p: { size?: number }) => JSX.Element }> = {
  time: { title: 'Машина времени', Icon: ClockIcon },
  bones: { title: 'Косточки', Icon: BoneIcon },
  builder: { title: 'Конструктор', Icon: BlocksIcon }
}

/**
 * Ряд «Игры» в карточке глагола. Показывает только те игры, которые собираются из данных этого глагола;
 * если таких нет — не рисует ничего. Игра открывается на весь экран поверх карточки и по крестику возвращает в неё.
 */
export default function VerbGames({ verb }: { verb: VerbDto }) {
  const games = useMemo(() => availableGames(verb), [verb])
  const [open, setOpen] = useState<GameId | null>(null)
  const [extraPreverbs, setExtraPreverbs] = useState<string[]>([])

  // Конструктору нужна чужая приставка для ложного варианта. Берём её у глагола-образца из каталога;
  // не загрузился — в ряду останутся своя приставка и прочерк.
  useEffect(() => {
    if (open !== 'builder' || !verb.model) return
    let alive = true
    fetchVerb(verb.model.id)
      .then(model => {
        const preverb = model.status === 'verified' ? schemeOf(model)?.preverb : undefined
        if (alive && preverb) setExtraPreverbs([preverb])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [open, verb])

  if (!games.length) return null
  const exit = () => setOpen(null)

  return (
    <div data-testid="verb-games">
      <div className="mn-eyebrow text-jewelInk-mid mb-1.5">Игры с этим глаголом</div>
      <div className="flex gap-2">
        {games.map(id => {
          const { title, Icon } = GAMES[id]
          return (
            <button
              key={id}
              data-testid={`verb-game-${id}`}
              onClick={() => setOpen(id)}
              className="jewel-pressable flex-1 min-w-0 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk px-2 py-2 flex flex-col items-center gap-1"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              <Icon size={24} />
              <span className="text-[11px] font-bold leading-tight text-jewelInk text-center">{title}</span>
            </button>
          )
        })}
      </div>
      {open && createPortal(
        // Портал: шторка карточки сдвинута transform-ом, внутри неё fixed не занял бы весь экран.
        <div className="fixed inset-0 z-[60] bg-cream overflow-y-auto" data-testid="verb-game-screen">
          <div className="w-full max-w-[480px] mx-auto">
            {open === 'time' && <TimeMachine verb={verb} onExit={exit} />}
            {open === 'bones' && <Bones verb={verb} onExit={exit} />}
            {open === 'builder' && <Builder verb={verb} onExit={exit} extraPreverbs={extraPreverbs} />}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
