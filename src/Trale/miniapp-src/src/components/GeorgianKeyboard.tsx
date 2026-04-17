import React, { useEffect, useState } from 'react'

interface GeorgianKeyboardProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const ROW1 = ['ქ', 'წ', 'ე', 'რ', 'ტ', 'ყ', 'უ', 'ი', 'ო', 'პ']
const ROW2 = ['ა', 'ს', 'დ', 'ფ', 'გ', 'ჰ', 'ჯ', 'კ', 'ლ', 'ჩ']
const ROW3 = ['ზ', 'შ', 'ხ', 'ც', 'ვ', 'ბ', 'ნ', 'მ']
const ROW4_RARE = ['თ', 'ჟ', 'ღ', 'ძ', 'ჭ']

const RARE_TIP_KEY = 'geo_kb_rare_tip_seen'

export default function GeorgianKeyboard({ value, onChange, disabled = false }: GeorgianKeyboardProps) {
  const [showRareTip, setShowRareTip] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(RARE_TIP_KEY)) {
      setShowRareTip(true)
      localStorage.setItem(RARE_TIP_KEY, '1')
      const timer = setTimeout(() => setShowRareTip(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  function handlePress(letter: string) {
    if (disabled) return
    onChange(value + letter)
  }

  function handleBackspace() {
    if (disabled) return
    // Spread to handle multi-codepoint Georgian chars correctly
    const chars = [...value]
    chars.pop()
    onChange(chars.join(''))
  }

  function handleSpace() {
    if (disabled) return
    onChange(value + ' ')
  }

  const keyClasses = (extra = '') =>
    `h-[44px] rounded-lg border-[1.5px] font-geo text-[18px] font-bold select-none
     transition-all duration-75 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
     ${disabled ? 'opacity-30 pointer-events-none' : ''} ${extra}`

  const keyShadow = disabled ? 'none' : '2px 2px 0 #15100A'

  return (
    <div className="geo-keyboard bg-cream border-t border-jewelInk/15 px-2 pt-2 pb-3">
      {/* Row 1 */}
      <div className="flex gap-[3px] mb-[3px]">
        {ROW1.map(letter => (
          <button
            key={letter}
            onPointerDown={(e) => { e.preventDefault(); handlePress(letter) }}
            className={`flex-1 ${keyClasses('bg-cream-tile border-jewelInk text-jewelInk')}`}
            style={{ boxShadow: keyShadow }}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex gap-[3px] mb-[3px]">
        {ROW2.map(letter => (
          <button
            key={letter}
            onPointerDown={(e) => { e.preventDefault(); handlePress(letter) }}
            className={`flex-1 ${keyClasses('bg-cream-tile border-jewelInk text-jewelInk')}`}
            style={{ boxShadow: keyShadow }}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Row 3 + Backspace */}
      <div className="flex gap-[3px] mb-[3px]">
        {ROW3.map(letter => (
          <button
            key={letter}
            onPointerDown={(e) => { e.preventDefault(); handlePress(letter) }}
            className={`flex-1 ${keyClasses('bg-cream-tile border-jewelInk text-jewelInk')}`}
            style={{ boxShadow: keyShadow }}
          >
            {letter}
          </button>
        ))}
        <button
          onPointerDown={(e) => { e.preventDefault(); handleBackspace() }}
          className={`h-[44px] rounded-lg border-[1.5px] flex items-center justify-center select-none
            transition-all duration-75 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
            bg-cream-deep border-jewelInk text-jewelInk
            ${disabled ? 'opacity-30 pointer-events-none' : 'active:bg-ruby/10'}`}
          style={{ minWidth: '49px', boxShadow: disabled ? 'none' : '2px 2px 0 #15100A' }}
          aria-label="Удалить"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path
              d="M7 1H16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7L1 7z"
              stroke="#15100A"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M10 5L14 9M14 5L10 9"
              stroke="#15100A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Gold hairline divider between main and rare rows */}
      <div className="h-px bg-gold/30 my-1 mx-1" />

      {/* Row 4: rare letters + space */}
      <div className="relative flex gap-[3px]">
        {showRareTip && (
          <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none z-10">
            <div className="bg-gold-wash border border-gold/60 rounded-lg px-3 py-1 font-sans text-[11px] font-semibold text-jewelInk whitespace-nowrap">
              редкие звуки — встретишь в сложных уроках
            </div>
          </div>
        )}

        {ROW4_RARE.map(letter => (
          <button
            key={letter}
            onPointerDown={(e) => { e.preventDefault(); handlePress(letter) }}
            className={`flex-1 h-[44px] rounded-lg border-[1.5px] font-geo text-[18px] font-bold
              select-none relative transition-all duration-75
              active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
              border-gold/60 bg-gold-wash text-jewelInk
              ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
            style={{ boxShadow: disabled ? 'none' : '2px 2px 0 #C68F10' }}
          >
            {letter}
            <span className="absolute top-[5px] right-[5px] w-[4px] h-[4px] rounded-full bg-gold-deep opacity-60" />
          </button>
        ))}

        {/* Space key */}
        <button
          onPointerDown={(e) => { e.preventDefault(); handleSpace() }}
          className={`flex-1 h-[44px] rounded-lg border-[1.5px] flex items-center justify-center
            select-none transition-all duration-75
            active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
            bg-cream-tile border-jewelInk
            ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
          style={{ boxShadow: disabled ? 'none' : '2px 2px 0 #15100A' }}
          aria-label="Пробел"
        >
          <div className="w-6 h-0.5 bg-jewelInk rounded-full opacity-40" />
        </button>
      </div>
    </div>
  )
}
