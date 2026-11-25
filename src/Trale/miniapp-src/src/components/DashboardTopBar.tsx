import React from 'react'
import TgAvatar from './TgAvatar'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  onNavigateProfile: () => void
  onOpenTreatShop: () => void
}

function StatPill({
  value,
  label,
  color,
  flame = false
}: {
  value: number
  label: string
  color: 'ruby' | 'xp'
  flame?: boolean
}) {
  const colorClass = color === 'xp' ? 'bg-gold text-jewelInk' : 'bg-ruby text-cream'
  return (
    <div
      className={`${colorClass} border-[1.5px] border-jewelInk rounded-full px-4 py-2 flex items-baseline gap-1.5 min-h-[44px]`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {flame && (
        <svg className="td-flame self-center -ml-1" width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          <path d="M7 1c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill="#F5B820" stroke="#15100A" strokeWidth="1.300" strokeLinejoin="round" />
        </svg>
      )}
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
            <StatPill value={progress.streak} label="дн" color="ruby" flame={progress.streak > 0} />
          </button>
          <button onClick={onOpenTreatShop} className="active:opacity-80 transition-opacity" aria-label="Покормить Бомбору" data-testid="dashboard-feed-button">
            <StatPill value={Math.max(0, progress.xp - progress.xpSpent)} label="опыт" color="xp" />
          </button>
        </div>
        <button
          onClick={onNavigateProfile}
          data-testid="dashboard-profile"
          aria-label="Профиль"
          className="w-11 h-11 overflow-hidden rounded-full bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <TgAvatar size={44} />
        </button>
      </div>
    </div>
  )
}
