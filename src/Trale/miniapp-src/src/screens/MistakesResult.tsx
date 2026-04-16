import React from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { QuizQuestion, Screen } from '../types'

interface Props {
  moduleId: string
  lessonId: number
  corrected: number
  total: number
  remainingWrong: QuizQuestion[]
  navigate: (s: Screen) => void
}

export default function MistakesResult({
  moduleId,
  lessonId,
  corrected,
  total,
  remainingWrong,
  navigate
}: Props) {
  const allCorrect = corrected === total
  const partial = !allCorrect && corrected / total >= 0.5

  const mood: 'cheer' | 'happy' | 'think' = allCorrect ? 'cheer' : partial ? 'happy' : 'think'
  const stampGeo = allCorrect ? 'ბრავო' : partial ? 'კარგი' : 'ცადე'
  const stampTrans = allCorrect ? 'браво' : partial ? 'хорошо' : 'попробуй'

  const title = allCorrect
    ? 'Все ошибки исправлены!'
    : partial
    ? 'Почти разобрались'
    : 'Ещё поработаем'

  const comment = allCorrect
    ? 'Блокнот стал немного полнее.'
    : partial
    ? 'Повтори оставшееся — это ускорит запоминание.'
    : 'Трудные вопросы — перечитай теорию и попробуй снова.'

  return (
    <div className="flex flex-col bg-cream" style={{ minHeight: '100dvh' }}>
      {/* Kilim top strip */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      <div
        className="flex-1 flex flex-col items-center px-5 pt-8"
        style={{ paddingBottom: 'calc(var(--safe-b) + 160px)' }}
      >
        {/* Mascot + stamp */}
        <div className="relative mb-5">
          <Mascot mood={mood} size={140} />
          <div
            className="absolute -top-1 -right-4 mn-reveal px-3 py-2 bg-cream border-[1.5px] border-jewelInk rounded-lg rotate-[6deg] text-center"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            <div className="font-geo text-[14px] font-extrabold text-ruby leading-none">
              {stampGeo}
            </div>
            <div className="font-sans text-[8px] font-bold text-jewelInk-mid uppercase tracking-wider mt-0.5">
              {stampTrans}
            </div>
          </div>
        </div>

        <div className="mn-eyebrow mb-2">разбор ошибок</div>
        <h1 className="font-sans text-[36px] font-extrabold text-jewelInk leading-[1.0] text-center tracking-tight">
          {title}
        </h1>

        {/* Single stat tile — centered */}
        <div className="mt-8 flex justify-center">
          <div className="jewel-tile px-4 py-3 text-center max-w-[140px]">
            <div className="relative z-[1]">
              <div className="mn-eyebrow text-jewelInk-mid">исправлено</div>
              <div className="mt-1.5 font-sans text-[20px] font-extrabold tabular-nums leading-none text-ruby">
                {corrected} / {total}
              </div>
            </div>
          </div>
        </div>

        {/* Comment */}
        <div className="mt-8 text-center max-w-[320px]">
          <p className="font-sans text-[14px] text-jewelInk-soft leading-snug">{comment}</p>
        </div>
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        <Button variant="primary" onClick={() => navigate({ kind: 'module', moduleId })}>
          к карте уроков →
        </Button>
        {remainingWrong.length > 0 && (
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ kind: 'practice-mistakes', moduleId, lessonId, wrongQuestions: remainingWrong })
            }
          >
            повторить оставшиеся ({remainingWrong.length})
          </Button>
        )}
      </div>
    </div>
  )
}
