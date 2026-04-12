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

        <div className="relative flex flex-col items-center">
          {/* Dotted path connectors between lesson circles */}
          {lessons.slice(0, -1).map((_, idx) => {
            const prevDone = completed.has(lessons[idx].id)
            const nextDone = completed.has(lessons[idx + 1].id)
            const pathDone = prevDone && nextDone
            const goesRight = idx % 2 === 0 // even→odd = left to right
            return (
              <div
                key={`path-${idx}`}
                className="absolute pointer-events-none"
                style={{
                  top: idx * 140 + 40,
                  left: '50%',
                  width: 96,
                  height: 140,
                  marginLeft: goesRight ? -48 : -48,
                  zIndex: 0,
                }}
              >
                <svg width="96" height="140" viewBox="0 0 96 140" fill="none">
                  <path
                    d={goesRight ? 'M 0 0 C 0 70, 96 70, 96 140' : 'M 96 0 C 96 70, 0 70, 0 140'}
                    stroke={pathDone ? '#58CC02' : '#E5D5B0'}
                    strokeWidth="3"
                    strokeDasharray="8 8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>
            )
          })}

          {lessons.map((lesson, idx) => {
            const isDone = completed.has(lesson.id)
            const isCurrent = lesson.id === firstIncomplete
            const offset = idx % 2 === 0 ? '-translate-x-12' : 'translate-x-12'
            return (
              <div
                key={lesson.id}
                className={`relative w-full flex justify-center ${offset}`}
                style={{ zIndex: 1, minHeight: 140 }}
              >
                <button
                  onClick={() =>
                    navigate({ kind: 'lesson-theory', moduleId, lessonId: lesson.id })
                  }
                  className="group relative flex flex-col items-center pt-2"
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
