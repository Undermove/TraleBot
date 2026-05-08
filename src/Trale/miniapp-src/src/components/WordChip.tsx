import React from 'react'

export type WordChipState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled'

interface Props {
  text: string
  state: WordChipState
  onTap: () => void
}

export default function WordChip({ text, state, onTap }: Props) {
  const bg =
    state === 'selected'
      ? 'bg-gold'
      : state === 'correct'
      ? 'bg-navy'
      : state === 'incorrect'
      ? 'bg-ruby'
      : 'bg-cream'

  const textColor =
    state === 'correct' || state === 'incorrect'
      ? 'text-cream'
      : state === 'disabled'
      ? 'text-jewelInk/40'
      : 'text-jewelInk'

  const borderColor =
    state === 'disabled' ? 'border-jewelInk/30' : 'border-jewelInk'

  const shadow = state === 'correct' || state === 'incorrect' ? '' : '2px 2px 0 #15100A'
  const opacity = state === 'disabled' ? 'opacity-40' : ''

  return (
    <button
      onClick={onTap}
      disabled={state === 'disabled'}
      className={`min-h-[44px] min-w-[44px] px-[14px] py-[10px] rounded-lg border-[1.5px] font-geo text-[15px] font-semibold transition-all duration-75 active:scale-95
        ${bg} ${textColor} ${borderColor} ${opacity}`}
      style={{ boxShadow: shadow }}
    >
      {text}
    </button>
  )
}
