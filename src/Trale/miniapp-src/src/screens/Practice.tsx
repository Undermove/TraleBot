import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
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

export default function Practice({ moduleId, lessonId, progress, setProgress, authenticated, navigate }: Props) {
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
      <div className="flex flex-col min-h-full">
        <Header progress={progress} title={`Урок ${lessonId} — Практика`} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Mascot mood="think" size={120} />
          <div className="text-dog-muted">Бомбора достаёт карточки...</div>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col min-h-full">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'lesson-theory', moduleId, lessonId })}
          title={`Урок ${lessonId}`}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5">
          <Mascot mood="sleep" size={120} />
          <div className="text-center text-dog-muted">
            Не получилось загрузить вопросы. Попробуй позже.
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate({ kind: 'lesson-theory', moduleId, lessonId })}
          >
            Назад
          </Button>
        </div>
      </div>
    )
  }

  const current = questions[index]
  const total = questions.length
  const questionNumber = index + 1
  const pct = Math.round((questionNumber / total) * 100)
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
      let xpEarned = Math.round((finalCorrect / total) * 20)

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
          setProgress({
            ...progress,
            xp: progress.xp + xpEarned,
            completedLessons: {
              ...progress.completedLessons,
              [moduleId]: Array.from(
                new Set([...(progress.completedLessons[moduleId] ?? []), lessonId])
              ).sort((a, b) => a - b)
            }
          })
        }
      } else {
        setProgress({
          ...progress,
          xp: progress.xp + xpEarned,
          completedLessons: {
            ...progress.completedLessons,
            [moduleId]: Array.from(
              new Set([...(progress.completedLessons[moduleId] ?? []), lessonId])
            ).sort((a, b) => a - b)
          }
        })
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
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-0 z-10 bg-dog-bg/95 backdrop-blur px-4 pb-3 border-b border-dog-line"
        style={{ paddingTop: 'calc(var(--safe-t) + 12px)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ kind: 'lesson-theory', moduleId, lessonId })}
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-lg font-bold text-dog-ink active:translate-y-0.5"
            aria-label="Закрыть"
          >
            ✕
          </button>
          <div className="flex-1 h-3 rounded-full bg-dog-line overflow-hidden">
            <div
              className="h-full bg-dog-green rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="flex-1 p-5 anim-slide">
        <div className="text-dog-muted text-xs font-extrabold uppercase tracking-wider">
          Вопрос {questionNumber} из {total}
        </div>
        <div className="mt-2 text-xl font-extrabold leading-tight">{current.question}</div>

        <div className="mt-5 flex flex-col gap-3">
          {current.options.map((opt, i) => {
            const isSelected = i === selected
            const isAnswer = i === current.answerIndex
            let cls = 'bg-white border-2 border-dog-line'
            if (phase === 'answering' && isSelected) {
              cls = 'bg-dog-accent/10 border-2 border-dog-accent'
            }
            if (phase === 'checked') {
              if (isAnswer) cls = 'bg-dog-green/20 border-2 border-dog-green'
              else if (isSelected) cls = 'bg-dog-red/20 border-2 border-dog-red'
            }
            return (
              <button
                key={i}
                disabled={phase === 'checked'}
                onClick={() => setSelected(i)}
                className={`w-full text-left rounded-2xl px-4 py-4 font-semibold text-[15px] transition ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {phase === 'checked' && (
          <div
            className={`mt-5 rounded-2xl p-4 ${
              isCorrect ? 'bg-dog-green/15' : 'bg-dog-red/15'
            }`}
          >
            <div className="font-extrabold">
              {isCorrect ? '✓ Правильно!' : '✗ Не совсем'}
            </div>
            {current.explanation && (
              <div className="text-sm mt-1 text-dog-ink/80">{current.explanation}</div>
            )}
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-dog-bg/95 backdrop-blur border-t border-dog-line"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {phase === 'answering' ? (
          <Button variant="green" disabled={selected === null} onClick={check}>
            Проверить
          </Button>
        ) : (
          <Button variant={isCorrect ? 'green' : 'primary'} onClick={next}>
            {index + 1 >= total ? 'Завершить' : 'Продолжить'}
          </Button>
        )}
      </div>
    </div>
  )
}
