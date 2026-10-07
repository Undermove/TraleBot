import React, { createContext, useContext, useState } from 'react'
import Mascot from '../../components/Mascot'
import Button from '../../components/Button'
import { CloseIcon, PointIcon } from './icons'
import { OVERLAY, useOverlay } from './overlayStack'
import { hintSeen, markHintSeen } from './hints'
import { cyr } from '../types'

// Общая оболочка игр с глаголами: шапка с крестиком и счётом, правила при первом входе
// (шторка с Бомборой, потом под кнопкой «?»), подсказка и подсветка первого хода.

/** Имя отметки «уже видел» (на сервере — `ui:verb_game_seen_<id>`, см. hints.ts). */
export const seenKey = (id: string) => `verb_game_seen_${id}`
const wasSeen = (id: string) => hintSeen(seenKey(id))
const markSeen = (id: string) => markHintSeen(seenKey(id))

/** true, пока игрок не сделал первый удачный ход в этой игре: показываем подсказки и подсветку. */
export function useFirstTime(id: string): [boolean, () => void] {
  const [first, setFirst] = useState(() => !wasSeen(id + '_move'))
  return [first, () => { markSeen(id + '_move'); setFirst(false) }]
}

/** Реплика Бомборы с подсказкой, что делать прямо сейчас. */
export function Coach({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-3 py-2 text-[13px] font-bold">
      <PointIcon size={20} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** Класс для элемента, на который надо нажать первым. */
export const PULSE = 'ring-4 ring-gold animate-pulse'

/** Кнопка «?» и шторка с правилами. При первом входе шторка открывается сама. */
export function HelpButton({ id, help }: { id: string; help: string[] }) {
  const [step, setStep] = useState<number | null>(() => (wasSeen(id) ? null : 0))
  const close = () => { markSeen(id); setStep(null) }
  useOverlay(close, OVERLAY.help, step !== null)
  return (
    <>
      <button
        onClick={() => setStep(0)}
        aria-label="Как играть"
        className="w-8 h-8 shrink-0 rounded-full border-[1.5px] border-jewelInk bg-cream-tile text-[15px] font-extrabold"
      >?</button>
      {step !== null && (
        // Выше карточки глагола (z-60) и игр на весь экран: правила не должны оказаться под ними.
        <div className="fixed inset-0 z-[70] bg-jewelInk/50 flex items-end justify-center" onClick={close}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-cream border-t-[1.5px] border-x-[1.5px] border-jewelInk p-5 pb-7"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <Mascot mood="guide" size={84} className="shrink-0" />
              <div className="flex-1">
                <div className="mn-eyebrow text-navy">Как играть · {step + 1} из {help.length}</div>
                <div className="mt-1 text-[16px] font-bold leading-snug">{help[step]}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Назад</Button>}
              {step < help.length - 1
                ? <Button onClick={() => setStep(step + 1)}>Дальше</Button>
                : <Button onClick={close}>Играть</Button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Отступ шапки: в полноэкранном мини-аппе сверху лежат кнопки Telegram и вырез экрана. */
export const SAFE_TOP = 'calc(var(--safe-t, 0px) + 16px)'

/**
 * Сцена идёт внутри сессии: шапку рисует сессия — крестик и полоска этой сессии.
 * Полоска растёт после каждого ответа и назад не идёт; счёта «выучено из N» в ней нет.
 */
export interface SessionChromeValue {
  /** Пройденная часть сессии, 0..1. */
  fraction: number
  onExit: () => void
}
export const SessionChrome = createContext<SessionChromeValue | null>(null)

/** Что сцена сообщает сессии. Один и тот же набор у квиза, игр и комикса. */
export interface SceneHooks {
  /** С какого шага начать: сессию продолжают после перезагрузки. */
  startAt: number
  /**
   * Ответ по клетке таблицы. ceiling — до какой ступени такой ответ может поднять форму;
   * introduceNew — сцена показывает форму впервые (знакомство, комикс).
   */
  onResult: (cell: { tense: string; person: number }, ok: boolean, ceiling: number, introduceNew?: boolean) => void
  /** Задание пройдено — шаг полоски. */
  onStep: () => void
  onDone: () => void
}

export function SessionHeader({ id, help }: { id?: string; help?: string[] }) {
  const chrome = useContext(SessionChrome)
  if (!chrome) return null
  const percent = Math.round(Math.max(0, Math.min(1, chrome.fraction)) * 100)
  return (
    <div className="px-5 pb-2 flex items-center gap-3" style={{ paddingTop: SAFE_TOP }}>
      <button onClick={chrome.onExit} aria-label="Закрыть" className="w-11 h-11 -ml-2 flex items-center justify-center"><CloseIcon size={20} /></button>
      <div className="flex-1 h-3 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
        <div
          data-testid="session-bar" data-percent={percent}
          className="h-full bg-navy transition-all duration-500 ease-out"
          // Пустая полоска не видна вовсе — оставляем каплю, чтобы было понятно, что это полоска.
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
      {id && help && <HelpButton id={id} help={help} />}
    </div>
  )
}

export function GameShell({ id, title, onExit, right, help, children }: {
  id: string; title: string; onExit: () => void; right?: React.ReactNode; help: string[]; children: React.ReactNode
}) {
  const inSession = useContext(SessionChrome) !== null
  if (inSession) {
    return (
      <div className="j-root flex flex-col min-h-[100dvh]">
        <SessionHeader id={id} help={help} />
        <div className="px-5 -mt-1 pb-1 text-center text-[12px] font-bold text-jewelInk-hint">{title}</div>
        {children}
      </div>
    )
  }
  return (
    <div className="j-root flex flex-col min-h-[100dvh]">
      <div className="px-5 pb-2 flex items-center gap-3" style={{ paddingTop: SAFE_TOP }}>
        <button onClick={onExit} aria-label="Закрыть" className="w-9 h-9 flex items-center justify-center"><CloseIcon size={20} /></button>
        <div className="flex-1 text-[15px] font-extrabold">{title}</div>
        <div className="text-[13px] font-bold text-jewelInk-mid tabular-nums">{right}</div>
        <HelpButton id={id} help={help} />
      </div>
      {children}
    </div>
  )
}
/**
 * Вариант ответа. Грузинское слово (geo и просто строка) показывается с кириллической транскрипцией
 * под ним — так же, как в заданиях-квизах: играть можно, ещё не зная букв.
 */
export function OptionButton({ children, onClick, tone = '', geo = true }: {
  children: React.ReactNode; onClick: () => void; tone?: string; geo?: boolean
}) {
  const word = geo && typeof children === 'string' ? children : null
  return (
    <button
      onClick={onClick}
      aria-label={word ?? undefined}
      className={`min-w-0 rounded-xl border-[1.5px] border-jewelInk px-3 py-2.5 text-[17px] font-bold leading-tight ${geo ? 'font-geo' : ''} ${tone || 'bg-cream-tile'}`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {word ? (
        <>
          {/* Длинное слово не переносим посреди слова — уменьшаем, чтобы оно читалось одной строкой. */}
          <span className={`block break-words ${word.length > 12 ? 'text-[13px]' : word.length > 9 ? 'text-[15px]' : ''}`}>{word}</span>
          <span className="block font-sans text-[12px] font-semibold text-jewelInk-hint break-words" data-testid="option-cyr">{cyr(word)}</span>
        </>
      ) : children}
    </button>
  )
}
