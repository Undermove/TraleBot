import React from 'react'

export type SlotState = 'empty' | 'filled' | 'correct' | 'incorrect' | 'preset'

interface Props {
  state: SlotState
  chip?: { text: string }
  hint?: string
  onTap: () => void
  'data-testid'?: string
}

export default function SentenceSlot({ state, chip, hint, onTap, 'data-testid': testId }: Props) {
  const isPreset = state === 'preset'

  const bg =
    isPreset ? 'bg-navy'
    : state === 'correct' ? 'bg-navy'
    : state === 'incorrect' ? 'bg-ruby'
    : 'bg-cream'

  const border =
    isPreset ? 'border-[1.5px] border-solid border-jewelInk'
    : state === 'empty'
    ? 'border-[1.5px] border-dashed border-jewelInk'
    : state === 'correct'
    ? 'border-2 border-solid border-navy'
    : state === 'incorrect'
    ? 'border-2 border-solid border-ruby'
    : 'border-[1.5px] border-solid border-jewelInk'

  const textColor =
    isPreset || state === 'correct' || state === 'incorrect' ? 'text-cream' : 'text-jewelInk'

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onTap}
        disabled={isPreset}
        data-testid={testId}
        className={`h-[48px] min-w-[52px] px-3 rounded-lg flex items-center justify-center font-geo text-[15px] font-semibold transition-all duration-75 active:scale-95
          ${bg} ${border} ${textColor}`}
      >
        {chip?.text ?? ''}
      </button>
      {hint && state === 'incorrect' && (
        <div data-testid="slot-hint" className="font-sans text-[11px] text-ruby font-medium mt-1 text-center max-w-[100px] leading-tight">
          {hint}
        </div>
      )}
    </div>
  )
}
