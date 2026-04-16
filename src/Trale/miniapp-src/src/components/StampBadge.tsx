import React from 'react'

interface StampBadgeProps {
  variant: 'great' | 'ok' | 'retry'
  animate?: boolean
  className?: string
}

export default function StampBadge({ variant, animate = true, className = '' }: StampBadgeProps) {
  const geoWord = variant === 'great' ? 'მშვენივრად' : variant === 'ok' ? 'კარგი' : 'ცადე'
  const translit = variant === 'great' ? 'Отлично' : variant === 'ok' ? 'Хорошо' : 'Попробуй'

  const bgClass = variant === 'great' ? 'bg-ruby' : variant === 'ok' ? 'bg-navy' : 'bg-gold'
  const textClass = variant === 'retry' ? 'text-jewelInk' : 'text-cream'
  const hairlineStyle =
    variant === 'retry'
      ? '1px solid rgba(198, 143, 16, 0.5)'
      : '1px solid rgba(245, 184, 32, 0.4)'

  const animClass = animate ? 'mn-reveal-delayed' : ''

  return (
    <div
      className={`relative px-3 py-2.5 text-center border-[1.5px] border-jewelInk rounded-lg rotate-[6deg] min-w-[80px] ${bgClass} ${animClass} ${className}`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {/* Inner gold hairline — Minankari jewel-tile pattern */}
      <div
        className="absolute inset-[2px] rounded-[8px] pointer-events-none"
        style={{ border: hairlineStyle }}
      />
      <div className={`relative z-[1] font-geo text-[18px] font-extrabold leading-none ${textClass}`}>
        {geoWord}
      </div>
      <div className={`relative z-[1] font-sans text-[10px] font-bold tracking-wide mt-1 opacity-70 ${textClass}`}>
        {translit}
      </div>
    </div>
  )
}
