import React, { useEffect, useMemo, useState } from 'react'
import GameFrame, { SoundIcon } from './GameFrame'
import { haptic, isMuted, playClip, sound } from './fx'
import { soundRounds, type Rng, type SoundRound } from './logic'
import { WORD_AUDIO } from './data'
import { introOf, transcriptionOf, wordParts } from '../intro/letters'
import { useLater } from '../../verbs/games/useLater'

/**
 * «Звук → буква»: звучит знакомое слово (საზამთრო — то, что было под коркой арбуза), выбери букву,
 * с которой оно начинается. Без звука — подсказка кириллицей. Первый раунд — с подсветкой верной буквы.
 */
export default function SoundLetter({ lesson, fraction, onExit, onDone, rng = Math.random, rounds: given }: {
  lesson: number
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  rounds?: SoundRound[]
}) {
  const rounds = useMemo(() => given ?? soundRounds(lesson, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const [misses, setMisses] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const later = useLater()
  const round = rounds[ri]
  const intro = round ? introOf(round.letter) : undefined
  const url = intro ? WORD_AUDIO[intro.word] : undefined
  const say = () => { if (url) void playClip(url) }
  useEffect(() => { if (ri > 0) say() }, [ri]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!round || !intro) { later(onDone, 0); return null }
  const guide = (ri === 0 || misses >= 2) && !solved

  function choose(l: string) {
    if (solved) return
    if (l !== round.letter) {
      haptic('bad'); sound.miss(); setMisses(m => m + 1); setShake(l); later(() => setShake(null), 380)
      return
    }
    haptic('good'); sound.snap(ri * 3); setSolved(true)
    later(() => {
      if (ri + 1 >= rounds.length) onDone()
      else { setRi(ri + 1); setMisses(0); setSolved(false) }
    }, 1200)
  }

  return (
    <GameFrame title="Звук → буква" eyebrow={`звук и буква · ${ri + 1} из ${rounds.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5" data-testid="sound-letter">
        <div className="text-[15px] font-bold text-jewelInk-mid text-center">Послушай слово. С какой буквы оно начинается?</div>
        <button onClick={() => { haptic('tap'); say() }} aria-label="Послушать слово" data-testid="sound-play"
          className="w-[96px] h-[96px] rounded-full bg-gold border-[1.5px] border-jewelInk flex items-center justify-center active:scale-95" style={{ boxShadow: '3px 3px 0 #15100A' }}>
          <SoundIcon on size={44} />
        </button>
        <div className="h-[48px] text-center" data-testid="sound-word">
          {solved
            ? <div className="ab-drip"><div className="font-geo text-[28px] font-extrabold leading-none">{wordParts(intro).map((p, i) => <span key={i} className={p.own ? 'text-ruby' : 'text-jewelInk/50'}>{p.ch}</span>)}</div><div className="text-[14px] font-bold">{transcriptionOf(intro)} — {intro.ru}</div></div>
            : (misses > 0 || isMuted()) && <div className="text-[16px] font-bold text-jewelInk-hint">«{transcriptionOf(intro)}»</div>}
        </div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
          {round.choices.map(l => (
            <button key={l} aria-label={l} data-testid="sound-choice" onClick={() => choose(l)}
              className={`h-[78px] rounded-2xl border-[1.5px] border-jewelInk font-geo text-[40px] font-extrabold active:scale-95 transition-transform ${
                solved && l === round.letter ? 'bg-navy text-cream ab-boom' : 'bg-cream-tile'} ${shake === l ? 'ab-shake bg-ruby-wash' : ''} ${guide && l === round.letter ? 'ring-4 ring-gold ab-pulse' : ''}`}
              style={{ boxShadow: '3px 3px 0 #15100A' }}>{l}</button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
