import { lessonFlow } from '../../analytics/lessonEvents'
import React, { useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from '../games/GameFrame'
import '../games/alphabet.css'
import { burst, flyGhost, haptic, playClip, sound } from '../games/fx'
import { WORD_AUDIO } from '../games/data'
import type { Word } from '../games/logic'
import { cyr } from '../../verbs/types'
import { useRowFit } from '../games/fit'
import { useLater } from '../../verbs/games/useLater'
import { ProductArt } from '../cafe/art'
import { PRODUCTS } from '../cafe/products'

/**
 * «Новое слово» — событие, а не строчка в вопросе. Как только открытых букв хватает на слово урока,
 * урок останавливается: «Тебе хватает букв, чтобы прочитать новое слово!». Слово лежит плитками
 * из уже знакомых букв; ведёшь пальцем или тапаешь по ним по порядку — каждая загорается с тиком.
 * Последняя — слово схлопывается, под ним кириллицей «как звучит» (и запись, если она есть),
 * карточка переворачивается значением, слово улетает в «Словарь». Так — каждое новое слово урока
 * (в уроке слов их 2–4), без «остальных списком».
 */

type Phase = 'tap' | 'read' | 'meaning'

const DictIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15100A" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="#C9DBF0" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" fill="#FDFAEF" />
    <path d="M8 8h8M8 11.5h6" />
  </svg>
)

export function DictChip({ count, innerRef }: { count: number; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={innerRef} key={count} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream-tile border-[1.5px] border-jewelInk text-[13px] font-extrabold ab-count" style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="dict-chip">
      <DictIcon />Словарь <span className="tabular-nums" data-testid="dict-count">{count}</span>
    </div>
  )
}

export default function WordIntro({ featured, startCount, fraction, onExit, onDone }: {
  /** Все новые слова урока — каждое своей сценой. */
  featured: Word[]
  /** Сколько слов в «Словаре» до этого урока (для счётчика на чипе). */
  startCount: number
  fraction: number
  onExit: () => void
  onDone: () => void
}) {
  const [wi, setWi] = useState(0)
  const [lit, setLit] = useState(0)
  const [phase, setPhase] = useState<Phase>('tap')
  const [shake, setShake] = useState<number | null>(null)
  const [count, setCount] = useState(startCount)
  const chip = useRef<HTMLDivElement>(null)
  const wordEl = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const later = useLater()
  const word = featured[wi]
  const letters = word ? [...word.geo] : []
  const audio = word ? WORD_AUDIO[word.geo] : undefined
  const picture = word ? PRODUCTS.find(p => p.geo === word.geo)?.id : undefined

  function light(i: number) {
    if (phase !== 'tap') return
    if (i < lit) return
    if (i > lit) { haptic('bad'); setShake(i); later(() => setShake(null), 380); return }
    haptic('tap'); sound.snap(i)
    const next = i + 1
    setLit(next)
    if (next === letters.length) complete()
  }

  function complete() {
    setLit(letters.length)
    setPhase('read')
    // Запись — прямо в касании: так iOS точно даст ей прозвучать.
    if (audio) void playClip(audio)
    later(() => { haptic('good'); sound.snap(8); burst(wordEl.current, 'small') }, 160)
    later(() => { haptic('soft'); setPhase('meaning') }, 1300)
  }

  function skip() {
    lessonFlow.skip()
    haptic('tap')
    if (audio) void playClip(audio)
    setLit(letters.length); setPhase('meaning')
  }

  async function toDictionary() {
    haptic('tap')
    await flyGhost(wordEl.current, chip.current, word.geo, 520, 'font-geo')
    haptic('snap'); sound.snap(4)
    setCount(c => c + 1)
    if (wi + 1 < featured.length) { setWi(wi + 1); setLit(0); setPhase('tap') }
    else onDone()
  }

  /** Палец ведёт по плиткам: зажигаем ту, над которой он сейчас. */
  function swipe(e: React.PointerEvent) {
    if (!e.buttons && e.pointerType !== 'touch') return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const i = Number(el?.closest('[data-tile]')?.getAttribute('data-tile'))
    if (Number.isInteger(i) && i === lit) light(i)
  }

  const joined = phase !== 'tap'
  // Плитки по ширине экрана: длинное слово (საქართველო) — плитки мельче, а если и так не влезает — в две строки.
  const fit = useRowFit(box, letters.length, 30, 56, joined ? 0 : 6)
  // Две строки плиток на низком экране — плитки ниже, чтобы кнопки внизу оставались на экране.
  const tileH = Math.round(fit.size * (fit.perRow < letters.length ? 1.05 : 1.25))
  const font = Math.round(fit.size * 0.66)
  return (
    <GameFrame title="Новое слово" eyebrow={`новое слово · ${wi + 1} из ${featured.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col items-center gap-3 ab-short:gap-2" data-testid="word-intro" data-phase={phase}>
        <div className="w-full flex items-center justify-between gap-3">
          <div className="text-[14px] font-bold text-jewelInk-mid leading-snug">Тебе хватает букв, чтобы прочитать новое слово!</div>
          <DictChip count={count} innerRef={chip} />
        </div>

        <div ref={box} className="w-full flex justify-center">
        <div
          ref={wordEl}
          key={wi + (joined ? '-j' : '')}
          className={`flex flex-wrap justify-center select-none ${joined ? 'ab-boom' : ''}`}
          style={{ touchAction: 'none', gap: joined ? 0 : 6, maxWidth: fit.perRow * fit.size + (fit.perRow - 1) * (joined ? 0 : 6) + 1 }}
          onPointerMove={swipe}
          data-testid="word-tiles"
        >
          {letters.map((l, i) => {
            const on = i < lit
            return (
              <button
                key={i}
                data-tile={i}
                data-testid="word-tile"
                data-on={on ? 'yes' : 'no'}
                aria-label={l}
                onPointerDown={e => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); light(i) }}
                className={`shrink-0 font-geo font-extrabold flex items-center justify-center transition-all duration-200 ${
                  joined ? 'bg-transparent text-navy' : on ? 'rounded-xl border-[1.5px] border-jewelInk bg-navy text-cream ab-snap' : 'rounded-xl border-[1.5px] border-jewelInk bg-cream-tile'} ${
                  !joined && i === lit ? 'ab-pulse' : ''} ${shake === i ? 'ab-shake' : ''}`}
                style={{ width: joined ? undefined : fit.size, height: tileH, fontSize: font, ...(!joined ? { boxShadow: '3px 3px 0 #15100A' } : {}) }}
              >{l}</button>
            )
          })}
        </div>
        </div>

        <div className="h-7 text-[20px] font-extrabold text-jewelInk-mid" data-testid="word-sound">
          {joined && <span className="ab-drip inline-block">«{cyr(word.geo)}»</span>}
        </div>

        <div className="ab-flip w-full max-w-[300px] h-[150px] ab-short:h-[110px] shrink min-h-[90px]" data-flipped={phase === 'meaning' ? 'yes' : 'no'}>
          <div className="ab-flip-inner">
            <div className="ab-flip-face rounded-2xl border-[1.5px] border-jewelInk bg-cream-deep flex items-center justify-center text-[15px] font-bold text-jewelInk-hint" style={{ boxShadow: '3px 3px 0 #15100A' }}>
              {phase === 'tap' ? 'Веди пальцем по буквам слева направо' : 'что это значит?'}
            </div>
            <div className="ab-flip-face ab-flip-back rounded-2xl border-[1.5px] border-jewelInk bg-gold-wash flex flex-col items-center justify-center gap-1" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="word-meaning">
              {picture && <ProductArt id={picture} size={54} />}
              <div className="text-[26px] font-extrabold leading-tight">{word.ru}</div>
            </div>
          </div>
        </div>

        <div className="mt-auto shrink-0 w-full max-w-[340px] flex flex-col gap-2">
          {phase === 'meaning'
            ? <Button onClick={() => void toDictionary()}>в словарь →</Button>
            : <button onClick={skip} className="h-11 text-[14px] font-bold text-jewelInk-hint underline underline-offset-4" data-testid="word-skip">пропустить</button>}
        </div>
      </div>
    </GameFrame>
  )
}
