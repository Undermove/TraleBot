import React from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  setProgress: (p: ProgressState) => void
  navigate: (s: Screen) => void
}

export default function Profile({ catalog, progress, setProgress, navigate }: Props) {
  const modules = catalog.modules
  const totalDone = Object.values(progress.completedLessons).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="flex flex-col min-h-full">
      <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Профиль" />
      <div className="flex-1 p-5 flex flex-col gap-4 anim-slide">
        <div className="bg-white rounded-3xl shadow-card p-5 flex items-center gap-4">
          <Mascot mood="happy" size={110} />
          <div className="flex-1">
            <div className="font-extrabold text-lg">Бомбора твой друг</div>
            <div className="text-dog-muted text-sm">Старается — а значит растёт</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Tile icon="🔥" label="Стрик" value={`${progress.streak}`} />
          <Tile icon="⭐" label="XP" value={`${progress.xp}`} />
          <Tile icon="📚" label="Уроков" value={`${totalDone}`} />
        </div>

        <div className="bg-white rounded-3xl shadow-card p-4">
          <div className="font-extrabold text-dog-ink">Прогресс по модулям</div>
          <div className="mt-3 flex flex-col gap-3">
            {modules.map((m) => {
              const total = m.lessons.length
              if (total === 0) return null
              const done = (progress.completedLessons[m.id] ?? []).length
              const pct = Math.round((done / total) * 100)
              return (
                <div key={m.id}>
                  <div className="flex justify-between text-sm font-bold">
                    <span>
                      {m.emoji} {m.title}
                    </span>
                    <span className="text-dog-muted">
                      {done} / {total}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-dog-line overflow-hidden">
                    <div className="h-full bg-dog-green" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

function Tile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-3 text-center">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-dog-muted font-bold uppercase mt-1">{label}</div>
      <div className="text-xl font-black text-dog-ink">{value}</div>
    </div>
  )
}
