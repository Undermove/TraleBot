import React, { useEffect, useState } from 'react'
import { PointIcon } from '../ui/icons'

interface Props {
  /** Значение data-tour у элемента, на который показываем. */
  target: string
  text: string
  /** «2 из 3» — когда шагов несколько. */
  counter?: string
  /** Подпись главной кнопки: «Дальше» или «Понятно». */
  action: string
  onAction: () => void
  /** Пропустить всё знакомство; нет — кнопки «Пропустить» нет. */
  onSkip?: () => void
  /** Человек нажал на сам подсвеченный элемент — подсказка своё дело сделала. */
  onTargetClick: () => void
}

/**
 * «Фонарик» раздела «Глаголы»: затемняет экран и оставляет светлым настоящий элемент, рядом — реплика.
 * Тот же приём, что у подсказок главной (components/OnboardingSpotlight), но шаг и текст задаёт раздел.
 * Ничего не блокирует: слой не ловит нажатия, подсвеченный элемент нажимается как обычно.
 */
export default function Spotlight({ target, text, counter, action, onAction, onSkip, onTargetClick }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
    if (!el) { setRect(null); return }

    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    const settle = setTimeout(measure, 350) // после плавной прокрутки
    el.addEventListener('click', onTargetClick, { once: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(settle)
      el.removeEventListener('click', onTargetClick)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!rect) return null

  const pad = 6
  const top = rect.top - pad
  const height = rect.height + pad * 2
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const below = top + height + 150 < viewportH

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }} data-testid={`verbs-tour-${target}`}>
      <div
        style={{
          position: 'absolute', top, left: rect.left - pad, width: rect.width + pad * 2, height,
          borderRadius: 16, border: '2px solid #F5B820', boxShadow: '0 0 0 9999px rgba(21, 16, 10, 0.55)',
          transition: 'top 150ms, left 150ms, width 150ms, height 150ms'
        }}
      />
      <div
        style={{
          position: 'absolute', left: 16, right: 16, pointerEvents: 'auto',
          top: below ? top + height + 12 : undefined,
          bottom: below ? undefined : Math.max(12, viewportH - top + 12)
        }}
      >
        <div
          className="mx-auto max-w-[360px] bg-cream border-[1.5px] border-jewelInk rounded-xl px-4 py-3"
          style={{ boxShadow: '3px 3px 0 #15100A' }}
          role="dialog" aria-label="Подсказка"
        >
          <div className="flex items-start gap-2.5">
            <PointIcon size={22} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-[14px] font-bold text-jewelInk leading-snug" data-testid="verbs-tour-text">{text}</div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {counter && <span className="text-[11px] font-bold text-jewelInk-hint tabular-nums">{counter}</span>}
            <span className="flex-1" />
            {onSkip && (
              <button onClick={onSkip} className="min-h-[44px] px-2 text-[13px] text-jewelInk-mid underline" data-testid="verbs-tour-skip">
                Пропустить
              </button>
            )}
            <button
              onClick={onAction}
              data-testid="verbs-tour-action"
              className="min-h-[44px] px-4 rounded-lg bg-navy text-cream text-[13px] font-extrabold border-[1.5px] border-jewelInk"
            >
              {action}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
