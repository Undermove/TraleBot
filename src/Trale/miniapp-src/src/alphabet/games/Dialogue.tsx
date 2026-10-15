import React, { useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import GameFrame from './GameFrame'
import { burst, flyGhost, haptic, playClip, sound } from './fx'
import { WORD_AUDIO } from './data'
import { dialogueRounds, type DialogueRound } from './dialogues'
import type { Rng, Word } from './logic'
import { cyr } from '../../verbs/types'
import { useLater } from '../../verbs/games/useLater'
import { ProductArt } from '../cafe/art'
import { PRODUCTS } from '../cafe/products'

/**
 * «Разговор»: чат с Бомборой. Собеседник говорит (грузинская фраза из уроков или одно слово, перевод мелко),
 * ситуация — по-русски, ученик отвечает одним грузинским словом: тап по варианту — слово улетает в его облачко.
 * Первая реплика — с подсказкой, дальше подсказка после двух промахов.
 */
export default function Dialogue({ stage, own, known, fraction, onExit, onDone, rng = Math.random, rounds: given }: {
  stage: number
  own: Word[]
  known: Word[]
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  rounds?: DialogueRound[]
}) {
  const rounds = useMemo(() => given ?? dialogueRounds(stage, own, known, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const [said, setSaid] = useState<DialogueRound[]>([])
  const [misses, setMisses] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const chips = useRef<Record<string, HTMLButtonElement | null>>({})
  const reply = useRef<HTMLDivElement>(null)
  const later = useLater()
  const round = rounds[ri]
  if (!round) { later(onDone, 0); return null }
  const hint = !answered && (ri === 0 || misses >= 2)
  const done = answered && ri + 1 >= rounds.length
  // Варианты ответа целиком, без переноса посреди слова: короткие — в три колонки, длиннее — в две, самые длинные — столбиком.
  const longest = Math.max(...round.choices.map(c => [...c].length))
  const cols = longest <= 5 ? 3 : longest <= 8 ? 2 : 1

  function pick(geo: string) {
    if (answered) return
    if (geo !== round.answer.geo) {
      haptic('bad'); sound.miss(); setMisses(m => m + 1); setShake(geo); later(() => setShake(null), 380)
      return
    }
    haptic('good'); sound.pop(ri * 3)
    const url = WORD_AUDIO[geo]
    if (url) void playClip(url)
    setAnswered(true)
    void flyGhost(chips.current[geo], reply.current, geo, 360, 'font-geo').then(() => burst(reply.current, 'small'))
    setSaid(s => [...s, round])
    if (ri + 1 < rounds.length) later(() => { setRi(ri + 1); setAnswered(false); setMisses(0) }, 1300)
  }

  const picture = (geo: string) => PRODUCTS.find(p => p.geo === geo)?.id

  return (
    <GameFrame title="Разговор" eyebrow={`реплика ${ri + 1} из ${rounds.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="dialogue">
        {ri === 0 && !answered && <div className="text-center text-[14px] font-bold text-jewelInk-mid">Ответь одним словом по-грузински</div>}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end gap-2.5">
          {said.slice(0, -1).slice(-1).map((r, i) => (
            <div key={i} className="opacity-50 flex flex-col gap-1.5">
              <Bubble side="left">{r.frame.line ? <span className="font-geo font-extrabold">{r.frame.line}</span> : <span className="text-[13px]">{r.frame.context}</span>}</Bubble>
              <Bubble side="right"><span className="font-geo font-extrabold">{r.answer.geo}</span></Bubble>
            </div>
          ))}
          <div className="text-center text-[13px] italic text-jewelInk-mid" data-testid="dialogue-context">{round.frame.context}</div>
          <div className="flex items-end gap-2">
            <div className="shrink-0"><Mascot mood={answered ? 'cheer' : 'happy'} size={52} /></div>
            <Bubble side="left">
              {round.frame.line && <div className="font-geo text-[22px] font-extrabold leading-tight break-words" data-testid="dialogue-line">{round.frame.line}</div>}
              {round.frame.lineRu && <div className="text-[12px] text-jewelInk-hint">{round.frame.lineRu}</div>}
              {!round.frame.line && <div className="text-[15px] font-bold">…</div>}
              {picture(round.answer.geo) && <div className="mt-1"><ProductArt id={picture(round.answer.geo)!} size={40} /></div>}
            </Bubble>
          </div>
          <div className="flex justify-end">
            <div ref={reply} className={`min-w-[120px] min-h-[52px] rounded-2xl rounded-br-md border-[1.5px] px-3 py-2 text-right ${answered ? 'border-jewelInk bg-navy text-cream ab-snap' : 'border-dashed border-jewelInk/35 bg-cream-deep'}`} data-testid="dialogue-reply">
              {answered && <>
                <div className="font-geo font-extrabold leading-tight break-all" style={{ fontSize: Math.max(15, Math.min(22, Math.floor(170 / Math.max(1, [...round.answer.geo].length)))) }}>{round.answer.geo}</div>
                <div className="text-[12px] opacity-80" data-testid="dialogue-meaning">«{cyr(round.answer.geo)}» — {round.answer.ru}</div>
              </>}
            </div>
          </div>
        </div>
        {!done && (
          <div className={`grid gap-2.5 ${cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`} data-testid="dialogue-choices">
            {round.choices.map(geo => (
              <button key={`${ri}-${geo}`} ref={el => { chips.current[geo] = el }} onClick={() => pick(geo)} aria-label={geo} data-testid="dialogue-choice"
                disabled={answered}
                style={{ boxShadow: '3px 3px 0 #15100A' }}
                className={`min-w-0 ${cols === 1 ? 'h-[52px] ab-short:h-[46px]' : 'h-[64px] ab-short:h-[54px]'} rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile font-geo text-[20px] font-extrabold px-1 whitespace-nowrap leading-tight active:scale-95 transition-transform ${
                  shake === geo ? 'ab-shake bg-ruby-wash' : ''} ${hint && geo === round.answer.geo ? 'ring-4 ring-gold ab-pulse' : ''} ${answered && geo !== round.answer.geo ? 'opacity-30' : ''}`}
                >{geo}</button>
            ))}
          </div>
        )}
        {done && <div className="w-full max-w-[340px] mx-auto"><Button onClick={() => { haptic('tap'); onDone() }}>дальше →</Button></div>}
      </div>
    </GameFrame>
  )
}

function Bubble({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <div className={`max-w-[78%] rounded-2xl border-[1.5px] border-jewelInk px-3 py-2 ${side === 'left' ? 'bg-cream-tile rounded-bl-md self-start' : 'bg-navy text-cream rounded-br-md self-end'}`} style={{ boxShadow: '2px 2px 0 #15100A' }}>
      {children}
    </div>
  )
}
