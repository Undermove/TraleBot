import React, { useEffect, useState } from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { ProgressState, Screen } from '../types'
import { api, ApiError, VocabularyQuizMode, VocabularyQuizQuestion } from '../api'
import { progressFromDto } from '../progress'

interface Props {
  mode: VocabularyQuizMode
  wordIds?: string[]
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  authenticated: boolean
  navigate: (s: Screen) => void
}

type Phase = 'loading' | 'answering' | 'checked' | 'error' | 'empty' | 'auth-required'

export default function VocabularyPractice({ mode, wordIds, progress, setProgress, authenticated, navigate }: Props) {
  const [questions, setQuestions] = useState<VocabularyQuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [selected, setSelected] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .startVocabularyQuiz({ mode, wordIds, count: 10 })
      .then((r) => {
        if (cancelled) return
        if (!r.questions.length) {
          setPhase('empty')
          return
        }
        setQuestions(r.questions)
        setPhase('answering')
      })
      .catch((e) => {
        if (cancelled) return
        setPhase(e instanceof ApiError && e.status === 401 ? 'auth-required' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  if (phase === 'loading') {
    return (
      <CenteredMascot mood="think" text="Бомбора мешает карточки..." />
    )
  }

  if (phase === 'empty') {
    return (
      <div className="flex flex-col min-h-full p-5 items-center justify-center gap-4 text-center">
        <Mascot mood="sleep" size={120} />
        <div className="font-extrabold text-lg">Нечего спрашивать</div>
        <div className="text-dog-muted">В выбранной категории пусто — попробуй другой набор слов.</div>
        <Button variant="ghost" onClick={() => navigate({ kind: 'vocabulary-list' })}>
          Назад к словарю
        </Button>
      </div>
    )
  }

  if (phase === 'error' || phase === 'auth-required') {
    return (
      <div className="flex flex-col min-h-full p-5 items-center justify-center gap-4 text-center">
        <Mascot mood="sleep" size={120} />
        <div className="text-dog-muted">
          {phase === 'auth-required'
            ? 'Открой мини-апп через кнопку «🎓 Грузинский» в Telegram-боте.'
            : 'Что-то сломалось. Попробуй ещё раз.'}
        </div>
        <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
          На главную
        </Button>
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
    const isRight = selected === current.answerIndex
    if (isRight) {
      setCorrectCount((c) => c + 1)
    }
    if (current.wordId) {
      api
        .recordVocabularyAnswer({
          wordId: current.wordId,
          correct: isRight,
          direction: current.direction
        })
        .catch(() => {})
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
          setProgress({
            ...progress,
            xp: progress.xp + xpEarned
          })
        }
      } else {
        setProgress({
          ...progress,
          xp: progress.xp + xpEarned
        })
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
            onClick={() => navigate({ kind: 'vocabulary-list' })}
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
          <div className="bg-white rounded-full px-2.5 py-1 shadow-card text-xs font-extrabold text-dog-ink">
            {questionNumber}/{total}
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 anim-slide">
        <div className="text-dog-muted text-xs font-extrabold uppercase tracking-wider">
          {current.direction === 'ge-to-ru' ? 'Грузинский → Русский' : 'Русский → Грузинский'}
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
              {isCorrect ? '✓ Правильно!' : '✗ Правильный ответ:'}
            </div>
            {!isCorrect && (
              <div className="mt-1 font-extrabold">{current.options[current.answerIndex]}</div>
            )}
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

function CenteredMascot({ mood, text }: { mood: 'think' | 'happy'; text: string }) {
  return (
    <div className="flex flex-col min-h-full items-center justify-center gap-4">
      <Mascot mood={mood} size={120} />
      <div className="text-dog-muted">{text}</div>
    </div>
  )
}
