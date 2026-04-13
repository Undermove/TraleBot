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

  const geoLabels: Record<string, string> = {
    'alphabet-progressive': 'ანბანი',
    'alphabet': 'ანბანი',
    'numbers': 'რიცხვები',
    'postpositions': 'თანდებულები',
    'adjectives': 'ზედსართავები',
    'verb-classes': 'ზმნის კლასები',
    'version-vowels': 'ვერსია',
    'preverbs': 'პრევერბები',
    'imperfect': 'უწყვეტელი',
    'aorist': 'წყვეტილი',
    'pronoun-declension': 'ბრუნვა',
    'conditionals': 'პირობითი',
    'verbs-of-movement': 'ზმნები',
    'cases': 'ბრუნვები',
    'pronouns': 'ნაცვალსახელები',
    'present-tense': 'აწმყო',
    'cafe': 'კაფე',
    'taxi': 'ტაქსი',
    'doctor': 'ექიმი',
    'shopping': 'მაღაზია',
    'intro': 'გაცნობა',
    'emergency': 'დახმარება',
  }
  const geoLabel = geoLabels[module.id] ?? module.title

  const accentMap: Record<string, 'navy' | 'ruby' | 'gold'> = {
    'alphabet-progressive': 'navy',
    'alphabet': 'navy',
    'numbers': 'gold',
    'postpositions': 'navy',
    'adjectives': 'gold',
    'verb-classes': 'navy',
    'version-vowels': 'gold',
    'preverbs': 'ruby',
    'imperfect': 'navy',
    'aorist': 'ruby',
    'pronoun-declension': 'navy',
    'conditionals': 'gold',
    'verbs-of-movement': 'ruby',
    'cases': 'navy',
    'pronouns': 'ruby',
    'present-tense': 'navy',
    'cafe': 'gold',
    'taxi': 'ruby',
    'doctor': 'ruby',
    'shopping': 'gold',
    'intro': 'navy',
    'emergency': 'ruby',
  }
  const accent = accentMap[module.id] ?? 'gold'

  const accentBg =
    accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
  const accentText =
    accent === 'navy'
      ? 'text-navy'
      : accent === 'ruby'
      ? 'text-ruby'
      : 'text-gold-deep'

  const accentHex =
    accent === 'navy' ? '#1B5FB0' : accent === 'ruby' ? '#E01A3C' : '#F5B820'
  const accentWashHex =
    accent === 'navy' ? '#C9DBF0' : accent === 'ruby' ? '#F7D4DB' : '#F9EAC1'

  // Path layout constants — adaptive for long modules
  const CIRCLE_SIZE = lessons.length > 8 ? 48 : 56
  const ROW_GAP = lessons.length > 8 ? 18 : 28
  const STEP_Y = CIRCLE_SIZE + ROW_GAP
  const SIDE_OFFSET = lessons.length > 8 ? 44 : 52
  const totalHeight = (lessons.length - 1) * STEP_Y + CIRCLE_SIZE

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

        {/* Journey path map */}
        <div className="mn-eyebrow mb-3">уроки</div>
        <div
          className="relative mx-auto"
          style={{
            height: totalHeight,
            maxWidth: 340,
            width: '100%'
          }}
        >
          {/* SVG connecting lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={totalHeight}
            viewBox={`0 0 340 ${totalHeight}`}
            preserveAspectRatio="xMidYMid meet"
            fill="none"
          >
            {lessons.map((_, idx) => {
              if (idx === lessons.length - 1) return null
              const isEven = idx % 2 === 0
              const nextIsEven = (idx + 1) % 2 === 0
              const centerX = 170
              const x1 = centerX + (isEven ? -SIDE_OFFSET : SIDE_OFFSET)
              const y1 = idx * STEP_Y + CIRCLE_SIZE / 2
              const x2 = centerX + (nextIsEven ? -SIDE_OFFSET : SIDE_OFFSET)
              const y2 = (idx + 1) * STEP_Y + CIRCLE_SIZE / 2

              // Quadratic bezier for a gentle curve
              const cpX = (x1 + x2) / 2
              const cpY = (y1 + y2) / 2

              const nextIsDone = completed.has(lessons[idx + 1].id)
              const currentIsDone = completed.has(lessons[idx].id)
              const segmentDone = currentIsDone && nextIsDone
              const segmentColor = segmentDone ? accentHex : '#B5A68B'

              return (
                <path
                  key={`line-${idx}`}
                  d={`M ${x1} ${y1} Q ${cpX} ${y1 + (y2 - y1) * 0.15} ${cpX} ${cpY} Q ${cpX} ${y2 - (y2 - y1) * 0.15} ${x2} ${y2}`}
                  stroke={segmentColor}
                  strokeWidth="2.5"
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                  opacity={segmentDone ? 0.7 : 0.4}
                />
              )
            })}
          </svg>

          {/* Lesson circles + labels */}
          {lessons.map((lesson, idx) => {
            const isDone = completed.has(lesson.id)
            const isCurrent = lesson.id === firstIncomplete
            const isEven = idx % 2 === 0
            const topY = idx * STEP_Y

            // Circle positioning: even = left of center, odd = right
            const circleLeft = isEven
              ? `calc(50% - ${SIDE_OFFSET + CIRCLE_SIZE / 2}px)`
              : `calc(50% + ${SIDE_OFFSET - CIRCLE_SIZE / 2}px)`

            // Label on opposite side of circle
            const labelOnRight = isEven
            const labelStyle: React.CSSProperties = labelOnRight
              ? {
                  left: `calc(50% - ${SIDE_OFFSET - CIRCLE_SIZE / 2 - 14}px)`,
                  right: 0,
                  textAlign: 'left' as const
                }
              : {
                  left: 0,
                  right: `calc(50% - ${SIDE_OFFSET - CIRCLE_SIZE / 2 - 14}px)`,
                  textAlign: 'right' as const
                }

            const circleBg = isDone
              ? 'bg-navy'
              : isCurrent
              ? accentBg
              : 'bg-cream-deep'

            const circleBorder = isDone || isCurrent
              ? 'border-jewelInk'
              : 'border-jewelInk/50'

            const circleShadow =
              isDone || isCurrent
                ? '2px 2px 0 #15100A'
                : '1px 1px 0 rgba(21,16,10,0.25)'

            return (
              <div key={lesson.id} className="absolute" style={{ top: topY, left: 0, right: 0, height: CIRCLE_SIZE }}>
                {/* Tappable circle */}
                <button
                  onClick={() =>
                    navigate({
                      kind: 'lesson-theory',
                      moduleId,
                      lessonId: lesson.id
                    })
                  }
                  className={`absolute ${circleBg} border-[1.5px] ${circleBorder} rounded-full flex items-center justify-center transition-transform active:scale-95`}
                  style={{
                    width: CIRCLE_SIZE,
                    height: CIRCLE_SIZE,
                    top: 0,
                    left: circleLeft,
                    boxShadow: circleShadow,
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  {isDone ? (
                    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
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
                      className={`font-sans text-[20px] font-extrabold tabular-nums leading-none ${
                        isCurrent ? 'text-jewelInk' : 'text-jewelInk/60'
                      }`}
                    >
                      {lesson.id}
                    </span>
                  )}
                </button>

                {/* Label next to circle */}
                <button
                  onClick={() =>
                    navigate({
                      kind: 'lesson-theory',
                      moduleId,
                      lessonId: lesson.id
                    })
                  }
                  className="absolute flex flex-col justify-center"
                  style={{
                    top: 0,
                    height: CIRCLE_SIZE,
                    ...labelStyle,
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div
                    className={`font-sans text-[14px] font-bold leading-tight ${
                      isDone
                        ? 'text-jewelInk'
                        : isCurrent
                        ? 'text-jewelInk'
                        : 'text-jewelInk-mid'
                    }`}
                  >
                    {lesson.title}
                  </div>
                  <div
                    className={`font-sans text-[11px] leading-snug mt-0.5 line-clamp-1 ${
                      isDone || isCurrent ? 'text-jewelInk-mid' : 'text-jewelInk-hint'
                    }`}
                  >
                    {lesson.short}
                  </div>
                </button>
              </div>
            )
          })}
        </div>

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
