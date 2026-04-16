import React, { useState } from 'react'
import Button from '../components/Button'
import { QuizQuestion, Screen } from '../types'

interface Props {
  moduleId: string
  lessonId: number
  wrongQuestions: QuizQuestion[]
  navigate: (s: Screen) => void
}

type Phase = 'answering' | 'checked'

export default function PracticeMistakes({ moduleId, lessonId, wrongQuestions, navigate }: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [selected, setSelected] = useState<number | null>(null)
  const [missedAgain, setMissedAgain] = useState<QuizQuestion[]>([])

  const current = wrongQuestions[index]
  const total = wrongQuestions.length
  const questionNumber = index + 1
  const pct = Math.round((questionNumber / total) * 100)
  const isCorrect = selected !== null && selected === current.answerIndex

  function check() {
    if (selected === null) return
    setPhase('checked')
    if (selected !== current.answerIndex) {
      setMissedAgain((prev) => [...prev, current])
    }
  }

  function next() {
    if (index + 1 >= total) {
      const corrected = total - missedAgain.length
      navigate({
        kind: 'mistakes-result',
        moduleId,
        lessonId,
        corrected,
        total,
        remainingWrong: missedAgain
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
            onClick={() => navigate({ kind: 'module', moduleId })}
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
              className="h-full bg-ruby transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="shrink-0 text-right min-w-[40px]">
            <div className="font-sans text-[13px] font-bold text-jewelInk tabular-nums">
              <span>{questionNumber}</span>
              <span className="text-jewelInk-hint">/{total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question + options */}
      <div
        className="flex-1 px-5 pt-6"
        style={{ paddingBottom: 'calc(var(--safe-b) + 110px)' }}
      >
        <div className="mn-eyebrow mb-2">разбор ошибок</div>
        <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
          {current.question}
        </h2>

        <div className="mt-6 flex flex-col gap-3">
          {current.options.map((opt, i) => {
            const isSelected = i === selected
            const isAnswer = i === current.answerIndex

            let tileClasses = 'bg-cream-tile border-jewelInk text-jewelInk'
            let shadowStyle = '3px 3px 0 #15100A'

            if (phase === 'answering' && isSelected) {
              tileClasses = 'bg-ruby border-jewelInk text-cream'
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
