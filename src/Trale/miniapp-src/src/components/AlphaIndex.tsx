import React, { useEffect, useRef } from 'react'

export const GEORGIAN_ALPHABET = [
  'ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ', 'ი', 'კ',
  'ლ', 'მ', 'ნ', 'ო', 'პ', 'ჟ', 'რ', 'ს', 'ტ', 'უ',
  'ფ', 'ქ', 'ღ', 'ყ', 'შ', 'ჩ', 'ც', 'ძ', 'წ', 'ჭ',
  'ხ', 'ჯ', 'ჰ'
]

interface Props {
  activeLetter: string | null
  disabledLetters: Set<string>
  onSelect: (letter: string | null) => void
}

export default function AlphaIndex({ activeLetter, disabledLetters, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeLetter && activeRef.current) {
      activeRef.current.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }
  }, [activeLetter])

  return (
    <div
      className="flex flex-row gap-[6px] overflow-x-auto py-2 px-5"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {GEORGIAN_ALPHABET.map((letter) => {
        const isActive = activeLetter === letter
        const isDisabled = disabledLetters.has(letter)

        return (
          <button
            key={letter}
            ref={isActive ? activeRef : undefined}
            disabled={isDisabled}
            onClick={() => onSelect(isActive ? null : letter)}
            className={[
              'shrink-0 min-w-[36px] h-[36px]',
              'border-[1.5px] rounded-lg',
              'font-geo font-bold text-[15px]',
              'flex items-center justify-center',
              'transition-all duration-75',
              isActive
                ? 'bg-navy text-cream border-jewelInk'
                : isDisabled
                ? 'bg-cream-tile text-jewelInk/25 border-jewelInk/20 cursor-default'
                : 'bg-cream-tile text-jewelInk border-jewelInk active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            ].join(' ')}
            style={
              isActive
                ? {}
                : isDisabled
                ? {}
                : { boxShadow: '2px 2px 0 #15100A' }
            }
            aria-pressed={isActive}
            aria-label={letter}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
