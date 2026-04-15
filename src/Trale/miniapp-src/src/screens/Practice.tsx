import React, { useEffect, useState } from 'react'
import Button from '../components/Button'
import LoaderLetter from '../components/LoaderLetter'
import { ProgressState, QuizQuestion, Screen } from '../types'
import { progressFromDto } from '../progress'
import { api } from '../api'

interface Props {
  moduleId: string
  lessonId: number
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  authenticated: boolean
  navigate: (s: Screen) => void
}

type Phase = 'loading' | 'answering' | 'checked' | 'error'

export default function Practice({
  moduleId,
  lessonId,
  progress,
  setProgress,
  authenticated,
  navigate
}: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [selected, setSelected] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .lessonQuestions(moduleId, lessonId)
      .then((data) => {
        if (cancelled) return
        if (!Array.isArray(data) || data.length === 0) {
          setPhase('error')
          return
        }
        setQuestions(
          data.slice(0, 10).map((d) => ({
            id: d.id,
            lemma: d.lemma ?? '',
            question: d.question,
            options: d.options,
            answerIndex: d.answerIndex,
            explanation: d.explanation
          }))
        )
        setPhase('answering')
      })
      .catch(() => !cancelled && setPhase('error'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, lessonId])

  if (phase === 'loading') {
    return (
      <div
        className="flex flex-col items-center justify-center bg-cream"
        style={{
          minHeight: '100dvh',
          paddingTop: 'var(--safe-t)',
          paddingBottom: 'var(--safe-b)'
        }}
      >
        <LoaderLetter label="карточки..." />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center bg-cream px-6 text-center gap-5"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(var(--safe-t) + 24px)',
          paddingBottom: 'calc(var(--safe-b) + 24px)'
        }}
      >
        <div className="mn-eyebrow">страница не раскрылась</div>
        <div className="font-sans text-[20px] font-extrabold text-jewelInk">
          Вопросы не загрузились
        </div>
        <div className="font-sans text-[14px] text-jewelInk-mid max-w-[300px]">
          Проверь соединение и попробуй ещё раз.
        </div>
        <div className="w-full max-w-[280px] mt-2 flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setPhase('loading')
              api.lessonQuestions(moduleId, lessonId)
                .then((data) => {
                  if (!Array.isArray(data) || data.length === 0) {
                    setPhase('error')
                    return
                  }
                  setQuestions(
                    data.slice(0, 10).map((d) => ({
                      id: d.id, lemma: d.lemma ?? '', question: d.question,
                      options: d.options, answerIndex: d.answerIndex, explanation: d.explanation
                    }))
                  )
                  setPhase('answering')
                })
                .catch(() => setPhase('error'))
            }}
          >
            попробовать ещё раз
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate({ kind: 'lesson-theory', moduleId, lessonId })}
          >
            ← назад
          </Button>
        </div>
      </div>
    )
  }

  const current = questions[index]
  const total = questions.length
  const questionNumber = index + 1
  const pct = Math.round((questionNumber / total) * 100)

  // Georgian numerals 1-10 for passive learning
  const geoNumerals = ['ერთი', 'ორი', 'სამი', 'ოთხი', 'ხუთი', 'ექვსი', 'შვიდი', 'რვა', 'ცხრა', 'ათი']
  const geoQuestion = questionNumber <= 10 ? geoNumerals[questionNumber - 1] : null
  const geoTotal = total <= 10 ? geoNumerals[total - 1] : null
  const isCorrect = selected !== null && selected === current.answerIndex

  function check() {
    if (selected === null) return
    setPhase('checked')
    if (selected === current.answerIndex) {
      setCorrectCount((c) => c + 1)
    }
  }

  async function next() {
    if (index + 1 >= total) {
      const finalCorrect = correctCount
      const isPerfect = finalCorrect === total
      let xpEarned = isPerfect ? 20 : 0

      if (authenticated) {
        try {
          const r = await api.completeLesson({
            moduleId,
            lessonId,
            correct: finalCorrect,
            total
          })
          setProgress(progressFromDto(r.progress))
          xpEarned = r.xpEarned
        } catch {
          // Offline fallback: only mark completed if 100%
          const updatedProgress = { ...progress, xp: progress.xp + xpEarned }
          if (isPerfect) {
            updatedProgress.completedLessons = {
              ...progress.completedLessons,
              [moduleId]: Array.from(
                new Set([...(progress.completedLessons[moduleId] ?? []), lessonId])
              ).sort((a, b) => a - b)
            }
          }
          setProgress(updatedProgress)
        }
      } else {
        const updatedProgress = { ...progress, xp: progress.xp + xpEarned }
        if (isPerfect) {
          updatedProgress.completedLessons = {
            ...progress.completedLessons,
            [moduleId]: Array.from(
              new Set([...(progress.completedLessons[moduleId] ?? []), lessonId])
            ).sort((a, b) => a - b)
          }
        }
        setProgress(updatedProgress)
      }

      navigate({
        kind: 'result',
        moduleId,
        lessonId,
        correct: finalCorrect,
        total,
        xpEarned
      })
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setPhase('answering')
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* Top: close + progress */}
      <div
        className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm"
        style={{ paddingTop: 'var(--safe-t)' }}
      >
        <div className="mn-kilim" />
        <div className="px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate({ kind: 'lesson-theory', moduleId, lessonId })}
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-75"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
            aria-label="Закрыть"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="#15100A"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div
            className="flex-1 h-3 bg-cream-deep border-[1.5px] border-jewelInk rounded-full overflow-hidden"
            style={{ boxShadow: 'inset 1px 1px 0 rgba(21,16,10,0.1)' }}
          >
            <div
              className="h-full bg-navy transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="shrink-0 text-right min-w-[60px]">
            <div className="font-sans text-[13px] font-bold text-jewelInk tabular-nums">
              <span>{questionNumber}</span>
              <span className="text-jewelInk-hint">/{total}</span>
            </div>
            {geoQuestion && geoTotal && (
              <div className="font-geo text-[10px] text-jewelInk-mid leading-none mt-0.5">
                {geoQuestion} / {geoTotal}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question + options */}
      <div
        className="flex-1 px-5 pt-6"
        style={{ paddingBottom: 'calc(var(--safe-b) + 110px)' }}
      >
        <div className="mn-eyebrow mb-2">
          вопрос № {questionNumber}{geoQuestion ? ` · ${geoQuestion}` : ''}
        </div>
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
          {current.question}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {current.options.map((opt, i) => {
            const isSelected = i === selected
            const isAnswer = i === current.answerIndex

            let tileClasses =
              'bg-cream-tile border-jewelInk text-jewelInk'
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

            return (
              <button
                key={i}
                disabled={phase === 'checked'}
                onClick={() => setSelected(i)}
                className={`w-full text-left px-4 py-4 border-[1.5px] rounded-xl font-sans text-[15px] font-semibold transition-all duration-75 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-3 ${tileClasses}`}
                style={{ boxShadow: shadowStyle }}
              >
                <span
                  className={`shrink-0 w-7 h-7 rounded-md border-[1.5px] flex items-center justify-center font-sans text-[12px] font-extrabold uppercase ${
                    phase === 'checked' && isAnswer
                      ? 'bg-cream text-ruby border-cream'
                      : 'bg-cream-deep text-jewelInk border-jewelInk/30'
                  }`}
                >
                  {String.fromCharCode(97 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {phase === 'checked' && isAnswer && (
                  <svg width="18" height="18" viewBox="0 0 18 18" className="text-cream shrink-0">
                    <path
                      d="M3 9 L7 13 L15 4"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {phase === 'checked' && (
          <div
            className={`mt-6 p-4 border-[1.5px] rounded-xl relative ${
              isCorrect
                ? 'bg-navy border-jewelInk text-cream'
                : 'bg-ruby border-jewelInk text-cream'
            }`}
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            <div className="font-sans text-[13px] font-extrabold uppercase tracking-wider mb-1 opacity-90">
              {isCorrect ? 'верно' : 'ещё раз'}
            </div>
            <div className="font-sans text-[14px] leading-snug">
              {current.explanation ||
                (isCorrect
                  ? 'Хорошо запомнил — так держать.'
                  : 'Запомни правильный вариант и идём дальше.')}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {phase === 'answering' ? (
          <Button variant="primary" disabled={selected === null} onClick={check}>
            проверить
          </Button>
        ) : (
          <Button variant={isCorrect ? 'green' : 'primary'} onClick={next}>
            {index + 1 >= total ? 'итог →' : 'дальше →'}
          </Button>
        )}
      </div>
    </div>
  )
}
