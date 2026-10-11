import React, { useEffect, useMemo, useState } from 'react'
import Mascot from './Mascot'
import { transliterateToGeorgian } from '../utils/georgianizerName'
import { cyr } from '../verbs/types'
import {
  SayKind,
  dayKey,
  loadSaysMemory,
  markSaid,
  nextSay,
  phraseOfDay,
  pickOpening,
  saveSaysMemory,
  sayCycle,
} from '../bomboraSays'

interface Props {
  /** Обычное подбадривание — то, что Бомбора говорила в профиле всегда. */
  encouragement: string
  cheerMood: 'happy' | 'cheer'
  /** Имя из Telegram; без него реплики про имя нет. */
  firstName?: string
  alphabetDone: boolean
  /** PRO-ярлык занимает правый верхний угол плитки — облачко отступает вниз. */
  cornerBadge?: boolean
}

// Грузинское слово внутри русской подсказки — сразу с кириллицей в скобках.
const withCyr = (text: string) => text.replace(/[ა-ჿ]+/g, (word) => `${word} (${cyr(word)})`)

function nameFontSize(geo: string): string {
  if (geo.length <= 8) return '24px'
  if (geo.length <= 12) return '20px'
  return '17px'
}

/**
 * Бомбора в первом блоке профиля говорит одно из трёх: подбадривает, называет фразу дня
 * или имя человека по-грузински. Что сказать при открытии, решает pickOpening; нажатие листает
 * реплики по кругу, так что фраза и имя доступны всегда.
 * Все реплики лежат в одной ячейке сетки, видна одна: высота блока не меняется при смене.
 */
export default function BomboraSays({ encouragement, cheerMood, firstName, alphabetDone, cornerBadge = false }: Props) {
  const today = useMemo(() => dayKey(new Date()), [])
  const name = useMemo(() => (firstName ? transliterateToGeorgian(firstName) : null), [firstName])
  const hasName = name !== null
  const phrase = phraseOfDay(today)

  // Решается один раз за открытие профиля — перерисовки реплику не меняют.
  const [kind, setKind] = useState<SayKind>(() => {
    const { memory, remembered } = loadSaysMemory()
    return pickOpening(memory, today, hasName, remembered)
  })

  useEffect(() => {
    if (kind === 'cheer') return
    saveSaysMemory(markSaid(loadSaysMemory().memory, kind, today))
  }, [kind, today])

  function sayNext() {
    try {
      ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
    } catch {}
    setKind((k) => nextSay(k, hasName))
  }

  const mood = kind === 'cheer' ? cheerMood : kind === 'name' && alphabetDone ? 'cheer' : 'guide'
  const cycle = sayCycle(hasName)

  const replies: Record<SayKind, React.ReactNode> = {
    cheer: (
      <>
        <div className="mn-eyebrow mb-1">გამარჯობა</div>
        <div className="font-sans text-[16px] font-extrabold text-jewelInk leading-tight">{encouragement}</div>
      </>
    ),
    phrase: (
      <>
        <div className="font-sans text-[12px] font-bold text-jewelInk-mid">Фраза на сегодня:</div>
        <div className="font-geo text-[20px] font-extrabold text-jewelInk leading-tight mt-0.5">{phrase.ge}</div>
        <div className="font-sans text-[12px] text-jewelInk-hint leading-tight mt-0.5">{cyr(phrase.ge)}</div>
        <div className="font-sans text-[14px] font-bold text-jewelInk leading-tight mt-1.5">{phrase.ru}</div>
        {phrase.hint && (
          <div className="font-sans text-[11px] text-jewelInk-mid leading-snug mt-0.5">{withCyr(phrase.hint)}</div>
        )}
      </>
    ),
    name: name && (
      <>
        <div className="font-sans text-[12px] font-bold text-jewelInk-mid">Кстати, по-грузински ты —</div>
        <div
          className="font-geo font-extrabold text-jewelInk leading-tight mt-0.5"
          style={{ fontSize: nameFontSize(name.geo) }}
        >
          {name.geo}
        </div>
        <div className="font-sans text-[12px] text-jewelInk-hint leading-tight mt-0.5">{cyr(name.geo)}</div>
        <div className="font-sans text-[11px] text-jewelInk-mid leading-snug mt-1.5">
          {alphabetDone ? 'Ты уже читаешь это без подсказки.' : 'Выучи алфавит — прочитаешь без подсказки.'}
        </div>
      </>
    ),
  }

  return (
    <button
      type="button"
      onClick={sayNext}
      data-testid="bombora-says"
      data-say={kind}
      className="relative z-[1] w-full text-left flex items-center gap-3"
    >
      <div className="shrink-0">
        <Mascot mood={mood} size={80} />
      </div>
      <div className={`flex-1 min-w-0 ${cornerBadge ? 'pt-5' : ''}`}>
        <div
          aria-live="polite"
          className="relative grid bg-white border-[1.5px] border-jewelInk rounded-xl px-3 py-2.5"
        >
          <span
            aria-hidden
            className="absolute -left-[6px] top-1/2 -mt-[5px] w-[10px] h-[10px] rotate-45 bg-white border-l-[1.5px] border-b-[1.5px] border-jewelInk"
          />
          {cycle.map((k) => (
            <div
              key={k}
              data-testid={`bombora-says-${k}`}
              aria-hidden={k !== kind}
              className={`min-w-0 flex flex-col justify-center [overflow-wrap:anywhere] ${k === kind ? 'anim-fade' : 'invisible'}`}
              style={{ gridArea: '1 / 1' }}
            >
              {replies[k]}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 pl-1">
          <span className="flex items-center gap-1" aria-hidden>
            {cycle.map((k) => (
              <span
                key={k}
                className={`w-[6px] h-[6px] rounded-full border border-jewelInk ${k === kind ? 'bg-jewelInk' : ''}`}
              />
            ))}
          </span>
          <span className="font-sans text-[11px] text-jewelInk-hint">нажми — скажу ещё</span>
        </div>
      </div>
    </button>
  )
}
