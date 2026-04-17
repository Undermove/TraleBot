import React from 'react'
import { GEORGIAN_ALPHABET } from './AlphaIndex'
import { AlphabetLetterDto } from '../types'

interface AlphabetGridProps {
  learnedLetters: Set<string>
  letterData: Map<string, AlphabetLetterDto>
  onLetterTap: (letter: string) => void
  goldFlash?: boolean
}

export default function AlphabetGrid({
  learnedLetters,
  onLetterTap,
  goldFlash = false
}: AlphabetGridProps) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {GEORGIAN_ALPHABET.map((letter) => {
        const isLearned = learnedLetters.has(letter)
        return (
          <button
            key={letter}
            onClick={() => onLetterTap(letter)}
            aria-label={letter}
            className={[
              'w-[44px] h-[44px]',
              'border-[1.5px] rounded-lg',
              'font-geo text-[20px] font-extrabold',
              'flex items-center justify-center',
              'transition-colors duration-300',
              isLearned
                ? [
                    'bg-navy text-cream border-jewelInk',
                    'active:translate-x-[2px] active:translate-y-[2px]',
                    goldFlash ? 'gold-flash-anim' : ''
                  ].join(' ')
                : 'bg-cream-tile text-jewelInk/30 border-jewelInk/20'
            ].join(' ')}
            style={isLearned ? { boxShadow: '2px 2px 0 #15100A' } : {}}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
