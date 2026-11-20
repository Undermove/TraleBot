import React from 'react'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  onNavigateProfile: () => void
  onOpenTreatShop: () => void
}

function StatPill({
  value,
  label,
  color
}: {
  value: number
  label: string
  color: 'ruby' | 'xp'
}) {
  const colorClass = color === 'xp' ? 'bg-gold text-jewelInk' : 'bg-ruby text-cream'
  return (
    <div
      className={`${colorClass} border-[1.5px] border-jewelInk rounded-full px-4 py-2 flex items-baseline gap-1.5 min-h-[44px]`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <span className="font-sans text-[15px] font-extrabold tabular-nums leading-none">
        {value}
      </span>
      <span className="font-sans text-[10px] font-bold uppercase tracking-wider opacity-90">
        {label}
      </span>
    </div>
  )
}

/**
 * DashboardTopBar — kilim signature strip + stats pills for the Dashboard hero zone.
 * Extracted from Dashboard to keep the main render lean.
 */
export default function DashboardTopBar({ progress, onNavigateProfile, onOpenTreatShop }: Props) {
  return (
    <div>
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>
      {/* Счётчики слева, профиль — кружок справа вверху: там его ищут в большинстве приложений. */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onNavigateProfile} className="active:opacity-80 transition-opacity" aria-label="Серия дней">
            <StatPill value={progress.streak} label="дн" color="ruby" />
          </button>
          <button onClick={onOpenTreatShop} className="active:opacity-80 transition-opacity" aria-label="Покормить Бомбору">
            <StatPill value={Math.max(0, progress.xp - progress.xpSpent)} label="опыт" color="xp" />
          </button>
        </div>
        <button
          onClick={onNavigateProfile}
          data-testid="dashboard-profile"
          aria-label="Профиль"
          className="w-11 h-11 rounded-full bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15100A" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.8" fill="#F5B820" />
            <path d="M4.5 20c1.2-3.800 4.200-5.800 7.500-5.800s6.300 2 7.500 5.800" />
          </svg>
        </button>
      </div>
    </div>
  )
}
