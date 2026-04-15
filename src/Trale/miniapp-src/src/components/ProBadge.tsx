import React from 'react'

/**
 * Small gold pill badge shown on Pro-locked module tiles.
 * Design spec: 22-monetization-stars-mvp.md → "Компонент: ProBadge"
 */
export default function ProBadge() {
  return (
    <span
      className="inline-flex items-center gap-[2px] bg-gold text-jewelInk border border-jewelInk/40 text-[10px] font-extrabold px-1.5 py-[2px] rounded leading-none"
      style={{ boxShadow: '1px 1px 0 rgba(21,16,10,0.25)' }}
      aria-label="Про-доступ"
    >
      ★ Про
    </span>
  )
}
