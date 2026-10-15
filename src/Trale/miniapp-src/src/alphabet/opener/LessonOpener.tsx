import React, { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import '../games/alphabet.css'
import { BackIcon } from '../games/GameFrame'
import { haptic, sound } from '../games/fx'
import { useRowFit } from '../games/fit'
import { recapLetter } from '../known'
import { lessonLetters, wordsLabel } from '../games/logic'
import { LESSON_TOTAL, lessonInfo, nextWordsLesson, positionOf } from '../lessons'

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
  const info = lessonInfo(lessonId)
  const isWords = info.kind === 'words'
  // Урок букв — три карточки букв; урок слов — карточка на каждое новое слово.
  const letters = isWords ? info.words.map(w => w.geo) : lessonLetters(info.stage)
  const after = isWords ? undefined : nextWordsLesson(lessonId)
  const words = after ? after.words.map(w => w.geo) : []
  const [wiggle, setWiggle] = useState<number | null>(null)
  const [more, setMore] = useState(false)
  const cardsBox = useRef<HTMLDivElement>(null)
  const card = useRowFit(cardsBox, letters.length, 56, 92, 12).size
  // Буква, открытая в знакомстве с приложением, лежит лицом вверх с пометкой «уже знаешь».
  const known = (l: string) => !isWords && recapLetter(lessonId, l)

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
          <div className="flex-1 mn-eyebrow text-navy text-center pr-11">урок {positionOf(lessonId)} из {LESSON_TOTAL}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center px-5 text-center">
        <div className="ab-short:hidden"><Mascot mood="cheer" size={92} /></div>
        <h1 className="mt-1 text-[28px] ab-short:text-[24px] font-extrabold leading-tight">
          {isWords ? `Сегодня ${wordsLabel(letters.length).replace('грузинских ', 'новых ').replace('грузинское ', 'новое ')}` : letters.some(known) ? `Одну букву ты уже знаешь, ещё ${letters.filter(l => !known(l)).length} — новые` : `Сегодня ${letters.length} новые буквы`}
        </h1>

        <div ref={cardsBox} className="mt-5 ab-short:mt-3 w-full flex gap-3 justify-center" data-testid="opener-cards">
          {letters.map((l, i) => (
            <button
              key={l}
              onClick={() => { haptic('soft'); sound.tick(i); setWiggle(i); setTimeout(() => setWiggle(null), 420) }}
              aria-label={isWords ? `слово ${i + 1}` : `буква ${i + 1}`}
              data-testid="opener-card"
              className="ab-deal"
              style={{ animationDelay: `${200 + i * 170}ms` }}
            >
              {known(l) ? (
              <div className={`relative rounded-2xl border-[1.5px] border-jewelInk overflow-hidden bg-cream-tile flex flex-col items-center justify-center ${wiggle === i ? 'ab-wobble' : 'ab-bob'}`} data-known="yes"
                style={{ width: card, height: Math.round(card * 1.35), boxShadow: '4px 4px 0 #15100A', ['--d' as any]: `${i * 0.35}s`, ['--r' as any]: `${(i - 1) * 4}deg` }}>
                <span className="font-geo font-extrabold text-navy leading-none" style={{ fontSize: Math.round(card * 0.55) }}>{l}</span>
                <span className="absolute bottom-1.5 inset-x-1 rounded-md bg-gold text-[10px] font-extrabold leading-tight py-0.5">уже знаешь</span>
              </div>
              ) : (
              <div className={`relative rounded-2xl border-[1.5px] border-jewelInk overflow-hidden ${wiggle === i ? 'ab-wobble' : 'ab-bob'}`}
                style={{ width: card, height: Math.round(card * 1.35), boxShadow: '4px 4px 0 #15100A', ['--d' as any]: `${i * 0.35}s`, ['--r' as any]: `${(i - 1) * 4}deg`, background: '#1B5FB0' }}>
              <div className="absolute inset-1.5 rounded-xl border border-cream/40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(253,250,239,0.16) 0 6px, transparent 6px 12px), repeating-linear-gradient(-45deg, rgba(245,184,32,0.18) 0 6px, transparent 6px 12px)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-11 h-11 rounded-full bg-gold border-[1.5px] border-jewelInk flex items-center justify-center text-[24px] font-extrabold text-jewelInk">{i + 1}</span>
              </div>
              </div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 text-[14px] font-bold text-jewelInk-mid">{isWords ? 'каждое покажем отдельно — и поиграем с ним' : 'каждая откроется в уроке'}</div>

        {words.length > 0 && (
          <div className="mt-5 ab-short:mt-3 w-full max-w-[340px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2.5" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="opener-words">
            <div className="text-[14px] font-bold text-jewelInk-mid">А в следующем уроке прочитаешь</div>
            <div className="mt-1 font-geo text-[22px] font-extrabold text-navy leading-snug break-words">{words.join(' · ')}</div>
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
