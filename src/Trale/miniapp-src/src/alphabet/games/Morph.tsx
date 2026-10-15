import React, { useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from './GameFrame'
import { burst, haptic, sound } from './fx'
import { letterChoices, morphPieces, morphWords, type Rng, type Word, type WordPool } from './logic'
import { cyr } from '../../verbs/types'
import { useLater } from '../../verbs/games/useLater'

/**
 * «Превращение»: настоящее грузинское слово, написанное кириллицей, как оно звучит («дэда»). Подсвечен
 * звук; тапаешь нужную грузинскую букву — кириллица стекает вниз, грузинская буква капает на её место.
 * Две ошибки подряд — подсвечиваем верную плитку. В конце слово целиком грузинское (დედა) и что оно значит.
 * Слова — только из букв, открытых к этому уроку (logic.morphWords).
 */
export default function Morph({ lesson, fraction, onExit, onDone, rng = Math.random, words: given, pool }: {
  lesson: number
  /** Слова урока слов и уже знакомые слова. */
  pool?: WordPool
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  /** Для тестов: какие слова превращать. */
  words?: Word[]
}) {
  const words = useMemo(() => given ?? morphWords(lesson, 2, rng, pool), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps
  const [wi, setWi] = useState(0)
  const pieces = useMemo(() => morphPieces(words[wi]?.geo ?? ''), [words, wi])
  const [turned, setTurned] = useState<Set<number>>(new Set())
  const [misses, setMisses] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const wordRef = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLSpanElement | null)[]>([])
  const later = useLater()

  const pos = pieces.findIndex((p, i) => p.geo && !turned.has(i))
  const done = pos < 0
  const answer = done ? null : pieces[pos].geo!
  const choices = useMemo(() => (answer ? letterChoices(answer, lesson, rng) : []), [answer, wi, turned.size]) // eslint-disable-line react-hooks/exhaustive-deps

  if (words.length === 0) { later(onDone, 0); return null }

  function choose(letter: string) {
    if (!answer) return
    if (letter !== answer) {
      haptic('bad'); sound.miss()
      setMisses(m => m + 1); setStreak(0)
      setShake(letter); later(() => setShake(null), 400)
      return
    }
    haptic('pop'); sound.morph(streak)
    setStreak(s => s + 1); setMisses(0)
    const next = new Set(turned); next.add(pos)
    setTurned(next)
    burst(tiles.current[pos], 'small')
    if (!pieces.some((p, i) => p.geo && !next.has(i))) {
      later(() => { haptic('good'); sound.win(); burst(wordRef.current, 'big') }, 380)
    }
  }

  function nextWord() {
    haptic('tap')
    if (wi + 1 >= words.length) return onDone()
    setWi(wi + 1); setTurned(new Set()); setMisses(0)
  }

  const total = pieces.filter(p => p.geo).length
  const big = pieces.length > 6 ? 'text-[34px] w-[38px]' : 'text-[42px] w-[48px]'

  return (
    <GameFrame title="Преврати слово в грузинское" eyebrow={`превращение · слово ${wi + 1} из ${words.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div
          ref={wordRef}
          key={wi + (done ? '-done' : '')}
          data-testid="morph-word"
          className={`rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-5 w-full flex justify-center gap-1 ${done ? 'ab-boom bg-navy-wash' : ''}`}
          style={{ boxShadow: '4px 4px 0 #15100A' }}
        >
          {pieces.map((p, i) => {
            const isTurned = turned.has(i)
            const isNext = i === pos
            return (
              <span
                key={i}
                ref={el => { tiles.current[i] = el }}
                data-testid={`morph-tile-${i}`}
                data-turned={isTurned ? 'yes' : 'no'}
                className={`relative inline-flex h-[64px] items-end justify-center font-extrabold leading-none ${big} ${
                  isNext ? 'rounded-lg bg-gold-wash ab-pulse' : ''} ${shake && isNext ? 'ab-shake' : ''}`}
              >
                {isTurned ? (
                  <>
                    <span className="absolute inset-x-0 bottom-2 text-center font-sans text-jewelInk ab-melt" aria-hidden>{p.ru}</span>
                    <span className="font-geo text-navy ab-drip pb-2">{p.geo}</span>
                  </>
                ) : (
                  <span className={`font-sans pb-2 ${p.geo ? 'text-jewelInk' : 'text-jewelInk-hint'}`}>{p.ru}</span>
                )}
                {p.geo && !isTurned && <span className="absolute bottom-0 inset-x-1 h-[3px] rounded-full bg-gold" />}
              </span>
            )
          })}
        </div>

        <div className="text-center min-h-[44px]">
          {done ? (
            <div className="ab-drip">
              <div className="text-[18px] font-extrabold" data-testid="morph-meaning">«{cyr(words[wi].geo)}» — {words[wi].ru}</div>
            </div>
          ) : (
            <div className="text-[15px] font-bold text-jewelInk-mid">
              Какая грузинская буква — это «<span className="text-jewelInk text-[19px]">{pieces[pos].ru}</span>»?
              <div className="text-[12px] text-jewelInk-hint mt-0.5 tabular-nums">{turned.size} из {total}</div>
            </div>
          )}
        </div>

        {!done && (
          <div className="grid grid-cols-4 gap-3 w-full max-w-[340px]">
            {choices.map(l => (
              <button
                key={l}
                aria-label={l}
                data-testid="morph-choice"
                onClick={() => choose(l)}
                className={`h-[68px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile font-geo text-[34px] font-extrabold active:scale-95 transition-transform ${
                  shake === l ? 'ab-shake bg-ruby-wash' : ''} ${misses >= 2 && l === answer ? 'ring-4 ring-gold ab-pulse' : ''}`}
                style={{ boxShadow: '3px 3px 0 #15100A' }}
              >{l}</button>
            ))}
          </div>
        )}
        {done && <div className="w-full max-w-[340px]"><Button onClick={nextWord}>{wi + 1 >= words.length ? 'дальше →' : 'следующее слово →'}</Button></div>}
      </div>
    </GameFrame>
  )
}
