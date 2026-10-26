import React, { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { GEORGIAN_ALPHABET } from '../../components/AlphaIndex'
import './alphabet.css'
import { burst, flyGhost, haptic, reducedMotion, sound } from './fx'
import { learnedLetters, lessonLetters, wordsLabel } from './logic'
import { lessonInfo, positionOf, wordsUpToLesson } from '../lessons'
import { useLater } from '../../verbs/games/useLater'
import { api } from '../../api'
import { DictChip } from '../words/WordIntro'
import type { QuizQuestion } from '../../types'

/**
 * Праздник конца урока (только если урок засчитан). Засчитан с одной ошибкой — праздник тот же, а под ним
 * тихая строка: ошибка небольшая, вот как правильно.
 * Урок букв: три новые буквы влетают в «Мой алфавит», конфетти, Бомбора прыгает.
 * Урок слов: счётчик слов догоняет новое число; слова урока по-настоящему ложатся в «Словарь» (сервер сам
 * решает, какие, — POST vocabulary/alphabet-words) и по одному влетают в чип «Словарь», есть кнопка открыть
 * словарь. Не вышло (нет сети, нет входа) — праздник без этой части.
 */
export default function Finale({ lessonId, slips = [], onNext, onVocabulary }: { lessonId: number; slips?: QuizQuestion[]; onNext: () => void; onVocabulary: () => void }) {
  const info = lessonInfo(lessonId)
  const lesson = lessonId
  const wordsLesson = info.kind === 'words'
  const fresh = wordsLesson ? [] : lessonLetters(info.stage)
  const before = new Set(wordsLesson ? learnedLetters(info.stage) : info.stage > 1 ? learnedLetters(info.stage - 1) : [])
  const to = wordsUpToLesson(lessonId).length
  const from = wordsLesson ? to - info.words.length : to
  const [arrived, setArrived] = useState<Set<string>>(new Set())
  const [words, setWords] = useState(from)
  const [party, setParty] = useState(false)
  const flying = useRef<(HTMLDivElement | null)[]>([])
  const cells = useRef<Record<string, HTMLDivElement | null>>({})
  const later = useLater()
  const [dict, setDict] = useState<{ word: string; translation: string }[] | null>(null)
  const [inDict, setInDict] = useState(0)
  const chip = useRef<HTMLDivElement>(null)
  const dictWords = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let alive = true
    if (!wordsLesson) return
    Promise.resolve().then(() => api.addAlphabetWords(lesson))
      .then(r => { if (alive && r?.words?.length) setDict(r.words) })
      .catch(() => { /* праздник и без словаря */ })
    return () => { alive = false }
  }, [lesson])

  // Слова влетают в «Словарь» по одному, ~0,3 с на слово — после того, как прилетели буквы.
  useEffect(() => {
    if (!dict || !party) return
    let alive = true
    const quick = reducedMotion()
    void (async () => {
      for (let i = 0; i < dict.length && alive; i++) {
        void flyGhost(dictWords.current[i], chip.current, dict[i].word, 420, 'font-geo text-[16px]')
        await new Promise(r => setTimeout(r, quick ? 0 : 300))
        if (!alive) return
        haptic('tap'); sound.snap(i)
        setInDict(i + 1)
      }
    })()
    return () => { alive = false }
  }, [dict, party]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="ab-screen flex flex-col items-center bg-cream px-5 text-center" data-testid="alphabet-finale"
      style={{ paddingTop: 'calc(var(--safe-t) + 12px)', paddingBottom: 'calc(var(--safe-b) + 14px)' }}>
      <div className={party ? 'ab-jump' : ''} key={party ? 'p' : 'w'}>
        <div className="ab-short:scale-75 ab-short:-my-3"><Mascot mood="cheer" size={104} /></div>
      </div>
      <div className="mn-eyebrow text-navy mt-1">урок {positionOf(lessonId)} пройден</div>
      <div className="mt-1 text-[24px] font-extrabold leading-tight">
        {wordsLesson
          ? <>Ты знаешь уже <span key={words} className="inline-block text-ruby ab-count tabular-nums" data-testid="finale-words">{wordsLabel(words)}</span></>
          : <>Ещё <span className="text-ruby">три буквы</span> твои</>}
      </div>

      <div className={`mt-3 ab-short:mt-1 flex gap-3 h-[60px] ab-short:h-[48px] ${wordsLesson ? 'hidden' : ''}`}>
        {fresh.map((l, i) => (
          <div
            key={l}
            ref={el => { flying.current[i] = el }}
            className={`w-[56px] h-[56px] ab-short:w-[46px] ab-short:h-[46px] rounded-xl border-[1.5px] border-jewelInk bg-gold flex items-center justify-center font-geo text-[30px] font-extrabold transition-opacity duration-200 ${arrived.has(l) ? 'opacity-0' : 'ab-bob'}`}
            style={{ boxShadow: '3px 3px 0 #15100A', ['--d' as any]: `${i * 0.2}s` }}
          >{l}</div>
        ))}
      </div>

      <div className={`${wordsLesson ? 'hidden' : ''} mt-3 ab-short:mt-2 w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3 ab-short:p-2`} style={{ boxShadow: '3px 3px 0 #15100A' }}>
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

      {dict && (
        <div className="mt-3 w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3 text-left" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="finale-dict">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[14px] font-extrabold leading-tight">Эти слова теперь в твоём словаре</div>
            <DictChip count={inDict} innerRef={chip} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dict.map((w, i) => (
              <span key={w.word} ref={el => { dictWords.current[i] = el }} data-testid="finale-dict-word" data-in={i < inDict ? 'yes' : 'no'}
                className={`px-2 py-0.5 rounded-lg border text-[13px] transition-opacity duration-200 ${i < inDict ? 'opacity-40 border-jewelInk/20' : 'border-jewelInk/40'}`}>
                <span className="font-geo font-extrabold">{w.word}</span> <span className="text-jewelInk-mid">{w.translation}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {slips.length > 0 && (
        <div className="mt-3 w-full max-w-[360px] rounded-2xl border border-jewelInk/30 bg-cream-tile px-3 py-2.5 text-left" data-testid="finale-slip">
          <div className="text-[13px] font-extrabold">Одна небольшая ошибка — не страшно, урок засчитан</div>
          {slips.map(q => (
            <div key={q.id} className="mt-1 text-[13px] text-jewelInk-mid">{q.explanation || `${q.question} — ${q.options[q.answerIndex]}`}</div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3 w-full max-w-[360px] flex flex-col gap-2">
        {dict && <Button variant="ghost" onClick={() => { haptic('tap'); onVocabulary() }}>открыть словарь</Button>}
        <Button onClick={() => { haptic('tap'); onNext() }}>итог →</Button>
      </div>
    </div>
  )
}
