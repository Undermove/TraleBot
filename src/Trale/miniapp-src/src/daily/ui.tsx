import React from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { CloseIcon } from '../verbs/ui/icons'
import { SAFE_TOP } from '../verbs/ui/GameShell'
import { OVERLAY, useOverlay } from '../verbs/ui/overlayStack'
import { cyr } from '../verbs/types'
import { boldParts } from './logic'
import '../verbs/ui/juice.css'

// Общие части экранов «Задания дня»: шапка с шагами, реплика Бомборы, грузинское слово с транскрипцией.

/** Экран занятия: всё помещается без прокрутки, кнопки внизу — над безопасной зоной. */
export function Page({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <div
      className="j-root flex flex-col min-h-[100dvh] bg-cream text-jewelInk" data-testid={testId}
      style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 16px)' }}
    >
      {children}
    </div>
  )
}

/** Шапка: крестик и полоска из шагов занятия (или подпись, когда шагов ещё нет). */
/** Подарок в конце полоски: «дойдёшь — откроешь». Цвет — обычной коробки. */
function GiftAtEnd({ near }: { near: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" className={`shrink-0 ${near ? 'animate-bounce' : ''}`} data-testid="daily-steps-gift">
      <rect x="6" y="16" width="28" height="20" rx="3" fill="#1B5FB0" stroke="#15100A" strokeWidth="2.500" />
      <rect x="4" y="11" width="32" height="7" rx="2" fill="#3A7FCC" stroke="#15100A" strokeWidth="2.500" />
      <rect x="17" y="11" width="6" height="25" fill="#E01A3C" stroke="#15100A" strokeWidth="2" />
      <path d="M20 11 C 14 2, 6 6, 11 11 M20 11 C 26 2, 34 6, 29 11" stroke="#15100A" strokeWidth="2.500" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function DailyHeader({ steps, at, label, onExit, gift = false }: { steps?: number; at?: number; label?: string; onExit: () => void; gift?: boolean }) {
  return (
    <div className="px-5 pb-2 flex items-center gap-3" style={{ paddingTop: SAFE_TOP }}>
      <button onClick={onExit} aria-label="Закрыть" data-testid="daily-close" className="w-11 h-11 -ml-2 shrink-0 flex items-center justify-center">
        <CloseIcon size={20} />
      </button>
      {steps ? (
        <>
          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }} data-testid="daily-steps" data-at={at} data-steps={steps}>
            {Array.from({ length: steps }, (_, i) => (
              <div key={i} className={`h-2.5 rounded-full border border-jewelInk/30 transition-colors duration-300 ${i < (at ?? 0) ? 'bg-navy' : 'bg-cream-deep'}`} />
            ))}
          </div>
          {gift ? <GiftAtEnd near={(at ?? 0) >= steps} /> : <div className="shrink-0 text-[12px] font-bold text-jewelInk-hint tabular-nums">{at} из {steps}</div>}
        </>
      ) : (
        <div className="flex-1 min-w-0 mn-eyebrow truncate">{label}</div>
      )}
    </div>
  )
}

/** Заголовок шага: надпись над ним и сам заголовок. */
export function StepTitle({ eyebrow, children, right }: { eyebrow?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="px-5 flex items-end gap-3">
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="mn-eyebrow text-navy">{eyebrow}</div>}
        <h2 className="mt-0.5 font-sans text-[21px] font-extrabold leading-tight tracking-tight">{children}</h2>
      </div>
      {right}
    </div>
  )
}

/** Реплика Бомборы: что делать сейчас или что получилось. */
export function Say({ mood = 'happy', size = 72, children, testId }: {
  mood?: 'happy' | 'cheer' | 'think' | 'guide'; size?: number; children: React.ReactNode; testId?: string
}) {
  return (
    <div className="px-5 flex items-center gap-2.5">
      <Mascot mood={mood} size={size} className="shrink-0" />
      <div
        className="flex-1 min-w-0 rounded-2xl rounded-bl-md bg-cream-tile border-[1.5px] border-jewelInk px-3.5 py-2.5 text-[14px] font-semibold leading-snug"
        data-testid={testId} aria-live="polite"
      >
        {children}
      </div>
    </div>
  )
}

/** Грузинское слово и под ним — как оно читается, кириллицей. */
export function Geo({ ka, className = 'text-[18px]', cyrClassName = 'text-[11px]' }: { ka: string; className?: string; cyrClassName?: string }) {
  return (
    <>
      <span className={`block font-geo font-bold leading-tight break-words ${className}`}>{ka}</span>
      <span className={`block font-sans font-semibold leading-tight text-jewelInk-hint break-words ${cyrClassName}`} data-testid="daily-cyr">{cyr(ka)}</span>
    </>
  )
}

/** Строка с выделением <b>…</b> — без вставки разметки в страницу. */
export function Rich({ line }: { line: string }) {
  return <>{boldParts(line).map((p, i) => (p.bold ? <b key={i} className="font-extrabold text-jewelInk">{p.text}</b> : <React.Fragment key={i}>{p.text}</React.Fragment>))}</>
}

/** Шторка снизу: «Почему так». Закрывается крестиком, кнопкой, нажатием мимо и кнопкой «Назад». */
export function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId?: string }) {
  useOverlay(onClose, OVERLAY.help)
  return (
    <div className="fixed inset-0 z-[70] bg-jewelInk/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[480px] max-h-[82dvh] flex flex-col rounded-t-2xl bg-cream border-t-[1.5px] border-x-[1.5px] border-jewelInk px-5 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 20px)' }}
        onClick={e => e.stopPropagation()} data-testid={testId} role="dialog" aria-label={title}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 mn-eyebrow text-navy">{title}</div>
          <button onClick={onClose} aria-label="Закрыть" className="w-11 h-11 -mr-2 flex items-center justify-center"><CloseIcon size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        <div className="mt-4"><Button onClick={onClose}>Понятно</Button></div>
      </div>
    </div>
  )
}

/** Ссылка-кнопка под главной кнопкой: второе, необязательное действие. */
export function LinkButton({ onClick, children, testId }: { onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button onClick={onClick} data-testid={testId} className="w-full min-h-[44px] text-center text-[14px] font-bold text-jewelInk-mid underline decoration-jewelInk/30 underline-offset-4">
      {children}
    </button>
  )
}

export const CheckIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** Точки раундов: пройденные, текущий, впереди. */
export function Dots({ count, at }: { count: number; at: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full border border-jewelInk/40 ${i < at ? 'bg-navy' : i === at ? 'bg-gold' : 'bg-cream-deep'}`} />
      ))}
    </div>
  )
}
