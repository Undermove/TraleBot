import React from 'react'
import Header from '../components/Header'
import KilimProgress from '../components/KilimProgress'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  moduleId: string
  progress: ProgressState
  navigate: (s: Screen) => void
}

export default function ModuleMap({
  catalog,
  moduleId,
  progress,
  navigate
}: Props) {
  const module = catalog.modules.find((m) => m.id === moduleId)
  if (!module) {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'dashboard' })}
          title="Раздел"
        />
        <div className="px-5 pt-6 font-sans text-jewelInk-mid">
          Раздел не найден.
        </div>
      </div>
    )
  }

  const lessons = module.lessons
  const completed = new Set(progress.completedLessons[moduleId] ?? [])
  const done = completed.size
  const firstIncomplete = lessons.find((l) => !completed.has(l.id))?.id ?? -1

  const geoLabel =
    module.id === 'alphabet'
      ? 'ანბანი'
      : module.id === 'verbs-of-movement'
      ? 'ზმნები'
      : module.title

  const accent: 'navy' | 'ruby' | 'gold' =
    module.id === 'alphabet' ? 'navy' : module.id === 'verbs-of-movement' ? 'ruby' : 'gold'

  const accentBg =
    accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
  const accentText =
    accent === 'navy'
      ? 'text-navy'
      : accent === 'ruby'
      ? 'text-ruby'
      : 'text-gold-deep'

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'dashboard' })}
        eyebrow={geoLabel}
        title={module.title}
      />

      <div
        className="flex-1 px-5 pt-6 pb-in"
        style={{ paddingBottom: 'calc(var(--safe-b) + 40px)' }}
      >
        {/* Overview card */}
        <div className="jewel-tile px-5 py-4 mb-6">
          <div className="flex items-center justify-between gap-3 relative z-[1]">
            <div className="flex-1 min-w-0">
              <div className="mn-eyebrow mb-1">глава</div>
              <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight truncate">
                {module.title}
              </div>
              <div className="mt-1 font-sans text-[13px] text-jewelInk-mid leading-snug">
                {module.description}
              </div>
            </div>
          </div>

          <div className="mt-4 relative z-[1]">
            <div className="flex items-center justify-between mb-2">
              <span className="mn-eyebrow">маршрут</span>
              <span className="font-sans text-[11px] font-bold tabular-nums">
                <span className={accentText}>{done}</span>
                <span className="text-jewelInk-hint"> / {lessons.length}</span>
              </span>
            </div>
            <KilimProgress done={done} total={lessons.length} accent={accent} />
          </div>
        </div>

        {/* Lesson list */}
        <div className="mn-eyebrow mb-3">уроки</div>
        <ol className="flex flex-col gap-2.5">
          {lessons.map((lesson, idx) => {
            const isDone = completed.has(lesson.id)
            const isCurrent = lesson.id === firstIncomplete

            return (
              <li key={lesson.id}>
                <button
                  onClick={() =>
                    navigate({
                      kind: 'lesson-theory',
                      moduleId,
                      lessonId: lesson.id
                    })
                  }
                  className="jewel-tile jewel-pressable w-full text-left px-4 py-4 flex items-center gap-3.5"
                >
                  {/* Lesson number medallion */}
                  <div className="shrink-0 relative z-[1]">
                    <div
                      className={`w-12 h-12 rounded-xl border-[1.5px] border-jewelInk flex items-center justify-center ${
                        isDone
                          ? 'bg-navy'
                          : isCurrent
                          ? 'bg-gold'
                          : 'bg-cream-deep'
                      }`}
                      style={{ boxShadow: '2px 2px 0 #15100A' }}
                    >
                      {isDone ? (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M4 10 L8 14 L16 5"
                            stroke="#FBF6EC"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span
                          className={`font-sans text-[18px] font-extrabold tabular-nums leading-none ${
                            isCurrent ? 'text-jewelInk' : 'text-jewelInk-mid'
                          }`}
                        >
                          {lesson.id}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 relative z-[1]">
                    <div className="font-sans text-[16px] font-bold text-jewelInk leading-tight">
                      {lesson.title}
                    </div>
                    <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5 leading-snug line-clamp-1">
                      {lesson.short}
                    </div>
                  </div>

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0 text-navy relative z-[1]"
                  >
                    <path
                      d="M8 5 L16 12 L8 19"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 text-center">
          <div className="mn-eyebrow text-jewelInk-mid">
            все уроки открыты — выбирай любой
          </div>
        </div>
      </div>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />
    </div>
  )
}
