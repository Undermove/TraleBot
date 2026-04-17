import React from 'react'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  onNavigateProfile: () => void
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
export default function DashboardTopBar({ progress, onNavigateProfile }: Props) {
  return (
    <div>
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="mn-eyebrow">блокнот</div>
        <button
          onClick={onNavigateProfile}
          className="flex items-center gap-3 active:opacity-80 transition-opacity"
        >
          <StatPill value={progress.streak} label="дн" color="ruby" />
          <StatPill value={progress.xp} label="опыт" color="xp" />
        </button>
      </div>
    </div>
  )
}
