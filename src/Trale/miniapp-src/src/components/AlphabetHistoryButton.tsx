import React from 'react'

interface AlphabetHistoryButtonProps {
  onClick: () => void
  className?: string
}

/**
 * Entry point to the AlphabetHistoryCarousel.
 * Rendered in ModuleMap only for alphabet modules.
 * Pure presentation component — no internal state.
 */
export default function AlphabetHistoryButton({ onClick, className = '' }: AlphabetHistoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`jewel-tile jewel-pressable w-full px-4 py-3 flex items-center gap-3 text-left ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Georgian letter icon */}
      <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
        <span className="font-geo text-[18px] font-bold text-navy leading-none relative z-[1]">ა</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 relative z-[1]">
        <div className="font-sans text-[15px] font-bold text-jewelInk leading-tight">
          История алфавита
        </div>
        <div className="font-sans text-[11px] text-jewelInk/60 mt-0.5">
          V в. · 3 письма · UNESCO
        </div>
      </div>

      {/* Arrow */}
      <span className="text-jewelInk/40 text-[18px] ml-auto shrink-0 relative z-[1]">›</span>
    </button>
  )
}
