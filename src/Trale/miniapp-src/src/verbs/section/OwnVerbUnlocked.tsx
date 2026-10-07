import React, { useEffect, useRef } from 'react'
import { CloseIcon } from '../ui/icons'
import { good } from '../ui/juice'
import { hintSeen, markHintSeen } from '../ui/hints'
import { OWN_VERB_HINT } from './tour'

/** Первый раз, когда своё переведённое слово оказалось глаголом? Празднуем один раз (отметка на сервере). */
export const ownVerbIsNews = () => !hintSeen(OWN_VERB_HINT)

interface Props {
  /** Русское значение глагола. */
  ru: string
  /** Подпись кнопки и что она делает: в разделе — сыграть, в словаре — показать, где глагол теперь живёт. */
  action: string
  onAction: () => void
  onClose: () => void
}

/**
 * «Свой глагол открыт»: человек перевёл слово, и оно оказалось глаголом. Один раз — с конфетти и
 * указанием, где глагол теперь лежит и что в него можно играть. Строка в потоке экрана, ничего не перекрывает.
 */
export default function OwnVerbUnlocked({ ru, action, onAction, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    markHintSeen(OWN_VERB_HINT)
    good(box.current, 'big')
  }, [])

  return (
    <div
      ref={box} data-testid="own-verb-unlocked" role="status"
      className="j-pop rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-4 py-3" style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-extrabold text-jewelInk leading-tight">Глагол «{ru}» открыт!</div>
          <div className="mt-1 text-[13px] text-jewelInk-mid leading-snug">
            Теперь он в «Моих глаголах» раздела «Глаголы». В него можно играть — пара минут, и формы запомнятся.
          </div>
        </div>
        <button onClick={onClose} aria-label="Закрыть" className="shrink-0 w-11 h-11 -mr-2 -mt-2 flex items-center justify-center"><CloseIcon size={16} /></button>
      </div>
      <button
        onClick={onAction} data-testid="own-verb-action"
        className="mt-2 min-h-[44px] px-4 rounded-lg bg-navy text-cream text-[13px] font-extrabold border-[1.5px] border-jewelInk"
      >
        {action}
      </button>
    </div>
  )
}
