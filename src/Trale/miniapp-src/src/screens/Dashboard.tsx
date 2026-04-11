import React from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  navigate: (s: Screen) => void
}

export default function Dashboard({ catalog, progress, navigate }: Props) {
  return (
    <div className="flex flex-col min-h-full">
      <Header progress={progress} title="Бомбора — გამარჯობა!" />
      <div className="flex-1 p-5 flex flex-col gap-5 anim-slide">
        <div className="bg-white rounded-3xl shadow-card p-5 flex items-center gap-4">
          <Mascot mood="cheer" size={110} />
          <div className="flex-1">
            <div className="font-extrabold text-lg leading-tight">გამარჯობა, друг!</div>
            <div className="text-dog-muted text-sm mt-1">
              Я Бомбора 🐶 Буду учить тебя грузинскому — лапа даю, будет весело.
            </div>
          </div>
        </div>

        <div className="text-dog-ink font-extrabold uppercase text-xs tracking-wider opacity-60 px-1">
          Модули
        </div>

        {catalog.modules.map((m) => {
          const hasLessons = m.lessons.length > 0
          const done = (progress.completedLessons[m.id] ?? []).length
          const pct = hasLessons ? Math.round((done / m.lessons.length) * 100) : 0
          return (
            <button
              key={m.id}
              onClick={() =>
                m.id === 'my-vocabulary'
                  ? navigate({ kind: 'vocabulary-list' })
                  : navigate({ kind: 'module', moduleId: m.id })
              }
              className="text-left bg-white rounded-3xl shadow-card p-4 active:translate-y-1 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-dog-accent/15 flex items-center justify-center text-3xl">
                  {m.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-base">{m.title}</div>
                  <div className="text-dog-muted text-sm truncate">{m.description}</div>
                </div>
              </div>
              {hasLessons ? (
                <>
                  <div className="mt-3 h-2 rounded-full bg-dog-line overflow-hidden">
                    <div
                      className="h-full bg-dog-green rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-dog-muted mt-1.5 font-bold">
                    {done} / {m.lessons.length} · {pct}%
                  </div>
                </>
              ) : (
                <div className="text-xs text-dog-muted mt-2 font-bold">
                  Твои слова · квизы на выбор
                </div>
              )}
            </button>
          )
        })}

        <div className="pt-2">
          <Button variant="ghost" onClick={() => navigate({ kind: 'profile' })}>
            🐾 Мой профиль
          </Button>
        </div>
      </div>
    </div>
  )
}
