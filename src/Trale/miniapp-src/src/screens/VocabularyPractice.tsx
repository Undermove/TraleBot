import React, { useEffect, useMemo, useState } from 'react'
import Button from '../components/Button'
import LoaderLetter from '../components/LoaderLetter'
import { ProgressState, Screen } from '../types'
import {
  api,
  ApiError,
  VocabularyQuizMode,
  VocabularyQuizQuestion,
  VocabularyWordPair
} from '../api'
import { progressFromDto } from '../progress'

interface Props {
  mode: VocabularyQuizMode
  wordIds?: string[]
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  authenticated: boolean
  navigate: (s: Screen) => void
}

/**
 * 4-round vocabulary quiz — like the original bot:
 *  Round 1: multi-choice GE → RU
 *  Round 2: multi-choice RU → GE
 *  Round 3: type-in GE → RU
 *  Round 4: type-in RU → GE
 */

interface QuizItem {
  wordId: string | null
  prompt: string
  correct: string
  options?: string[] // present for multi-choice, absent for type-in
  direction: 'ge-to-ru' | 'ru-to-ge'
  type: 'multi-choice' | 'type-in'
  roundLabel: string
}

type Phase = 'loading' | 'answering' | 'checked' | 'error' | 'empty' | 'auth-required'

export default function VocabularyPractice({
  mode,
  wordIds,
  progress,
  setProgress,
  authenticated,
  navigate
}: Props) {
  const [allItems, setAllItems] = useState<QuizItem[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [selected, setSelected] = useState<number | null>(null)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .startVocabularyQuiz({ mode, wordIds, count: 5 })
      .then((r) => {
        if (cancelled) return
        if (!r.questions.length) {
          setPhase('empty')
          return
        }

        const pairs = r.wordPairs ?? []
        const poolRu = r.allRussian ?? []
        const poolGe = r.allGeorgian ?? []

        // Build 4 rounds
        const items: QuizItem[] = []

        // Round 1: multi-choice GE → RU
        for (const p of pairs) {
          const distractors = shuffle(poolRu.filter((w) => w !== p.russian)).slice(0, 3)
          const options = shuffle([...distractors, p.russian])
          items.push({
            wordId: p.wordId,
            prompt: p.georgian,
            correct: p.russian,
            options,
            direction: 'ge-to-ru',
            type: 'multi-choice',
            roundLabel: 'ქართული → русский'
          })
        }

        // Round 2: multi-choice RU → GE (use existing questions)
        for (const q of r.questions) {
          items.push({
            wordId: q.wordId,
            prompt: q.question,
            correct: q.options[q.answerIndex],
            options: q.options,
            direction: 'ru-to-ge',
            type: 'multi-choice',
            roundLabel: 'русский → ქართული'
          })
        }

        // Round 3: type-in GE → RU
        for (const p of pairs) {
          items.push({
            wordId: p.wordId,
            prompt: p.georgian,
            correct: p.russian,
            direction: 'ge-to-ru',
            type: 'type-in',
            roundLabel: 'напиши перевод'
          })
        }

        // Round 4: type-in RU → GE
        for (const p of pairs) {
          items.push({
            wordId: p.wordId,
            prompt: p.russian,
            correct: p.georgian,
            direction: 'ru-to-ge',
            type: 'type-in',
            roundLabel: 'напиши по-грузински'
          })
        }

        setAllItems(items)
        setPhase('answering')
      })
      .catch((e) => {
        if (cancelled) return
        setPhase(
          e instanceof ApiError && e.status === 401 ? 'auth-required' : 'error'
        )
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (phase === 'loading') {
    return (
      <FullScreen>
        <LoaderLetter label="словарь..." />
      </FullScreen>
    )
  }

  if (phase === 'empty') {
    return (
      <FullScreen>
        <div className="mn-eyebrow">тут пусто</div>
        <div className="font-sans text-[20px] font-extrabold text-jewelInk max-w-[300px] text-center">
          Нет слов для квиза
        </div>
        <div className="w-full max-w-[280px] mt-4">
          <Button variant="ghost" onClick={() => navigate({ kind: 'vocabulary-list' })}>
            ← к словарю
          </Button>
        </div>
      </FullScreen>
    )
  }

  if (phase === 'error' || phase === 'auth-required') {
    return (
      <FullScreen>
        <div className="mn-eyebrow">{phase === 'auth-required' ? 'нужен telegram' : 'ой'}</div>
        <div className="font-sans text-[14px] text-jewelInk-mid max-w-[320px] text-center">
          {phase === 'auth-required'
            ? 'Открой мини-апп через кнопку «🐶 Бомбора» в боте.'
            : 'Что-то сломалось. Попробуй ещё раз.'}
        </div>
        <div className="w-full max-w-[280px] mt-4">
          <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
            ← на главную
          </Button>
        </div>
      </FullScreen>
    )
  }

  const current = allItems[index]
  const total = allItems.length
  const questionNumber = index + 1
  const pct = Math.round((questionNumber / total) * 100)

  function checkMultiChoice() {
    if (selected === null || !current.options) return
    setPhase('checked')
    const correct = current.options[selected] === current.correct
    setIsCurrentCorrect(correct)
    if (correct) setCorrectCount((c) => c + 1)
    if (current.wordId) {
      api.recordVocabularyAnswer({
        wordId: current.wordId,
        correct,
        direction: current.direction
      }).catch(() => {})
    }
  }

  function checkTypeIn() {
    const trimmed = typedAnswer.trim()
    if (!trimmed) return
    setPhase('checked')
    const correct = trimmed.toLowerCase() === current.correct.toLowerCase()
    setIsCurrentCorrect(correct)
    if (correct) setCorrectCount((c) => c + 1)
    if (current.wordId) {
      api.recordVocabularyAnswer({
        wordId: current.wordId,
        correct,
        direction: current.direction
      }).catch(() => {})
    }
  }

  async function next() {
    if (index + 1 >= total) {
      const finalCorrect = correctCount
      let xpEarned = Math.round((finalCorrect / total) * 20)

      if (authenticated) {
        try {
          const r = await api.completeLesson({
            moduleId: 'vocabulary',
            lessonId: 0,
            correct: finalCorrect,
            total
          })
          setProgress(progressFromDto(r.progress))
          xpEarned = r.xpEarned
        } catch {
          setProgress({ ...progress, xp: progress.xp + xpEarned })
        }
      } else {
        setProgress({ ...progress, xp: progress.xp + xpEarned })
      }

      navigate({
        kind: 'result',
        moduleId: 'vocabulary',
        lessonId: 0,
        correct: finalCorrect,
        total,
        xpEarned
      })
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setTypedAnswer('')
    setIsCurrentCorrect(false)
    setPhase('answering')
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm"
        style={{ paddingTop: 'var(--safe-t)' }}
      >
        <div className="mn-kilim" />
        <div className="px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate({ kind: 'vocabulary-list' })}
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-75"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
            aria-label="Закрыть"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 3 L13 13 M13 3 L3 13" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="flex-1 h-3 bg-cream-deep border-[1.5px] border-jewelInk rounded-full overflow-hidden"
            style={{ boxShadow: 'inset 1px 1px 0 rgba(21,16,10,0.1)' }}
          >
            <div
              className="h-full bg-gold transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="shrink-0 font-sans text-[13px] font-bold text-jewelInk tabular-nums min-w-[38px] text-right">
            <span>{questionNumber}</span>
            <span className="text-jewelInk-hint">/{total}</span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div
        className="flex-1 px-5 pt-6"
        style={{ paddingBottom: 'calc(var(--safe-b) + 110px)' }}
      >
        <div className="mn-eyebrow mb-2">{current.roundLabel}</div>

        {current.type === 'multi-choice' && current.direction === 'ge-to-ru' ? (
          <h2 className="font-geo text-[28px] font-extrabold text-jewelInk leading-tight">
            {current.prompt}
          </h2>
        ) : current.type === 'multi-choice' ? (
          <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
            {current.prompt}
          </h2>
        ) : (
          <div>
            <div className="font-sans text-[14px] text-jewelInk-mid mb-2">
              {current.direction === 'ge-to-ru'
                ? 'Напиши перевод на русский:'
                : 'Напиши по-грузински:'}
            </div>
            <h2
              className={`text-[28px] font-extrabold text-jewelInk leading-tight ${
                current.direction === 'ge-to-ru' ? 'font-geo' : 'font-sans'
              }`}
            >
              {current.prompt}
            </h2>
          </div>
        )}

        {/* Multi-choice options */}
        {current.type === 'multi-choice' && current.options && (
          <div className="mt-6 flex flex-col gap-3">
            {current.options.map((opt, i) => {
              const isSelected = i === selected
              const isAnswer = opt === current.correct

              let tileClasses = 'bg-cream-tile border-jewelInk text-jewelInk'
              let shadowStyle = '3px 3px 0 #15100A'

              if (phase === 'answering' && isSelected) {
                tileClasses = 'bg-navy border-jewelInk text-cream'
              }
              if (phase === 'checked') {
                if (isAnswer) {
                  tileClasses = 'bg-navy border-jewelInk text-cream'
                } else if (isSelected) {
                  tileClasses = 'bg-ruby border-jewelInk text-cream'
                  shadowStyle = '1px 1px 0 #15100A'
                } else {
                  tileClasses = 'bg-cream-tile border-jewelInk/25 text-jewelInk/40'
                  shadowStyle = 'none'
                }
              }

              const fontClass =
                current.direction === 'ge-to-ru' ? 'font-sans text-[16px]' : 'font-geo text-[17px]'

              return (
                <button
                  key={i}
                  disabled={phase === 'checked'}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left px-4 py-4 border-[1.5px] rounded-xl transition-all duration-75 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-3 ${tileClasses}`}
                  style={{ boxShadow: shadowStyle }}
                >
                  <span className="shrink-0 w-7 h-7 rounded-md border-[1.5px] flex items-center justify-center font-sans text-[12px] font-extrabold uppercase bg-cream-deep text-jewelInk border-jewelInk/30">
                    {String.fromCharCode(97 + i)}
                  </span>
                  <span className={`flex-1 font-semibold ${fontClass}`}>{opt}</span>
                  {phase === 'checked' && isAnswer && (
                    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 text-cream">
                      <path d="M3 9 L7 13 L15 4" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Type-in input */}
        {current.type === 'type-in' && (
          <div className="mt-6">
            <input
              className={`w-full bg-cream-tile border-[1.5px] rounded-xl px-4 py-4 font-semibold text-[17px] outline-none transition-all ${
                phase === 'checked'
                  ? isCurrentCorrect
                    ? 'border-navy bg-navy/5 text-navy'
                    : 'border-ruby bg-ruby/5 text-ruby'
                  : 'border-jewelInk text-jewelInk focus:border-navy'
              } ${current.direction === 'ru-to-ge' ? 'font-geo' : 'font-sans'}`}
              style={{ boxShadow: phase === 'checked' ? 'none' : '3px 3px 0 #15100A' }}
              placeholder={
                current.direction === 'ge-to-ru' ? 'введи перевод...' : 'введи слово...'
              }
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              disabled={phase === 'checked'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && phase === 'answering') checkTypeIn()
              }}
            />
          </div>
        )}

        {/* Feedback */}
        {phase === 'checked' && (
          <div
            className={`mt-6 p-4 border-[1.5px] rounded-xl ${
              isCurrentCorrect
                ? 'bg-navy border-jewelInk text-cream'
                : 'bg-ruby border-jewelInk text-cream'
            }`}
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            <div className="font-sans text-[13px] font-extrabold uppercase tracking-wider mb-1 opacity-90">
              {isCurrentCorrect ? 'верно' : 'правильный ответ'}
            </div>
            {!isCurrentCorrect && (
              <div
                className={`text-[18px] font-bold ${
                  current.direction === 'ru-to-ge' ? 'font-geo' : 'font-sans'
                }`}
              >
                {current.correct}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {phase === 'answering' ? (
          current.type === 'multi-choice' ? (
            <Button
              variant="primary"
              disabled={selected === null}
              onClick={checkMultiChoice}
            >
              проверить
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!typedAnswer.trim()}
              onClick={checkTypeIn}
            >
              проверить
            </Button>
          )
        ) : (
          <Button variant={isCurrentCorrect ? 'green' : 'primary'} onClick={next}>
            {index + 1 >= total ? 'итог →' : 'дальше →'}
          </Button>
        )}
      </div>
    </div>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-cream px-6 text-center gap-5"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(var(--safe-t) + 24px)',
        paddingBottom: 'calc(var(--safe-b) + 24px)'
      }}
    >
      {children}
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
