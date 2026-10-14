import React, { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { GEORGIAN_ALPHABET } from '../../components/AlphaIndex'
import './alphabet.css'
import { burst, flyGhost, haptic, reducedMotion, sound } from './fx'
import { learnedLetters, lessonLetters, wordCount, wordsLabel } from './logic'
import { LESSON_COUNT } from './data'
import { useLater } from '../../verbs/games/useLater'

/**
 * Праздник конца урока (только если урок засчитан): три новые буквы влетают в «Мой алфавит»,
 * счётчик слов догоняет новое число, конфетти, Бомбора прыгает. Зовёт в «Кафе Бомборы».
 */
export default function Finale({ lesson, onNext, onCafe }: { lesson: number; onNext: () => void; onCafe: () => void }) {
  const fresh = lessonLetters(lesson)
  const before = new Set(lesson > 1 ? learnedLetters(lesson - 1) : [])
  const from = lesson > 1 ? wordCount(lesson - 1) : 0
  const to = wordCount(lesson)
  const [arrived, setArrived] = useState<Set<string>>(new Set())
  const [words, setWords] = useState(from)
  const [party, setParty] = useState(false)
  const flying = useRef<(HTMLDivElement | null)[]>([])
  const cells = useRef<Record<string, HTMLDivElement | null>>({})
  const later = useLater()

  useEffect(() => {
    let alive = true
    const quick = reducedMotion()
    const run = async () => {
      await new Promise(r => setTimeout(r, quick ? 0 : 450))
      for (let i = 0; i < fresh.length && alive; i++) {
        const l = fresh[i]
        await flyGhost(flying.current[i], cells.current[l], l, 520, 'bg-navy text-cream')
        if (!alive) return
        haptic('snap'); sound.snap(i * 3)
        setArrived(s => new Set(s).add(l))
      }
      if (!alive) return
      // Счётчик слов: каждый тик — слово.
      for (let n = from + 1; n <= to && alive; n++) {
        setWords(n); sound.tick(n - from)
        await new Promise(r => setTimeout(r, quick ? 0 : 90))
      }
      if (!alive) return
      haptic('good'); sound.win(); setParty(true)
      burst(null, 'big')
      later(() => burst(null, 'big'), 260)
    }
    void run()
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const learnedCount = before.size + arrived.size
  const last = lesson >= LESSON_COUNT

  return (
    <div className="flex flex-col items-center bg-cream px-5 text-center" data-testid="alphabet-finale"
      style={{ minHeight: '100dvh', paddingTop: 'calc(var(--safe-t) + 20px)', paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
      <div className={party ? 'ab-jump' : ''} key={party ? 'p' : 'w'}>
        <Mascot mood="cheer" size={120} />
      </div>
      <div className="mn-eyebrow text-navy mt-1">урок {lesson} пройден</div>
      <div className="mt-1 text-[24px] font-extrabold leading-tight">
        Ты знаешь уже <span key={words} className="inline-block text-ruby ab-count tabular-nums" data-testid="finale-words">{wordsLabel(words)}</span>
      </div>

      <div className="mt-4 flex gap-3 h-[60px]">
        {fresh.map((l, i) => (
          <div
            key={l}
            ref={el => { flying.current[i] = el }}
            className={`w-[56px] h-[56px] rounded-xl border-[1.5px] border-jewelInk bg-gold flex items-center justify-center font-geo text-[30px] font-extrabold transition-opacity duration-200 ${arrived.has(l) ? 'opacity-0' : 'ab-bob'}`}
            style={{ boxShadow: '3px 3px 0 #15100A', ['--d' as any]: `${i * 0.2}s` }}
          >{l}</div>
        ))}
      </div>

      <div className="mt-4 w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3" style={{ boxShadow: '3px 3px 0 #15100A' }}>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[14px] font-extrabold">Мой алфавит</div>
          <div className="text-[12px] font-bold text-jewelInk-mid tabular-nums" data-testid="finale-letters">{learnedCount} из 33</div>
        </div>
        <div className="grid grid-cols-9 gap-1">
          {GEORGIAN_ALPHABET.map(l => {
            const on = before.has(l) || arrived.has(l)
            const isNew = arrived.has(l)
            return (
              <div
                key={l}
                ref={el => { cells.current[l] = el }}
                data-testid="finale-cell" data-on={on ? 'yes' : 'no'}
                className={`aspect-square rounded-md border flex items-center justify-center font-geo text-[16px] font-extrabold transition-colors duration-300 ${
                  on ? 'bg-navy text-cream border-jewelInk' : 'bg-cream-deep text-jewelInk/25 border-jewelInk/15'} ${isNew ? 'ab-snap ring-2 ring-gold' : ''}`}
              >{l}</div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto pt-5 w-full max-w-[360px] flex flex-col gap-3">
        <Button variant="blue" onClick={() => { haptic('tap'); onCafe() }}>
          {last ? 'в кафе Бомборы — со всеми буквами' : 'в кафе Бомборы с новыми буквами'}
        </Button>
        <Button onClick={() => { haptic('tap'); onNext() }}>итог →</Button>
      </div>
    </div>
  )
}
