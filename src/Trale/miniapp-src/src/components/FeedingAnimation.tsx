import React, { useEffect, useState } from 'react'
import Mascot from './Mascot'

export interface FeedingTreat {
  index: number
  emoji: string
  name: string
  geoName: string
  sound: string
  particles: string[]
}

// Per-treat visual flavour
export const FEEDING_TREATS: FeedingTreat[] = [
  {
    index: 0,
    emoji: '🥐',
    name: 'Дзвали',
    geoName: 'ძვალი',
    sound: 'хрум-хрум!',
    particles: ['·', '·', '✨'],
  },
  {
    index: 1,
    emoji: '🥩',
    name: 'Хорци',
    geoName: 'ხორცი',
    sound: 'ам-ам!',
    particles: ['💢', '✨', '·'],
  },
  {
    index: 2,
    emoji: '🍢',
    name: 'Мцвади',
    geoName: 'მწვადი',
    sound: 'вкуснятина!',
    particles: ['🔥', '✨', '💛'],
  },
  {
    index: 3,
    emoji: '🍬',
    name: 'Чурчхела',
    geoName: 'ჩურჩხელა',
    sound: 'мням-мням!',
    particles: ['💖', '✨', '🎉'],
  },
  {
    index: 4,
    emoji: '🍽️',
    name: 'Супра',
    geoName: 'სუფრა',
    sound: 'პურმარილი! 🍷',
    particles: ['🎊', '🍇', '🥖', '🧀', '🎉'],
  },
]

interface Props {
  treatIndex: number
  onComplete: () => void
}

/**
 * Feeding animation — full-screen overlay.
 * Phase 1 (0 - 900ms): treat flies from top toward Bombora's mouth, Bombora is hungry→chewing
 * Phase 2 (900 - 1700ms): Bombora chews, sparkles, sound text pops
 * Phase 3 (1700 - 2600ms): Bombora becomes sated (lemonade!) with big smile
 * Phase 4 (2600ms+): fade out, onComplete
 */
export default function FeedingAnimation({ treatIndex, onComplete }: Props) {
  const treat = FEEDING_TREATS[treatIndex] ?? FEEDING_TREATS[0]
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50) // kick off treat flight
    const t2 = setTimeout(() => setPhase(2), 900) // bite
    const t3 = setTimeout(() => setPhase(3), 1700) // sated
    const t4 = setTimeout(() => onComplete(), 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [onComplete])

  const mascotMood: 'hungry' | 'chewing' | 'sated' =
    phase <= 1 ? 'hungry' : phase === 2 ? 'chewing' : 'sated'

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-cream/95 backdrop-blur-sm"
      style={{
        paddingTop: 'var(--safe-t)',
        paddingBottom: 'var(--safe-b)',
      }}
    >
      {/* Georgian eyebrow */}
      <div className="mn-eyebrow text-ruby mb-1">{treat.geoName}</div>
      <div className="font-sans text-[16px] font-bold text-jewelInk-mid mb-4">{treat.name}</div>

      <div className="relative" style={{ width: 240, height: 240 }}>
        {/* Mascot at bottom */}
        <div className="absolute inset-0 flex items-end justify-center">
          <Mascot mood={mascotMood} size={200} />
        </div>

        {/* Flying treat emoji */}
        <div
          className="absolute left-1/2 text-[56px] leading-none select-none"
          style={{
            top: 0,
            transform: `translateX(-50%) translateY(${phase >= 1 ? '90px' : '0'}) scale(${phase === 2 ? 0.3 : 1})`,
            opacity: phase >= 2 ? 0 : 1,
            transition: 'transform 850ms cubic-bezier(0.45, 0.1, 0.3, 1.0), opacity 300ms ease-out',
          }}
        >
          {treat.emoji}
        </div>

        {/* Particle burst when biting */}
        {phase >= 2 && (
          <div className="absolute inset-0 pointer-events-none">
            {treat.particles.map((p, i) => {
              const angle = (i / treat.particles.length) * Math.PI * 2
              const r = 60 + i * 4
              const x = Math.cos(angle) * r
              const y = Math.sin(angle) * r - 30
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-[22px] leading-none select-none"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${phase === 3 ? 1.2 : 0.6})`,
                    opacity: phase === 3 ? 0 : 1,
                    transition: 'transform 900ms ease-out, opacity 900ms ease-out',
                  }}
                >
                  {p}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sound effect text */}
      <div
        className="mt-2 font-sans font-extrabold text-ruby text-center"
        style={{
          fontSize: phase === 2 ? 28 : 22,
          opacity: phase >= 2 ? 1 : 0,
          transform: phase === 2 ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 250ms ease-out',
          height: 36,
        }}
      >
        {phase >= 2 ? treat.sound : ''}
      </div>

      {/* Final sated line */}
      <div
        className="mt-1 font-sans text-[14px] text-jewelInk-mid"
        style={{
          opacity: phase === 3 ? 1 : 0,
          transition: 'opacity 400ms ease-out',
          height: 20,
        }}
      >
        {phase === 3 ? 'მადლობა 💛' : ''}
      </div>
    </div>
  )
}
