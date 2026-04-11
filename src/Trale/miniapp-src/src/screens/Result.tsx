import React from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { Screen } from '../types'

interface Props {
  moduleId: string
  lessonId: number
  correct: number
  total: number
  xpEarned: number
  navigate: (s: Screen) => void
}

export default function Result({ moduleId, lessonId, correct, total, xpEarned, navigate }: Props) {
  const pct = Math.round((correct / total) * 100)
  const isGreat = pct >= 80
  const mood = isGreat ? 'cheer' : 'happy'

  return (
    <div
      className="flex flex-col min-h-full items-center px-6"
      style={{
        paddingTop: 'calc(var(--safe-t) + 24px)',
        paddingBottom: 'calc(var(--safe-b) + 200px)'
      }}
    >
      {/* confetti */}
      {isGreat && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="confetti absolute top-0 w-2 h-3 rounded-sm"
              style={{
                left: `${(i * 4.3) % 100}%`,
                background: ['#FF9B42', '#58CC02', '#3AB8FF', '#FFC800', '#E94F4F'][i % 5],
                animationDelay: `${(i % 8) * 80}ms`
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-6 anim-slide flex flex-col items-center">
        <Mascot mood={mood} size={160} />
        <div className="text-3xl font-black mt-3">
          {isGreat ? 'Отлично!' : 'Неплохо!'}
        </div>
        <div className="text-dog-muted mt-1">
          {moduleId === 'vocabulary' ? 'Квиз по словарю завершён' : `Урок ${lessonId} пройден`}
        </div>
      </div>

      <div className="mt-8 w-full grid grid-cols-3 gap-3">
        <Stat icon="✓" label="Верно" value={`${correct} / ${total}`} color="bg-dog-green" />
        <Stat icon="⭐" label="XP" value={`+${xpEarned}`} color="bg-dog-gold text-dog-ink" />
        <Stat icon="🎯" label="Точность" value={`${pct}%`} color="bg-dog-blue" />
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 pt-4 bg-dog-bg/95 backdrop-blur border-t border-dog-line flex flex-col gap-3"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {moduleId === 'vocabulary' ? (
          <>
            <Button variant="green" onClick={() => navigate({ kind: 'vocabulary-list' })}>
              К словарю
            </Button>
            <Button variant="ghost" onClick={() => navigate({ kind: 'dashboard' })}>
              На главную
            </Button>
          </>
        ) : (
          <>
            <Button variant="green" onClick={() => navigate({ kind: 'module', moduleId })}>
              К карте уроков
            </Button>
            <Button variant="ghost" onClick={() => navigate({ kind: 'practice', moduleId, lessonId })}>
              Повторить
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  color
}: {
  icon: string
  label: string
  value: string
  color: string
}) {
  return (
    <div className={`rounded-2xl ${color} text-white p-3 text-center shadow-card`}>
      <div className="text-xl">{icon}</div>
      <div className="text-xs opacity-90 font-bold mt-1">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  )
}
