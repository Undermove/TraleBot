import React from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { CatalogDto, QuizQuestion, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  moduleId: string
  lessonId: number
  correct: number
  total: number
  xpEarned: number
  wrongQuestions?: QuizQuestion[]
  navigate: (s: Screen) => void
}

export default function Result({
  catalog,
  moduleId,
  lessonId,
  correct,
  total,
  xpEarned,
  wrongQuestions,
  navigate
}: Props) {
  const pct = Math.round((correct / total) * 100)
  const isPerfect = correct === total

  // Find next lesson for "Next Lesson" button — only on 100%
  const module = catalog.modules.find((m) => m.id === moduleId)
  const nextLesson = module?.lessons.find((l) => l.id === lessonId + 1) ?? null
  const isGreat = isPerfect
  const isOK = pct >= 50 && !isGreat

  const mood: 'cheer' | 'happy' | 'think' = isGreat ? 'cheer' : isOK ? 'happy' : 'think'
  const title = isGreat ? 'Отлично' : isOK ? 'Неплохо' : 'Ещё раз'

  // Georgian stamp words — user learns by seeing them repeatedly
  const stampGeo = isGreat ? 'მშვენივრად' : isOK ? 'კარგი' : 'ცადე'
  const stampTrans = isGreat ? 'превосходно' : isOK ? 'хорошо' : 'попробуй'

  return (
    <div className="flex flex-col bg-cream" style={{ minHeight: '100dvh' }}>
      {/* Kilim top strip */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      {/* Confetti only on great result */}
      {isGreat && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="confetti absolute top-0 w-2.5 h-4"
              style={{
                left: `${(i * 3.2) % 100}%`,
                background: ['#1B5FB0', '#E01A3C', '#F5B820', '#FBF6EC'][i % 4],
                border: '1px solid #15100A',
                transform: `rotate(${(i * 23) % 360}deg)`,
                animationDelay: `${(i % 10) * 70}ms`
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative z-[1] flex-1 flex flex-col items-center px-5 pt-8"
        style={{ paddingBottom: 'calc(var(--safe-b) + 160px)' }}
      >
        {/* Mascot + stamp */}
        <div className="relative mb-5">
          <Mascot mood={mood} size={170} />
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

        <div className="mn-eyebrow mb-2">итог страницы</div>
        <h1 className="font-sans text-[44px] font-extrabold text-jewelInk leading-[0.95] text-center tracking-tight">
          {title}
        </h1>
        <div className="mt-2 font-sans text-[14px] text-jewelInk-mid">
          {moduleId === 'vocabulary'
            ? 'квиз по словарю завершён'
            : isPerfect
            ? `страница ${lessonId} закрыта`
            : `страница ${lessonId} — нужно 100%`}
        </div>

        {/* Stats — three jewel tiles */}
        <div className="w-full grid grid-cols-3 gap-3 mt-8">
          <StatTile label="верно" value={`${correct}/${total}`} accent="navy" />
          <StatTile label="опыт" value={`+${xpEarned}`} accent="ruby" />
          <StatTile label="точность" value={`${pct}%`} accent="gold" />
        </div>

        {/* Comment */}
        <div className="mt-8 text-center max-w-[320px]">
          <p className="font-sans text-[14px] text-jewelInk-soft leading-snug">
            {isGreat &&
              'Так держать. Блокнот пополняется с каждой страницей.'}
            {isOK &&
              'Ответь правильно на все вопросы, чтобы закрыть страницу.'}
            {!isOK &&
              !isGreat &&
              'Перечитай теорию и попробуй ответить на все вопросы.'}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {moduleId === 'vocabulary' ? (
          <>
            <Button variant="primary" onClick={() => navigate({ kind: 'vocabulary-list' })}>
              к словарю →
            </Button>
            <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
              на главную
            </Button>
          </>
        ) : wrongQuestions && wrongQuestions.length > 0 ? (
          <>
            <div className="flex flex-col items-stretch gap-0">
              <Button
                variant="green"
                onClick={() =>
                  navigate({ kind: 'practice-mistakes', moduleId, lessonId, wrongQuestions })
                }
              >
                Повторить ошибки ({wrongQuestions.length})
              </Button>
              <div className="font-geo text-[10px] font-bold text-ruby/60 text-center mt-1.5 mb-3">
                ჩემი შეცდომები
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate({ kind: 'module', moduleId })}
            >
              к карте уроков →
            </Button>
          </>
        ) : (
          <>
            {isGreat && nextLesson ? (
              <Button
                variant="green"
                onClick={() =>
                  navigate({ kind: 'lesson-theory', moduleId, lessonId: nextLesson.id })
                }
              >
                следующий урок →
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => navigate({ kind: 'module', moduleId })}
              >
                к карте уроков →
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => navigate({ kind: 'practice', moduleId, lessonId })}
            >
              пройти ещё раз
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent: 'navy' | 'ruby' | 'gold'
}) {
  const accentText =
    accent === 'navy' ? 'text-navy' : accent === 'ruby' ? 'text-ruby' : 'text-gold-deep'
  return (
    <div className="jewel-tile px-2 py-3 text-center">
      <div className="relative z-[1]">
        <div className="mn-eyebrow text-jewelInk-mid">{label}</div>
        <div
          className={`mt-1.5 font-sans text-[20px] font-extrabold tabular-nums leading-none ${accentText}`}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
