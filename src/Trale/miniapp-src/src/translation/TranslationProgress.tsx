import React, { useEffect, useState } from 'react'
import Mascot from '../components/Mascot'
import type { TranslateProgress } from '../api'
import { progressView, VERB_STEPS } from './stages'
import './progress.css'

interface Props {
  progress: TranslateProgress
  /** Когда человек отправил слово — для счётчика секунд. */
  startedAt: number
}

/** Показываем секунды, когда ждать уже заметно. */
const SHOW_SECONDS_AFTER = 3

/**
 * Пока слово переводится: Бомбора «думает», строка называет шаг, на котором перевод сейчас
 * (его сообщает сервер), полоска движется. Для глагола, которого у нас ещё нет, — шаги по счёту.
 */
export default function TranslationProgress({ progress, startedAt }: Props) {
  const view = progressView(progress)
  const [seconds, setSeconds] = useState(() => elapsed(startedAt))
  useEffect(() => {
    const timer = setInterval(() => setSeconds(elapsed(startedAt)), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <div data-testid="translate-pending" role="status" aria-live="polite" className="tp-block mt-3 jewel-tile px-3 py-3">
      <div className="relative z-[1]">
        <div className="flex items-center gap-3">
          <div className="tp-bob shrink-0" aria-hidden="true">
            <Mascot mood="think" size={52} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 h-[14px]">
              <span data-testid="translate-step" className="font-sans text-[10px] font-extrabold uppercase tracking-wider text-gold-deep leading-none">
                {view.step === null ? 'перевожу' : `шаг ${view.step} из ${VERB_STEPS}`}
              </span>
              {seconds >= SHOW_SECONDS_AFTER && (
                <span data-testid="translate-seconds" className="font-sans text-[10px] font-bold text-jewelInk-hint leading-none tabular-nums">
                  {seconds} с
                </span>
              )}
            </div>
            <div className="h-[22px] flex items-center overflow-hidden">
              <span key={view.text} data-testid="translate-stage" className="tp-in font-sans text-[14px] font-extrabold text-navy leading-none whitespace-nowrap">
                {view.text}
                <span className="tp-dots" aria-hidden="true"><i /><i /><i /></span>
              </span>
            </div>
            <div className="tp-track mt-1.5" aria-hidden="true">
              {view.step === null ? (
                <div className="tp-seg tp-seg-now" />
              ) : (
                Array.from({ length: VERB_STEPS }, (_, i) => (
                  <div
                    key={i}
                    data-testid="translate-seg"
                    data-state={i + 1 < view.step! ? 'done' : i + 1 === view.step ? 'now' : 'next'}
                    className={`tp-seg ${i + 1 < view.step! ? 'tp-seg-done' : i + 1 === view.step ? 'tp-seg-now' : ''}`}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        <div data-testid="translate-note" className="mt-2 min-h-[32px] font-sans text-[12px] leading-4 text-jewelInk-mid">
          {view.note}
        </div>
      </div>
    </div>
  )
}

function elapsed(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
}
