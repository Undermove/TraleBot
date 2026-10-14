import React, { useMemo, useRef, useState } from 'react'
import GameFrame from './GameFrame'
import { haptic, sound } from './fx'
import { catchRounds, shuffle, type CatchRound, type Rng } from './logic'
import { useLater } from '../../verbs/games/useLater'

/**
 * «Поймай букву»: по полю покачиваются пузыри с буквами, надо лопнуть все пузыри с нужной буквой (их три).
 * Мимо — пузырь вздрагивает, и только. В первом раунде нужные пузыри подсвечены — первый ход с подсказкой.
 */
export default function Catch({ letters, lesson, fraction, onExit, onDone, rng = Math.random, rounds: given }: {
  letters: string[]
  lesson: number
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  rounds?: CatchRound[]
}) {
  const rounds = useMemo(() => given ?? catchRounds(letters, lesson, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  // Пузыри — по ячейкам сетки 3×3 с небольшим разбросом: не налезают друг на друга.
  const spots = useMemo(() => rounds.map(r => {
    const cells = shuffle(Array.from({ length: 9 }, (_, i) => i), rng)
    return r.bubbles.map((_, i) => ({ x: 18 + (cells[i] % 3) * 32 + (rng() - 0.5) * 8, y: 17 + Math.floor(cells[i] / 3) * 33 + (rng() - 0.5) * 8, d: rng() * 2 }))
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const [popped, setPopped] = useState<Set<number>>(new Set())
  const [shake, setShake] = useState<number | null>(null)
  const [hinted, setHinted] = useState(false)
  const els = useRef<(HTMLButtonElement | null)[]>([])
  const later = useLater()
  const round = rounds[ri]
  if (!round) { later(onDone, 0); return null }
  const left = round.bubbles.filter((b, i) => b === round.target && !popped.has(i)).length
  const guide = ri === 0 && !hinted

  function tap(i: number) {
    if (popped.has(i)) return
    if (round.bubbles[i] !== round.target) {
      haptic('bad'); sound.miss(); setShake(i); later(() => setShake(null), 380)
      return
    }
    haptic('pop'); sound.surface('pop'); sound.pop(popped.size); setHinted(true)
    const next = new Set(popped).add(i)
    setPopped(next)
    if (round.bubbles.every((b, k) => b !== round.target || next.has(k))) {
      later(() => {
        haptic('good'); sound.win()
        if (ri + 1 >= rounds.length) onDone()
        else { setRi(ri + 1); setPopped(new Set()) }
      }, 450)
    }
  }

  return (
    <GameFrame title="Поймай букву" eyebrow={`поймай букву · ${ri + 1} из ${rounds.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="catch">
        <div className="text-center text-[15px] font-bold text-jewelInk-mid" data-testid="catch-ask">
          Лопни все пузыри с буквой <span className="font-geo text-[30px] text-navy align-middle">{round.target}</span>
          <span className="ml-2 tabular-nums text-jewelInk-hint">осталось {left}</span>
        </div>
        <div className="relative flex-1 min-h-[220px] rounded-2xl border-[1.5px] border-jewelInk/25 bg-navy-wash/40 overflow-hidden" key={ri}>
          {round.bubbles.map((b, i) => (
            <div key={i} className="absolute" style={{ left: `${spots[ri][i].x}%`, top: `${spots[ri][i].y}%`, transform: 'translate(-50%, -50%)' }}>
              {popped.has(i) && (
                <>
                  <span className="ab-pop-ring" aria-hidden />
                  {Array.from({ length: 7 }, (_, k) => {
                    const ang = (k / 7) * Math.PI * 2
                    return <span key={k} className="ab-pop-drop" aria-hidden style={{ ['--dx' as any]: `${Math.cos(ang) * 44}px`, ['--dy' as any]: `${Math.sin(ang) * 44 + 10}px` }} />
                  })}
                </>
              )}
              <button
                ref={el => { els.current[i] = el }}
                aria-label={b}
                data-testid="catch-bubble"
                data-target={b === round.target ? 'yes' : 'no'}
                disabled={popped.has(i)}
                onPointerDown={() => tap(i)}
                className={`w-[62px] h-[62px] ab-short:w-[54px] ab-short:h-[54px] rounded-full border-[1.5px] border-jewelInk font-geo text-[30px] font-extrabold flex items-center justify-center ${
                  popped.has(i) ? 'ab-pop-bubble pointer-events-none' : 'ab-bob'} ${shake === i ? 'ab-shake' : ''} ${guide && b === round.target ? 'ring-4 ring-gold ab-pulse' : ''}`}
                style={{ background: 'radial-gradient(circle at 35% 30%, #FFFFFF, #C9DBF0 70%)', ['--d' as any]: `${spots[ri][i].d}s` }}
              >{b}</button>
            </div>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
