import React, { useEffect, useState } from 'react'
import { VocabularyItem } from '../api'

interface Props {
  mastery: VocabularyItem['mastery']
}

const MASTERY_CONFIG = {
  NotMastered: {
    georgian: 'ახალი',
    subtitle: 'ещё не практиковалось',
    dots: [false, false]
  },
  MasteredInForwardDirection: {
    georgian: 'სწავლობს',
    subtitle: 'одно направление освоено',
    dots: [true, false]
  },
  MasteredInBothDirections: {
    georgian: 'ათვისებული',
    subtitle: 'оба направления освоены',
    dots: [true, true]
  }
} as const

export default function MasteryIndicator({ mastery }: Props) {
  const config = MASTERY_CONFIG[mastery]
  const [dotVisible, setDotVisible] = useState([false, false])

  useEffect(() => {
    // Stagger dot animation: first at 0ms, second at 80ms
    const t1 = setTimeout(() => setDotVisible(prev => [true, prev[1]]), 0)
    const t2 = setTimeout(() => setDotVisible(prev => [prev[0], true]), 80)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="jewel-tile px-4 py-3 min-h-[52px] flex flex-col justify-center">
      <div className="relative z-[1] flex items-center gap-3">
        {/* Mastery dots */}
        <div className="flex items-center gap-1.5 shrink-0">
          {config.dots.map((filled, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full border transition-transform duration-[180ms] ease-out ${
                filled
                  ? 'bg-navy border-jewelInk'
                  : 'bg-cream border-jewelInk/40'
              } ${dotVisible[i] ? 'scale-100' : 'scale-0'}`}
            />
          ))}
        </div>
        {/* Georgian label */}
        <span className="font-geo font-bold text-[13px] text-jewelInk">
          {config.georgian}
        </span>
      </div>
      <div className="relative z-[1] mt-0.5 text-[11px] text-jewelInk-mid font-sans">
        {config.subtitle}
      </div>
    </div>
  )
}
