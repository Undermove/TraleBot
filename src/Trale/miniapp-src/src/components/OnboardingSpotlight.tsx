import React, { useEffect, useState } from 'react'

interface Props {
  hint: string
  /** Called once when the spotlight is shown — the app records it so it isn't surfaced again. */
  onShown: (hint: string) => void
  /** Called when the user taps the highlighted element or dismisses the spotlight. */
  onDismiss: () => void
}

interface TargetConfig {
  selector: string
  caption: string
}

// Each hint points at a REAL element on the dashboard, so the user learns the actual
// gesture (e.g. tapping the "Покормить" button) instead of pressing a one-off CTA.
const TARGETS: Record<string, TargetConfig> = {
  first_lesson: { selector: '[data-testid="dashboard-suggestion"]', caption: 'Жми сюда — пройдём первый урок 🎯' },
  next_lesson: { selector: '[data-testid="dashboard-suggestion"]', caption: 'Продолжим? Жми — откроется следующий урок' },
  explore_module: { selector: '[data-testid^="module-tile-"]', caption: 'Загляни в другую тему — выбери модуль 👇' },
  feed_bombora: { selector: '[data-testid="dashboard-feed-button"]', caption: 'Жми сюда, чтобы покормить Бомбору 🍖' },
  add_vocab: { selector: '[data-testid="module-tile-my-vocabulary"]', caption: 'Здесь твой словарь — заводи и тренируй слова' },
}

/**
 * Onboarding spotlight ("фонарик"): dims the dashboard and illuminates the real element the
 * user should tap, with a caption next to it. The highlighted element stays clickable (the
 * overlay is pointer-events:none), so acting on the nudge teaches the actual UI. Tapping the
 * target or the × dismisses it. Marks itself shown on mount.
 */
export default function OnboardingSpotlight({ hint, onShown, onDismiss }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const config = TARGETS[hint]

  useEffect(() => {
    onShown(hint)
  }, [hint])

  useEffect(() => {
    if (!config) return
    const el = document.querySelector<HTMLElement>(config.selector)
    if (!el) return

    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })

    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    const settle = setTimeout(measure, 350) // re-measure after the smooth scroll settles

    const dismiss = () => onDismiss()
    el.addEventListener('click', dismiss, { once: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      clearTimeout(settle)
      el.removeEventListener('click', dismiss)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [hint]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!config || !rect) return null

  const pad = 8
  const top = rect.top - pad
  const left = rect.left - pad
  const width = rect.width + pad * 2
  const height = rect.height + pad * 2
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const captionBelow = top + height + 96 < viewportH

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }} data-testid={`onboarding-spotlight-${hint}`}>
      {/* Dim everything except the target via a big box-shadow around the cutout. */}
      <div
        style={{
          position: 'absolute',
          top,
          left,
          width,
          height,
          borderRadius: 14,
          border: '2px solid #F5B820',
          boxShadow: '0 0 0 9999px rgba(21, 16, 10, 0.62)',
          pointerEvents: 'none',
          transition: 'top 150ms, left 150ms, width 150ms, height 150ms',
        }}
      />

      {/* Caption bubble — below the target if there's room, otherwise above. */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: captionBelow ? top + height + 12 : undefined,
          bottom: captionBelow ? undefined : viewportH - top + 12,
          pointerEvents: 'auto',
        }}
      >
        <div
          className="mx-auto max-w-[360px] bg-cream border-[1.5px] border-jewelInk rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ boxShadow: '3px 3px 0 #15100A' }}
        >
          <span className="text-[18px] leading-none shrink-0">🐶</span>
          <div className="flex-1 font-sans text-[13px] font-extrabold text-jewelInk leading-snug">
            {config.caption}
          </div>
          <button
            onClick={onDismiss}
            aria-label="Закрыть подсказку"
            className="shrink-0 text-jewelInk-hint font-sans text-[18px] leading-none w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
