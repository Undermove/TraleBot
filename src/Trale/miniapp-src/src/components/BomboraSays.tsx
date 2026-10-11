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

// Имя пишем крупно, длинное — мельче: оно может перенестись на вторую строку, но не обрезается.
function nameFontSize(geo: string): string {
  if (geo.length <= 10) return '18px'
  if (geo.length <= 16) return '16px'
  return '14px'
}

// В имени транскрипция без апострофов («димитри») — так его проще прочитать вслух.
const nameCyr = (geo: string) => cyr(geo).replace(/’/g, '')

/**
 * Бомбора в первом блоке профиля говорит одно из трёх: подбадривает, называет фразу дня
 * или имя человека по-грузински. Что сказать при открытии, решает pickOpening; нажатие листает
 * реплики по кругу, так что фраза и имя доступны всегда.
 * Все реплики лежат в одной ячейке сетки, видна одна: высота блока не меняется при смене.
 * Блок плотный: точки-указатель — в углу облачка, подсказка «нажми» — под Бомборой.
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

  const lead = 'font-sans text-[11px] font-bold text-jewelInk-mid leading-tight pr-9'
  const small = 'font-sans text-[11px] leading-tight'
  const replies: Record<SayKind, React.ReactNode> = {
    cheer: (
      <>
        <div className="mn-eyebrow !text-[10px] leading-tight pr-9">გამარჯობა</div>
        <div className="font-sans text-[14px] font-extrabold text-jewelInk leading-tight mt-0.5">{encouragement}</div>
      </>
    ),
    phrase: (
      <>
        <div className={lead}>Фраза на сегодня:</div>
        <div className="font-geo text-[18px] font-extrabold text-jewelInk leading-tight">{phrase.ge}</div>
        <div className={`${small} text-jewelInk-hint`}>{cyr(phrase.ge)}</div>
        <div className="font-sans text-[13px] font-bold text-jewelInk leading-tight mt-0.5">{phrase.ru}</div>
        {phrase.hint && <div className={`${small} text-jewelInk-mid`}>{withCyr(phrase.hint)}</div>}
      </>
    ),
    name: name && (
      <>
        <div className={lead}>Кстати, по-грузински ты —</div>
        <div
          className="font-geo font-extrabold text-jewelInk leading-tight"
          style={{ fontSize: nameFontSize(name.geo) }}
        >
          {name.geo}
        </div>
        <div className={`${small} text-jewelInk-hint`}>{nameCyr(name.geo)}</div>
        <div className={`${small} text-jewelInk-mid mt-0.5`}>
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
      className="relative z-[1] w-full text-left flex items-center gap-2.5"
    >
      <div className="shrink-0 w-[58px] flex flex-col items-center">
        <Mascot mood={mood} size={56} />
        <span className="font-sans text-[10px] text-jewelInk-hint leading-[1.15] text-center">
          нажми —<br />скажу ещё
        </span>
      </div>
      <div className={`flex-1 min-w-0 ${cornerBadge ? 'pt-7' : ''}`}>
        <div
          aria-live="polite"
          className="relative grid bg-white border-[1.5px] border-jewelInk rounded-xl px-2.5 py-1.5"
        >
          <span
            aria-hidden
            className="absolute -left-[6px] top-1/2 -mt-[5px] w-[10px] h-[10px] rotate-45 bg-white border-l-[1.5px] border-b-[1.5px] border-jewelInk"
          />
          <span className="absolute top-[9px] right-2.5 flex items-center gap-1" aria-hidden>
            {cycle.map((k) => (
              <span
                key={k}
                className={`w-[6px] h-[6px] rounded-full border border-jewelInk ${k === kind ? 'bg-jewelInk' : ''}`}
              />
            ))}
          </span>
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
      </div>
    </button>
  )
}
