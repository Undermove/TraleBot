import React from 'react'
import Mascot from './Mascot'

interface Props {
  onOpen: () => void
}

/**
 * Entry-point banner for the Georgian script history carousel.
 * Rendered in ModuleMap for alphabet modules only.
 * Not hidden after viewing — users can revisit the carousel at any time.
 */
export default function HistoryBanner({ onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      className="jewel-tile jewel-pressable block w-full px-4 py-3 mb-4 text-left"
      style={{ minHeight: 60, WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="relative z-[1] flex items-center gap-3">
        {/* Bombora — mood cheer, small */}
        <div className="flex-shrink-0">
          <Mascot mood="cheer" size={36} />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-tight">
            История грузинского письма
          </div>
          <div className="mn-eyebrow text-gold-deep mt-0.5">
            V საუკუნე · 4 карточки
          </div>
        </div>

        {/* Arrow */}
        <span className="text-navy font-bold text-[16px] flex-shrink-0">→</span>
      </div>
    </button>
  )
}
