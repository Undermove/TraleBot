import React from 'react'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import { CatalogDto, ProgressState, Screen } from '../types'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  navigate: (s: Screen) => void
}

/**
 * Dashboard — Minanka pilot.
 *
 * Board game tiles + Georgian enamel palette.
 * Learning-design: module numbers use Georgian numeral letters (ა=1, ბ=2, გ=3),
 * module icons use meaningful Georgian letters that tie into what's taught,
 * product signature is a tiny kilim strip at the top.
 */
export default function Dashboard({ catalog, progress, navigate }: Props) {
  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* ══ Kilim signature strip ══ */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      {/* ══ Stats bar ══ */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="mn-eyebrow">блокнот</div>
        <div className="flex items-center gap-3">
          <StatPill value={progress.streak} label="дн" color="ruby" />
          <StatPill value={progress.xp} label="xp" color="navy" />
        </div>
      </div>

      {/* ══ Hero — dynamic greeting + lesson of the day ══ */}
      <section className="px-5 pt-4 pb-6 pb-in">
        {(() => {
          const { greeting, mascotMood, suggestion } = computeHero(catalog, progress)
          return (
            <>
              <div className="flex items-end gap-3">
                <div className="shrink-0 -mb-2">
                  <Mascot mood={mascotMood} size={148} />
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="font-geo text-[14px] text-jewelInk-mid leading-none mb-2 font-semibold">
                    {greeting.geo}
                  </div>
                  <h1 className="font-sans font-extrabold text-[28px] leading-[1.05] text-jewelInk tracking-tight">
                    {greeting.line1}
                    <br />
                    <span className="text-ruby">{greeting.line2}</span>
                  </h1>
                </div>
              </div>

              {suggestion && (
                <button
                  onClick={() => navigate(suggestion.screen)}
                  className="jewel-tile jewel-pressable mt-4 w-full text-left px-5 py-4 flex items-center gap-4"
                >
                  <div className="relative z-[1] shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl bg-ruby border-[1.5px] border-jewelInk flex items-center justify-center"
                      style={{ boxShadow: '2px 2px 0 #15100A' }}
                    >
                      <span className="font-sans text-[20px] font-extrabold text-cream leading-none">▶</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 relative z-[1]">
                    <div className="mn-eyebrow text-ruby mb-0.5">{suggestion.eyebrow}</div>
                    <div className="font-sans text-[16px] font-bold text-jewelInk leading-tight truncate">
                      {suggestion.title}
                    </div>
                    <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5 truncate">
                      {suggestion.subtitle}
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ruby relative z-[1]">
                    <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </>
          )
        })()}
      </section>

      {/* ══ Module section label ══ */}
      <div className="px-5 pt-2 pb-3 flex items-center gap-3">
        <div className="mn-eyebrow">разделы блокнота</div>
        <div className="flex-1 h-px bg-jewelInk/15" />
        <div className="font-sans text-[11px] font-semibold text-jewelInk-mid tabular-nums">
          {catalog.modules.length}
        </div>
      </div>

      {/* ══ Module tiles — board game pieces ══ */}
      <section className="px-5 flex flex-col gap-4 pb-6">
        {catalog.modules.map((m, idx) => {
          const hasLessons = m.lessons.length > 0
          const done = (progress.completedLessons[m.id] ?? []).length
          const total = m.lessons.length
          const pct = hasLessons ? Math.round((done / total) * 100) : 0
          const isComplete = hasLessons && done === total

          // Georgian numeral letters (historical Georgian numeric system)
          // ა=1, ბ=2, გ=3, ... alphabetic order maps to numbers
          const geoNumerals = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'ჱ', 'თ']
          const geoNum = geoNumerals[idx] ?? '?'

          // Module icons = Georgian letters that tie into what's taught
          // Alphabet → ა (first letter), Verbs → ზ (ზმნა "verb"), Vocabulary → ლ (ლექსიკონი)
          const moduleIcon =
            m.id === 'alphabet'
              ? 'ა'
              : m.id === 'verbs-of-movement'
              ? 'ზ'
              : m.id === 'my-vocabulary'
              ? 'ლ'
              : '?'

          const moduleGeo =
            m.id === 'alphabet'
              ? 'ანბანი'
              : m.id === 'verbs-of-movement'
              ? 'ზმნები'
              : m.id === 'my-vocabulary'
              ? 'ლექსიკონი'
              : ''

          // Each module gets one signature color from the jewel palette
          const accent =
            idx === 0 ? 'navy' : idx === 1 ? 'ruby' : 'gold'
          const accentBg =
            accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
          const accentText =
            accent === 'navy'
              ? 'text-navy'
              : accent === 'ruby'
              ? 'text-ruby'
              : 'text-gold-deep'

          return (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === 'my-vocabulary') navigate({ kind: 'vocabulary-list' })
                else navigate({ kind: 'module', moduleId: m.id })
              }}
              className="jewel-tile jewel-pressable text-left px-5 py-5 pb-in"
              style={{ animationDelay: `${120 + idx * 70}ms` }}
            >
              <div className="flex items-start gap-4 relative z-[1]">
                {/* Georgian letter icon in colored medallion */}
                <div className="shrink-0 relative">
                  <div
                    className={`w-14 h-14 rounded-xl ${accentBg} border-[1.5px] border-jewelInk flex items-center justify-center`}
                    style={{ boxShadow: '2px 2px 0 #15100A' }}
                  >
                    <span className="font-geo text-[28px] font-extrabold text-cream leading-none">
                      {moduleIcon}
                    </span>
                  </div>
                  {/* Georgian numeral badge */}
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-cream border-[1.5px] border-jewelInk flex items-center justify-center">
                    <span
                      className={`font-geo text-[11px] font-bold ${accentText} leading-none`}
                    >
                      {geoNum}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="font-geo text-[11px] text-jewelInk-mid font-semibold uppercase tracking-wide">
                    {moduleGeo}
                  </div>
                  <h2 className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight mt-0.5 tracking-tight">
                    {m.title}
                  </h2>
                  <p className="font-sans text-[13px] text-jewelInk-mid mt-1.5 leading-snug line-clamp-2">
                    {m.description}
                  </p>
                </div>
              </div>

              {/* Footer row: kilim zigzag progress or status */}
              {hasLessons ? (
                <div className="mt-4 relative z-[1]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="mn-eyebrow">
                      {isComplete ? (
                        <span className="text-gold-deep">пройдено</span>
                      ) : (
                        'маршрут'
                      )}
                    </span>
                    <span className="font-sans text-[11px] font-bold text-jewelInk tabular-nums">
                      <span className={accentText}>{done}</span>
                      <span className="text-jewelInk-hint"> / {total}</span>
                    </span>
                  </div>
                  <KilimProgress done={done} total={total} accent={accent} />
                </div>
              ) : (
                <div className="mt-3 relative z-[1]">
                  <span className="mn-eyebrow text-jewelInk-mid">
                    твои слова · квизы на выбор
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </section>

      {/* ══ Profile button — smaller tile ══ */}
      <div className="px-5 pb-6">
        <button
          onClick={() => navigate({ kind: 'profile' })}
          className="jewel-tile jewel-pressable w-full text-left px-5 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 relative z-[1]">
            <div className="w-10 h-10 rounded-lg bg-cream-deep border-[1.5px] border-jewelInk flex items-center justify-center">
              <span className="font-geo text-[18px] font-extrabold text-navy leading-none">
                მ
              </span>
            </div>
            <div>
              <div className="mn-eyebrow">вкладка</div>
              <div className="font-sans text-[16px] font-bold text-jewelInk leading-none mt-0.5">
                мой профиль
              </div>
            </div>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-navy relative z-[1]">
            <path
              d="M8 5 L16 12 L8 19"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* ══ Bottom kilim strip — symmetry with top ══ */}
      <div className="mt-auto">
        <div className="mn-kilim opacity-70" />
      </div>

      <div style={{ height: 'calc(var(--safe-b) + 12px)' }} />
    </div>
  )
}

/**
 * Compute dynamic hero: greeting, mascot mood, and a "lesson of the day" suggestion.
 */
function computeHero(
  catalog: CatalogDto,
  progress: ProgressState
): {
  greeting: { geo: string; line1: string; line2: string }
  mascotMood: 'happy' | 'cheer' | 'think' | 'guide'
  suggestion: {
    eyebrow: string
    title: string
    subtitle: string
    screen: Screen
  } | null
} {
  const totalDone = Object.values(progress.completedLessons).reduce(
    (s, arr) => s + arr.length,
    0
  )
  const totalAvailable = catalog.modules.reduce(
    (s, m) => s + m.lessons.length,
    0
  )
  const allDone = totalDone >= totalAvailable && totalAvailable > 0

  // Find next incomplete lesson across modules (in order)
  let nextModule: typeof catalog.modules[0] | null = null
  let nextLesson: { id: number; title: string; short: string } | null = null
  for (const m of catalog.modules) {
    if (m.lessons.length === 0) continue
    const done = new Set(progress.completedLessons[m.id] ?? [])
    const incomplete = m.lessons.find((l) => !done.has(l.id))
    if (incomplete) {
      nextModule = m
      nextLesson = incomplete
      break
    }
  }

  // Days since last played
  const daysSincePlayed = progress.lastPlayedDate
    ? Math.floor(
        (Date.now() - new Date(progress.lastPlayedDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : -1

  // Dynamic greeting
  let greeting: { geo: string; line1: string; line2: string }
  let mascotMood: 'happy' | 'cheer' | 'think' | 'guide'

  if (totalDone === 0) {
    greeting = {
      geo: 'გამარჯობა!',
      line1: 'Привет!',
      line2: 'Давай начнём'
    }
    mascotMood = 'cheer'
  } else if (allDone) {
    greeting = {
      geo: 'ყოჩაღ!',
      line1: 'Все уроки пройдены!',
      line2: 'Повторяем и растём'
    }
    mascotMood = 'cheer'
  } else if (daysSincePlayed > 2) {
    greeting = {
      geo: 'მოგესალმებით!',
      line1: 'Давно не виделись!',
      line2: 'Давай продолжим'
    }
    mascotMood = 'think'
  } else if (daysSincePlayed === 1) {
    greeting = {
      geo: 'მოგესალმებით!',
      line1: 'Вчера было хорошо',
      line2: 'Сегодня ещё лучше'
    }
    mascotMood = 'happy'
  } else if (progress.streak >= 3) {
    greeting = {
      geo: 'შესანიშნავია!',
      line1: `${progress.streak} дней подряд!`,
      line2: 'Так держать'
    }
    mascotMood = 'cheer'
  } else {
    greeting = {
      geo: 'გამარჯობა!',
      line1: 'Хорошо идёшь',
      line2: 'Продолжаем'
    }
    mascotMood = 'happy'
  }

  // Suggestion
  let suggestion: {
    eyebrow: string
    title: string
    subtitle: string
    screen: Screen
  } | null = null

  if (nextModule && nextLesson) {
    suggestion = {
      eyebrow: 'урок дня',
      title: nextLesson.title,
      subtitle: `${nextModule.title} · урок ${nextLesson.id}`,
      screen: {
        kind: 'lesson-theory',
        moduleId: nextModule.id,
        lessonId: nextLesson.id
      }
    }
  } else if (allDone) {
    suggestion = {
      eyebrow: 'повторение',
      title: 'Прокачай словарь',
      subtitle: 'Квиз по твоим словам',
      screen: { kind: 'vocabulary-list' }
    }
  }

  return { greeting, mascotMood, suggestion }
}

function StatPill({
  value,
  label,
  color
}: {
  value: number
  label: string
  color: 'navy' | 'ruby'
}) {
  const colorClass = color === 'navy' ? 'bg-navy' : 'bg-ruby'
  return (
    <div
      className={`${colorClass} text-cream border-[1.5px] border-jewelInk rounded-full px-3 py-1 flex items-baseline gap-1.5`}
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <span className="font-sans text-[15px] font-extrabold tabular-nums leading-none">
        {value}
      </span>
      <span className="font-sans text-[10px] font-bold uppercase tracking-wider opacity-90">
        {label}
      </span>
    </div>
  )
}
