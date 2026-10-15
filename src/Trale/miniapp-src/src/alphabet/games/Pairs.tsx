import React, { useMemo, useState } from 'react'
import GameFrame from './GameFrame'
import { burst, haptic, sound } from './fx'
import { pairsDeck, type PairCard, type Rng, type WordPool } from './logic'
import { useLater } from '../../verbs/games/useLater'

/**
 * «Пары»: карточки рубашкой вверх; открываешь две — буква и её звук (или слово и его значение) остаются
 * открытыми, если это пара, иначе переворачиваются обратно. Первый ход — с подсказкой: после первой
 * открытой карточки её пара светится.
 */
export default function Pairs({ deck: kind, lesson, fraction, onExit, onDone, rng = Math.random, cards: given, pool }: {
  deck: 'letters' | 'words'
  lesson: number
  pool?: WordPool
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  cards?: PairCard[]
}) {
  const cards = useMemo(() => given ?? pairsDeck(kind, lesson, rng, pool), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const [busy, setBusy] = useState(false)
  const later = useLater()
  const els: Record<string, HTMLButtonElement | null> = {}
  const first = open.length === 1 ? cards.find(c => c.id === open[0]) : undefined
  const guide = moves === 0 && first

  function flip(c: PairCard) {
    if (busy || matched.has(c.pair) || open.includes(c.id)) return
    haptic('tap'); sound.snap(open.length)
    const next = [...open, c.id]
    setOpen(next)
    if (next.length < 2) return
    setMoves(m => m + 1)
    const [a, b] = next.map(id => cards.find(x => x.id === id)!)
    if (a.pair === b.pair) {
      const done = new Set(matched).add(a.pair)
      later(() => { haptic('good'); sound.pop(done.size * 2); burst(els[b.id], 'small'); setMatched(done); setOpen([]) }, 250)
      if (done.size * 2 >= cards.length) later(() => { sound.win(); onDone() }, 1100)
    } else {
      setBusy(true)
      later(() => { haptic('bad'); setOpen([]); setBusy(false) }, 800)
    }
  }

  return (
    <GameFrame title="Пары" eyebrow={kind === 'letters' ? 'буква и её звук' : 'слово и его значение'} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="pairs">
        <div className="text-center text-[15px] font-bold text-jewelInk-mid">
          {kind === 'letters' ? 'Открой две карточки: букву и её звук' : 'Открой две карточки: слово и что оно значит'}
        </div>
        <div className="grid grid-cols-3 gap-2.5 flex-1 min-h-0 content-center">
          {cards.map(c => {
            const shown = open.includes(c.id) || matched.has(c.pair)
            const hint = guide && c.pair === first!.pair && c.id !== first!.id
            return (
              <button key={c.id} ref={el => { els[c.id] = el }} onClick={() => flip(c)} data-testid="pair-card" data-shown={shown ? 'yes' : 'no'} data-pair={c.pair}
                className={`ab-flip h-[clamp(84px,14vh,120px)] ${hint ? 'ring-4 ring-gold ab-pulse rounded-2xl' : ''}`} data-flipped={shown ? 'yes' : 'no'}>
                <div className="ab-flip-inner">
                  <div className="ab-flip-face rounded-2xl border-[1.5px] border-jewelInk bg-ruby flex items-center justify-center" style={{ boxShadow: '3px 3px 0 #15100A', backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 8px, transparent 8px 16px)' }} />
                  <div className={`ab-flip-face ab-flip-back rounded-2xl border-[1.5px] border-jewelInk flex items-center justify-center px-1 ${matched.has(c.pair) ? 'bg-navy text-cream' : 'bg-cream-tile'}`} style={{ boxShadow: '3px 3px 0 #15100A' }}>
                    <span className={`text-center leading-tight ${c.kind === 'geo' ? 'font-geo font-extrabold whitespace-nowrap' : 'font-extrabold break-words hyphens-auto'}`}
                      style={{ fontSize: c.kind === 'geo' ? Math.max(11, Math.min(30, Math.floor(150 / Math.max(1, [...c.face].length)))) : Math.max(12, Math.min(17, Math.floor(150 / Math.max(1, c.face.length)))) }}>{c.face}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </GameFrame>
  )
}
