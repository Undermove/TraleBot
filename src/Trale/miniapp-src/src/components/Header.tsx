import React from 'react'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  onBack?: () => void
  title?: string
}

export default function Header({ progress, onBack, title }: Props) {
  return (
    <div
      className="sticky top-0 z-10 bg-dog-bg/95 backdrop-blur px-4 pb-3 border-b border-dog-line"
      style={{ paddingTop: 'calc(var(--safe-t) + 12px)' }}
    >
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-lg font-bold text-dog-ink active:translate-y-0.5"
            aria-label="Назад"
          >
            ‹
          </button>
        ) : (
          <div className="w-9" />
        )}
        <div className="flex-1 text-center font-extrabold text-dog-ink truncate">
          {title ?? 'Бомбора учит грузинский'}
        </div>
        <div className="w-9" />
      </div>
      <div className="flex gap-2 mt-2 text-xs">
        <Stat icon="🔥" label={`${progress.streak} дн.`} />
        <Stat icon="⭐" label={`${progress.xp} XP`} />
      </div>
    </div>
  )
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="bg-white rounded-full px-2.5 py-1 shadow-card flex items-center gap-1.5">
      <span>{icon}</span>
      <span className="font-extrabold text-dog-ink">{label}</span>
    </div>
  )
}
