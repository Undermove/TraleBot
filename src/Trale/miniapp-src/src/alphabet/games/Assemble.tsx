import React, { useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from './GameFrame'
import { burst, flyGhost, haptic, sound } from './fx'
import { assembleRounds, type AssembleRound, type Rng, type WordPool } from './logic'
import { cyr } from '../../verbs/types'
import { useLater } from '../../verbs/games/useLater'

/** Где лежит плитка на столе: сетка с небольшим разбросом и наклоном, чтобы было похоже на рассыпанные буквы. */
function scatter(n: number, rng: Rng) {
  const cols = n <= 4 ? n : Math.ceil(n / 2)
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols
    const rowCount = Math.ceil(n / cols)
    return {
      left: `calc(${((col + 0.5) / cols) * 100}% - 32px + ${Math.round((rng() - 0.5) * 14)}px)`,
      top: `calc(${(row + 0.5) * (100 / rowCount)}% - 32px)`,
      r: `${Math.round((rng() - 0.5) * 24)}deg`,
      d: `${(rng() * 1.6).toFixed(2)}s`
    }
  })
}

/**
 * «Собери слово»: перевод и как слово звучит; грузинские буквы рассыпаны по столу и покачиваются.
 * Тапаешь по порядку — буква перелетает в ячейку и встаёт со щелчком. Собрал — слово подпрыгивает,
 * конфетти, перевод. Лишние буквы на столе — выученные и непохожие по звуку.
 */
export default function Assemble({ lesson, fraction, onExit, onDone, rng = Math.random, rounds: given, pool }: {
  lesson: number
  pool?: WordPool
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  rounds?: AssembleRound[]
}) {
  const rounds = useMemo(() => given ?? assembleRounds(lesson, 2, rng, pool), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const round = rounds[ri]
  const spots = useMemo(() => scatter(round?.tiles.length ?? 0, rng), [ri]) // eslint-disable-line react-hooks/exhaustive-deps
  const [used, setUsed] = useState<Set<number>>(new Set())
  const [landed, setLanded] = useState(0)
  const [shake, setShake] = useState<number | null>(null)
  const [misses, setMisses] = useState(0)
  const tileEls = useRef<(HTMLButtonElement | null)[]>([])
  const slotEls = useRef<(HTMLDivElement | null)[]>([])
  const wordEl = useRef<HTMLDivElement>(null)
  const later = useLater()

  if (!round) { later(onDone, 0); return null }

  const placed = used.size
  const need = round.letters[placed]
  const complete = landed >= round.letters.length

  function tap(i: number) {
    if (used.has(i) || placed >= round.letters.length) return
    if (round.tiles[i] !== need) {
      haptic('bad'); sound.miss()
      setShake(i); setMisses(m => m + 1)
      later(() => setShake(null), 400)
      return
    }
    const slot = placed
    haptic('tap')
    setMisses(0)
    setUsed(new Set(used).add(i))
    void flyGhost(tileEls.current[i], slotEls.current[slot], round.tiles[i]).then(() => {
      haptic('snap'); sound.snap(slot)
      setLanded(l => Math.max(l, slot + 1))
      if (slot + 1 === round.letters.length) {
        later(() => { haptic('good'); sound.win(); burst(wordEl.current, 'big') }, 120)
      }
    })
  }

  function next() {
    haptic('tap')
    if (ri + 1 >= rounds.length) return onDone()
    setRi(ri + 1); setUsed(new Set()); setLanded(0); setMisses(0)
  }

  const hintTile = misses >= 2 ? round.tiles.findIndex((t, i) => t === need && !used.has(i)) : -1
  const slotSize = round.letters.length > 6 ? 'w-[38px] h-[50px] text-[26px]' : 'w-[48px] h-[58px] text-[32px]'

  return (
    <GameFrame title="Собери грузинское слово" eyebrow={`собери слово · ${ri + 1} из ${rounds.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 flex flex-col items-center gap-5">
        <div className="text-center" data-testid="assemble-ask">
          <div className="text-[28px] font-extrabold leading-tight">{round.word.ru}</div>
          <div className="text-[14px] font-bold text-jewelInk-mid">звучит «{cyr(round.word.geo)}»</div>
        </div>

        <div ref={wordEl} key={ri + (complete ? '-done' : '')} className={`flex justify-center gap-1.5 ${complete ? 'ab-boom' : ''}`} data-testid="assemble-slots">
          {round.letters.map((l, i) => (
            <div
              key={i}
              ref={el => { slotEls.current[i] = el }}
              data-testid="assemble-slot"
              className={`${slotSize} rounded-xl border-[1.5px] flex items-center justify-center font-geo font-extrabold ${
                i < landed ? (complete ? 'bg-navy text-cream border-jewelInk' : 'bg-cream-tile border-jewelInk') : 'border-dashed border-jewelInk/40 bg-cream-deep'
              } ${i === placed && !complete ? 'ab-pulse' : ''}`}
              style={i < landed ? { boxShadow: '2px 2px 0 #15100A' } : undefined}
            >
              {i < landed && <span className="ab-snap">{l}</span>}
            </div>
          ))}
        </div>

        {complete ? (
          <div className="text-center ab-drip">
            <div className="font-geo text-[40px] font-extrabold text-navy leading-none">{round.word.geo}</div>
            <div className="mt-1 text-[16px] font-bold">«{cyr(round.word.geo)}» — {round.word.ru}</div>
          </div>
        ) : (
          <div className="relative w-full rounded-2xl border-[1.5px] border-jewelInk/25 bg-cream-deep/60" style={{ height: round.tiles.length > 4 ? 220 : 150 }}>
            {round.tiles.map((t, i) => (
              <button
                key={`${ri}-${i}`}
                ref={el => { tileEls.current[i] = el }}
                aria-label={t}
                data-testid="assemble-tile"
                disabled={used.has(i)}
                onClick={() => tap(i)}
                className={`absolute w-[64px] h-[64px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile font-geo text-[32px] font-extrabold ${
                  used.has(i) ? 'ab-poof' : 'ab-bob'} ${shake === i ? 'bg-ruby-wash' : ''} ${i === hintTile ? 'ring-4 ring-gold' : ''}`}
                style={{ left: spots[i]?.left, top: spots[i]?.top, boxShadow: '3px 3px 0 #15100A', ['--r' as any]: spots[i]?.r, ['--d' as any]: spots[i]?.d }}
              >
                <span className={`block ${shake === i ? 'ab-shake' : ''}`}>{t}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto w-full max-w-[340px]">
          {complete
            ? <Button onClick={next}>{ri + 1 >= rounds.length ? 'дальше →' : 'следующее слово →'}</Button>
            : <div className="text-center text-[13px] font-bold text-jewelInk-hint">Тапай буквы по порядку, слева направо</div>}
        </div>
      </div>
    </GameFrame>
  )
}
