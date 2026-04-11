import React from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  moduleId: string
  progress: ProgressState
  navigate: (s: Screen) => void
}

export default function ModuleMap({ catalog, moduleId, progress, navigate }: Props) {
  const module = catalog.modules.find((m) => m.id === moduleId)
  if (!module) {
    return (
      <div className="flex flex-col min-h-full">
        <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title="Модуль" />
        <div className="p-5 text-dog-muted">Модуль не найден.</div>
      </div>
    )
  }

  const lessons = module.lessons
  const completed = new Set(progress.completedLessons[moduleId] ?? [])
  const firstIncomplete = lessons.find((l) => !completed.has(l.id))?.id ?? -1

  return (
    <div className="flex flex-col min-h-full">
      <Header progress={progress} onBack={() => navigate({ kind: 'dashboard' })} title={module.title} />
      <div className="flex-1 p-5 pb-12 anim-slide">
        <div className="bg-white rounded-3xl shadow-card p-4 mb-5 flex items-center gap-3">
          <Mascot mood="think" size={80} />
          <div className="flex-1">
            <div className="font-extrabold">
              {module.title} {module.emoji}
            </div>
            <div className="text-dog-muted text-sm">{module.description}</div>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-4">
          {lessons.map((lesson, idx) => {
            const isDone = completed.has(lesson.id)
            const isCurrent = lesson.id === firstIncomplete
            const offset = idx % 2 === 0 ? '-translate-x-12' : 'translate-x-12'
            return (
              <div key={lesson.id} className={`w-full flex justify-center ${offset}`}>
                <button
                  onClick={() =>
                    navigate({ kind: 'lesson-theory', moduleId, lessonId: lesson.id })
                  }
                  className="group relative flex flex-col items-center"
                >
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center font-extrabold text-2xl shadow-card border-4 transition active:translate-y-1
                      ${isDone ? 'bg-dog-green text-white border-dog-green' : ''}
                      ${isCurrent ? 'bg-dog-accent text-white border-dog-accent anim-pop' : ''}
                      ${!isDone && !isCurrent ? 'bg-white text-dog-ink border-dog-line' : ''}`}
                  >
                    {isDone ? '✓' : lesson.id}
                  </div>
                  <div className="text-center text-xs mt-2 font-extrabold max-w-[160px] leading-tight">
                    {lesson.title}
                  </div>
                  <div className="text-center text-[10px] mt-0.5 text-dog-muted max-w-[160px] leading-tight">
                    {lesson.short}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
