import React, { useEffect, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import '../games/alphabet.css'
import { BackIcon } from '../games/GameFrame'
import { haptic, sound } from '../games/fx'
import { LESSON_COUNT, LESSON_WORDS } from '../games/data'
import { lessonLetters } from '../games/logic'

/**
 * Начало урока алфавита — вместо стены теории. «Сегодня 3 новые буквы»: три карточки рубашкой вверх
 * (каждая откроется своей сценой знакомства в уроке), одна строка — что прочитаешь к концу урока,
 * и большая кнопка «Начать». Теория урока не пропала — «подробнее» открывает её свёрнутой панелью.
 * Всё помещается в экран без прокрутки.
 */
export default function LessonOpener({ lessonId, onBack, onStart, details }: {
  lessonId: number
  onBack: () => void
  onStart: () => void
  /** Теория урока — показываем только по «подробнее». */
  details: React.ReactNode
}) {
  const letters = lessonLetters(lessonId)
  const words = (LESSON_WORDS[lessonId - 1] ?? []).slice(0, 3).map(([g]) => g)
  const [wiggle, setWiggle] = useState<number | null>(null)
  const [more, setMore] = useState(false)

  // Карточки раздаются по одной (анимация ab-deal с задержкой) — с тихим щелчком на каждую.
  useEffect(() => {
    const ts = letters.map((_, i) => setTimeout(() => sound.snap(i * 2), 200 + i * 170))
    return () => ts.forEach(clearTimeout)
  }, [letters.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ab-screen flex flex-col bg-cream" data-testid="lesson-opener">
      <div className="shrink-0" style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => { haptic('tap'); onBack() }} aria-label="Назад"
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center" style={{ boxShadow: '2px 2px 0 #15100A' }}><BackIcon /></button>
          <div className="flex-1 mn-eyebrow text-navy text-center pr-11">урок {lessonId} из {LESSON_COUNT}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center px-5 text-center">
        <div className="ab-short:hidden"><Mascot mood="cheer" size={92} /></div>
        <h1 className="mt-1 text-[28px] ab-short:text-[24px] font-extrabold leading-tight">Сегодня {letters.length} новые буквы</h1>

        <div className="mt-5 ab-short:mt-3 flex gap-3 justify-center" data-testid="opener-cards">
          {letters.map((l, i) => (
            <button
              key={l}
              onClick={() => { haptic('soft'); sound.tick(i); setWiggle(i); setTimeout(() => setWiggle(null), 420) }}
              aria-label={`буква ${i + 1}`}
              data-testid="opener-card"
              className="ab-deal"
              style={{ animationDelay: `${200 + i * 170}ms` }}
            >
              <div className={`relative w-[92px] h-[124px] ab-short:w-[80px] ab-short:h-[108px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden ${wiggle === i ? 'ab-wobble' : 'ab-bob'}`}
                style={{ boxShadow: '4px 4px 0 #15100A', ['--d' as any]: `${i * 0.35}s`, ['--r' as any]: `${(i - 1) * 4}deg`, background: '#1B5FB0' }}>
              <div className="absolute inset-1.5 rounded-xl border border-cream/40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(253,250,239,0.16) 0 6px, transparent 6px 12px), repeating-linear-gradient(-45deg, rgba(245,184,32,0.18) 0 6px, transparent 6px 12px)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-11 h-11 rounded-full bg-gold border-[1.5px] border-jewelInk flex items-center justify-center text-[24px] font-extrabold text-jewelInk">{i + 1}</span>
              </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[14px] font-bold text-jewelInk-mid">каждая откроется в уроке</div>

        {words.length > 0 && (
          <div className="mt-5 ab-short:mt-3 w-full max-w-[340px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2.5" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="opener-words">
            <div className="text-[14px] font-bold text-jewelInk-mid">К концу урока прочитаешь</div>
            <div className="mt-1 font-geo text-[24px] font-extrabold text-navy leading-snug">{words.join(' · ')}</div>
          </div>
        )}

        <div className="mt-auto w-full max-w-[360px] flex flex-col items-center gap-1" style={{ paddingBottom: 'calc(var(--safe-b) + 14px)' }}>
          <button onClick={() => { haptic('tap'); setMore(true) }} className="h-10 text-[14px] font-bold text-jewelInk-hint underline underline-offset-4" data-testid="opener-more">подробнее</button>
          <Button onClick={() => { haptic('pop'); onStart() }}>Начать</Button>
        </div>
      </div>

      {more && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid="opener-details">
          <button className="absolute inset-0 bg-jewelInk/40" aria-label="Закрыть" onClick={() => setMore(false)} />
          <div className="relative max-h-[78%] rounded-t-3xl bg-cream border-t-[1.5px] border-jewelInk flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
              <div className="text-[17px] font-extrabold">Об уроке</div>
              <button onClick={() => setMore(false)} className="text-[14px] font-bold text-navy underline underline-offset-4">свернуть</button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 flex flex-col gap-4" style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>{details}</div>
          </div>
        </div>
      )}
    </div>
  )
}
