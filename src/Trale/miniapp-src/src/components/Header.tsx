import React from 'react'
import { ProgressState } from '../types'

interface Props {
  progress?: ProgressState
  onBack?: () => void
  title?: string
  eyebrow?: string
  /** 'default' = sticky header with stats; 'result' = absolute, back button only, no stats */
  variant?: 'default' | 'result'
}

/**
 * Minanka header — kilim signature on top, back button + title row,
 * stats pills below. No italic. No decoration beyond the kilim strip.
 *
 * variant="result": position absolute (floats over confetti), no stats shown.
 */
export default function Header({ progress, onBack, title, eyebrow, variant = 'default' }: Props) {
  if (variant === 'result') {
    return (
      <div className="absolute top-0 left-0 right-0 z-30">
        <div style={{ paddingTop: 'var(--safe-t)' }}>
          <div className="mn-kilim" />
        </div>
        <div className="px-5 py-3 flex items-center gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-75"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
              aria-label="Назад"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3 L4 8 L10 13"
                  stroke="#15100A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <div className="w-11 shrink-0" />
          )}
          {/* No title or stats on result variant */}
          <div className="flex-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm">
      {/* Kilim signature — appears on every screen that uses Header */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      <div className="px-5 py-3 flex items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-75"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
            aria-label="Назад"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3 L4 8 L10 13"
                stroke="#15100A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className="w-11 shrink-0" />
        )}

        <div className="flex-1 text-center min-w-0">
          {eyebrow && (
            <div className="mn-eyebrow text-navy mb-0.5 truncate">{eyebrow}</div>
          )}
          <div className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight truncate">
            {title ?? 'Бомбора'}
          </div>
        </div>

        {/* Compact stats on the right */}
        {progress && (
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className="font-sans text-[14px] font-extrabold text-ruby tabular-nums leading-none">
                {progress.streak}
              </span>
              <span className="font-sans text-[9px] font-bold text-jewelInk-mid uppercase tracking-wider">
                дн
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-sans text-[14px] font-extrabold text-gold-deep tabular-nums leading-none">
                {progress.xp}
              </span>
              <span className="font-sans text-[9px] font-bold text-jewelInk-mid uppercase tracking-wider">
                xp
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
