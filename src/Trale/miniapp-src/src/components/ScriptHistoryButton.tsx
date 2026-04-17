import React from 'react'

interface ScriptHistoryButtonProps {
  onOpen: () => void
}

/**
 * Entry point to the Georgian script history carousel.
 * Rendered only inside alphabet modules (alphabet-progressive, alphabet).
 */
export default function ScriptHistoryButton({ onOpen }: ScriptHistoryButtonProps) {
  return (
    <button
      onClick={onOpen}
      className="jewel-tile jewel-pressable w-full px-4 py-3 mb-4 flex items-center gap-3 text-left"
      style={{ minHeight: 56, WebkitTapHighlightColor: 'transparent' }}
      aria-label="Открыть историю грузинского письма"
    >
      {/* Icon: [ისტ] in gold-bordered cream square */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg border border-gold flex items-center justify-center bg-cream"
      >
        <span className="font-sans text-[11px] font-extrabold text-gold-deep leading-none">
          ისტ
        </span>
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0 relative z-[1]">
        <div className="font-sans text-[15px] font-bold text-jewelInk leading-tight">
          История письма
        </div>
        <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
          ისტორია · V век · 4 факта
        </div>
      </div>

      {/* Chevron */}
      <div className="font-sans text-[15px] text-jewelInk-hint flex-shrink-0 relative z-[1]">
        →
      </div>
    </button>
  )
}
