import React, { useState } from 'react'
import Mascot from '../../components/Mascot'
import Button from '../../components/Button'
import { CloseIcon, PointIcon } from './icons'
import { OVERLAY, useOverlay } from './overlayStack'

// Общая оболочка игр с глаголами: шапка с крестиком и счётом, правила при первом входе
// (шторка с Бомборой, потом под кнопкой «?»), подсказка и подсветка первого хода.

/** Ключ отметки «уже видел» в localStorage. */
export const seenKey = (id: string) => `verb_game_seen_${id}`
const wasSeen = (id: string) => { try { return !!localStorage.getItem(seenKey(id)) } catch { return true } }
// Хранилище может быть недоступно (приватный режим, квота): подсказка тогда просто покажется ещё раз.
const markSeen = (id: string) => { try { localStorage.setItem(seenKey(id), '1') } catch {} }

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

export function GameShell({ id, title, onExit, right, help, children }: {
  id: string; title: string; onExit: () => void; right?: React.ReactNode; help: string[]; children: React.ReactNode
}) {
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
export function OptionButton({ children, onClick, tone = '', geo = true }: {
  children: React.ReactNode; onClick: () => void; tone?: string; geo?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-[1.5px] border-jewelInk px-4 py-3 text-[17px] font-bold ${geo ? 'font-geo' : ''} ${tone || 'bg-cream-tile'}`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {children}
    </button>
  )
}
