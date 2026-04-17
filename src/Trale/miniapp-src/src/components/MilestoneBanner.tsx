import React, { useEffect, useState } from 'react'

interface Props {
  type: 'xp' | 'streak'
  value: number
  onDismiss: () => void
}

interface MilestoneConfig {
  body: string
  georgian: string
  translit: string
  duration: number
}

const XP_MILESTONES: Record<number, MilestoneConfig> = {
  100: { body: '100 опыта накоплено', georgian: 'ასი', translit: 'asi', duration: 3000 },
  200: { body: '200 опыта — отлично', georgian: 'ორასი', translit: 'orasi', duration: 3000 },
  500: { body: '500 опыта — ты про', georgian: 'ხუთასი', translit: 'khutasi', duration: 3000 },
}

const STREAK_MILESTONES: Record<number, MilestoneConfig> = {
  7:  { body: '7 дней подряд!', georgian: 'შვიდი', translit: 'shvidi', duration: 3000 },
  14: { body: '14 дней подряд!', georgian: 'თოთხმეტი', translit: 'totkhm.', duration: 4000 },
}

/**
 * MilestoneBanner — a brief reward toast that slides up from the bottom when
 * the user crosses an XP or streak milestone.
 *
 * Learning element: Georgian numeral shown alongside the Russian text, so the
 * user passively absorbs number vocabulary with every milestone.
 */
export default function MilestoneBanner({ type, value, onDismiss }: Props) {
  const [hiding, setHiding] = useState(false)

  const config = type === 'xp' ? XP_MILESTONES[value] : STREAK_MILESTONES[value]
  if (!config) return null

  function dismiss() {
    setHiding(true)
    setTimeout(onDismiss, 200)
  }

  useEffect(() => {
    const timer = setTimeout(dismiss, config.duration)
    return () => clearTimeout(timer)
  }, [])

  return (
    <button
      onClick={dismiss}
      className={`fixed bottom-4 left-4 right-4 z-50 max-w-[480px] mx-auto jewel-tile jewel-pressable px-5 py-4 flex items-center gap-4 ${hiding ? 'milestone-fade-out' : 'milestone-slide-up'}`}
    >
      <div className="relative z-[1] shrink-0 text-[24px] leading-none">
        {type === 'xp' ? '⭐' : '🔥'}
      </div>
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-t4 font-extrabold text-jewelInk leading-tight">
          {config.body}
        </div>
        <div className="font-sans text-t5 text-jewelInk-mid mt-0.5">
          Так держать!
        </div>
      </div>
      <div className="relative z-[1] text-right shrink-0">
        <div className="font-geo text-t2 font-extrabold text-jewelInk leading-none">
          {config.georgian}
        </div>
        <div className="font-sans text-t6 uppercase tracking-widest text-jewelInk-mid mt-0.5">
          {config.translit}
        </div>
      </div>
    </button>
  )
}

export { XP_MILESTONES, STREAK_MILESTONES }
export type { MilestoneConfig }
