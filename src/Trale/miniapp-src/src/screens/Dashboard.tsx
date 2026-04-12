import React, { useState } from 'react'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import { CatalogDto, ProgressState, Screen } from '../types'
import { UserLevel } from './Onboarding'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  todayLessons: number
  userLevel: UserLevel
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
export default function Dashboard({ catalog, progress, todayLessons, userLevel, navigate }: Props) {
  const [showAllSections, setShowAllSections] = useState(userLevel === 'intermediate')
  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* ══ Kilim signature strip ══ */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      {/* ══ Stats bar ══ */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="mn-eyebrow">блокнот</div>
        <button
          onClick={() => navigate({ kind: 'profile' })}
          className="flex items-center gap-3 active:opacity-80 transition-opacity"
        >
          <StatPill value={progress.streak} label="дн" color="ruby" />
          <StatPill value={progress.xp} label="опыт" color="navy" />
        </button>
      </div>

      {/* ══ Hero — Bombora tamagotchi + greeting ══ */}
      <section className="px-5 pt-3 pb-4">
        {(() => {
          const { greeting, mascotMood, satiety, satietyText, suggestion } = computeHero(catalog, progress, todayLessons)
          const bowlFill = Math.min(3, todayLessons)
          return (
            <>
              {/* Bombora card — tappable → profile */}
              <button
                onClick={() => navigate({ kind: 'profile' })}
                className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
              >
                <div className="shrink-0 relative">
                  <Mascot mood={mascotMood} size={80} />
                  {/* Bowl indicator */}
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full border border-jewelInk/30 transition-all ${
                          i < bowlFill ? 'bg-gold border-gold' : 'bg-cream-deep'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-geo text-[11px] text-jewelInk-mid leading-none mb-1 font-semibold">
                    {greeting.geo}
                  </div>
                  <div className="font-sans font-extrabold text-[20px] leading-[1.1] text-jewelInk tracking-tight">
                    {greeting.line1}
                  </div>
                  <div className="font-sans text-[13px] text-ruby font-bold leading-tight">
                    {greeting.line2}
                  </div>
                  <div className="mt-1 font-sans text-[11px] text-jewelInk-mid">
                    {satietyText}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-jewelInk-hint">
                  <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

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

      {/* ══ Module sections ══ */}
      {(() => {
        const alphabetIds = ['alphabet-progressive', 'alphabet']
        const grammarIds = ['numbers', 'verbs-of-movement', 'cases', 'pronouns', 'present-tense', 'postpositions', 'adjectives']
        const vocabIds = ['cafe', 'taxi', 'doctor', 'shopping', 'intro', 'emergency']

        const alphaModules = catalog.modules.filter((m) => alphabetIds.includes(m.id))
        const grammar = catalog.modules.filter((m) => grammarIds.includes(m.id))
        const vocab = catalog.modules.filter((m) => vocabIds.includes(m.id))
        const myVocab = catalog.modules.filter((m) => m.id === 'my-vocabulary')

        const isBeginner = userLevel === 'beginner' && !showAllSections

        const sections = [
          { key: 'alphabet', label: isBeginner ? 'начни отсюда' : 'алфавит', geoLabel: 'ანბანი', modules: alphaModules, accent: 'navy' as const, collapsed: false },
          { key: 'grammar', label: 'грамматика', geoLabel: 'გრამატიკა', modules: grammar, accent: 'navy' as const, collapsed: isBeginner },
          { key: 'vocab', label: 'лексика по темам', geoLabel: 'ლექსიკა', modules: vocab, accent: 'gold' as const, collapsed: isBeginner },
          { key: 'myvocab', label: 'мой словарь', geoLabel: 'ლექსიკონი', modules: myVocab, accent: 'ruby' as const, collapsed: false },
        ]

        const moduleIcons: Record<string, string> = {
          'alphabet-progressive': 'ა', 'alphabet': 'ა', 'numbers': '①',
          'postpositions': 'შ', 'adjectives': 'ლ',
          'verbs-of-movement': 'ზ', 'cases': 'ბ', 'pronouns': 'მ',
          'present-tense': 'დ', 'cafe': 'ყ', 'taxi': 'ტ', 'doctor': 'ე',
          'shopping': 'ხ', 'intro': 'გ', 'emergency': 'ს', 'my-vocabulary': 'ლ',
        }

        const moduleGeoLabels: Record<string, string> = {
          'alphabet-progressive': 'ანბანი', 'alphabet': 'ანბანი',
          'numbers': 'რიცხვები', 'postpositions': 'თანდებულები', 'adjectives': 'ზედსართავები',
          'verbs-of-movement': 'ზმნები', 'cases': 'ბრუნვები',
          'pronouns': 'ნაცვალსახელები', 'present-tense': 'აწმყო', 'cafe': 'კაფე',
          'taxi': 'ტაქსი', 'doctor': 'ექიმი', 'shopping': 'მაღაზია',
          'intro': 'გაცნობა', 'emergency': 'დახმარება', 'my-vocabulary': 'ლექსიკონი',
        }

        const moduleAccents: Record<string, 'navy' | 'ruby' | 'gold'> = {
          'alphabet': 'navy', 'verbs-of-movement': 'ruby', 'cases': 'navy',
          'pronouns': 'ruby', 'present-tense': 'navy', 'cafe': 'gold',
          'taxi': 'ruby', 'doctor': 'ruby', 'shopping': 'gold',
          'intro': 'navy', 'emergency': 'ruby', 'my-vocabulary': 'gold',
        }

        let globalIdx = 0

        return (
          <>
          {sections.map((section) => {
          if (section.modules.length === 0) return null

          if (section.collapsed) {
            return (
              <div key={section.key} className="px-5 pt-2 pb-1">
                <button
                  onClick={() => setShowAllSections(true)}
                  className="w-full flex items-center gap-3 py-3 active:opacity-70 transition-opacity"
                >
                  <div className="mn-eyebrow text-jewelInk-mid">{section.label}</div>
                  <div className="flex-1 h-px bg-jewelInk/10" />
                  <span className="font-sans text-[12px] font-bold text-navy">показать все →</span>
                </button>
              </div>
            )
          }

          return (
            <div key={section.key}>
              {/* Section header */}
              <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                <div className="mn-eyebrow">{section.label}</div>
                <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">{section.geoLabel}</div>
                <div className="flex-1 h-px bg-jewelInk/15" />
                <div className="font-sans text-[11px] font-semibold text-jewelInk-mid tabular-nums">
                  {section.modules.length}
                </div>
              </div>

              {/* Module tiles */}
              <section className="px-5 flex flex-col gap-3 pb-2">
                {section.modules.map((m) => {
                  const currentIdx = globalIdx++
                  const hasLessons = m.lessons.length > 0
                  const done = (progress.completedLessons[m.id] ?? []).length
                  const total = m.lessons.length
                  const isComplete = hasLessons && done === total

                  const geoNumerals = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'ჱ', 'თ', 'ი', 'კ', 'ლ']
                  const geoNum = geoNumerals[currentIdx] ?? '?'
                  const icon = moduleIcons[m.id] ?? '?'
                  const moduleGeo = moduleGeoLabels[m.id] ?? ''
                  const accent = moduleAccents[m.id] ?? section.accent
                  const accentBg = accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
                  const accentText = accent === 'navy' ? 'text-navy' : accent === 'ruby' ? 'text-ruby' : 'text-gold-deep'

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.id === 'my-vocabulary') navigate({ kind: 'vocabulary-list' })
                        else navigate({ kind: 'module', moduleId: m.id })
                      }}
                      className="jewel-tile jewel-pressable text-left px-4 py-4"
                      style={{ animationDelay: `${120 + currentIdx * 50}ms` }}
                    >
                      <div className="flex items-center gap-3.5 relative z-[1]">
                        {/* Icon medallion */}
                        <div className="shrink-0 relative">
                          <div
                            className={`w-12 h-12 rounded-xl ${accentBg} border-[1.5px] border-jewelInk flex items-center justify-center`}
                            style={{ boxShadow: '2px 2px 0 #15100A' }}
                          >
                            <span className="font-geo text-[24px] font-extrabold text-cream leading-none">
                              {icon}
                            </span>
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cream border-[1.5px] border-jewelInk flex items-center justify-center">
                            <span className={`font-geo text-[9px] font-bold ${accentText} leading-none`}>
                              {geoNum}
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <h2 className="font-sans text-[17px] font-extrabold text-jewelInk leading-tight tracking-tight truncate">
                              {m.title}
                            </h2>
                            {moduleGeo && (
                              <span className="font-geo text-[10px] text-jewelInk-hint font-semibold shrink-0">
                                {moduleGeo}
                              </span>
                            )}
                          </div>
                          {hasLessons ? (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1">
                                <KilimProgress done={done} total={total} accent={accent} />
                              </div>
                              <span className="font-sans text-[11px] font-bold tabular-nums shrink-0">
                                {isComplete ? (
                                  <span className="text-gold-deep">✓</span>
                                ) : (
                                  <>
                                    <span className={accentText}>{done}</span>
                                    <span className="text-jewelInk-hint">/{total}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <span className="font-sans text-[12px] text-jewelInk-mid">
                                твои слова · квизы на выбор
                              </span>
                            </div>
                          )}
                        </div>

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-jewelInk-hint relative z-[1]">
                          <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>
                  )
                })}
              </section>
            </div>
          )
        })}
          </>
        )
      })()}

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

type SatietyLevel = 'hungry' | 'snack' | 'fed' | 'full' | 'sleeping'

function computeHero(
  catalog: CatalogDto,
  progress: ProgressState,
  todayLessons: number
): {
  greeting: { geo: string; line1: string; line2: string }
  mascotMood: 'happy' | 'cheer' | 'think' | 'guide' | 'sleep'
  satiety: SatietyLevel
  satietyText: string
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

  // Tamagotchi satiety
  let satiety: SatietyLevel
  let satietyText: string

  if (daysSincePlayed > 2) {
    satiety = 'sleeping'
    satietyText = 'скучает по тебе'
  } else if (todayLessons === 0) {
    satiety = 'hungry'
    satietyText = 'ждёт приключений'
  } else if (todayLessons === 1) {
    satiety = 'snack'
    satietyText = 'разогревается'
  } else if (todayLessons === 2) {
    satiety = 'fed'
    satietyText = 'в ударе!'
  } else {
    satiety = 'full'
    satietyText = 'მშვენივრად!'
  }

  // Dynamic greeting tied to satiety
  let greeting: { geo: string; line1: string; line2: string }
  let mascotMood: 'happy' | 'cheer' | 'think' | 'guide' | 'sleep'

  if (totalDone === 0) {
    greeting = { geo: 'გამარჯობა!', line1: 'Привет!', line2: 'Давай начнём' }
    mascotMood = 'cheer'
    satiety = 'hungry'
    satietyText = 'готова к знакомству'
  } else if (satiety === 'sleeping') {
    greeting = { geo: 'მოგესალმებით!', line1: 'О, привет!', line2: 'Бомбора соскучилась' }
    mascotMood = 'sleep'
  } else if (allDone && satiety === 'full') {
    greeting = { geo: 'ყოჩაღ!', line1: 'Все пройдено!', line2: 'Бомбора гордится' }
    mascotMood = 'cheer'
  } else if (satiety === 'full') {
    greeting = { geo: 'შესანიშნავია!', line1: 'Какой день!', line2: 'Бомбора в восторге' }
    mascotMood = 'cheer'
  } else if (satiety === 'fed') {
    greeting = { geo: 'კარგი!', line1: 'Отлично идём!', line2: 'Хочешь ещё?' }
    mascotMood = 'happy'
  } else if (satiety === 'snack') {
    greeting = { geo: 'მადლობა!', line1: 'Хорошее начало!', line2: 'Продолжим?' }
    mascotMood = 'happy'
  } else if (progress.streak >= 3) {
    greeting = { geo: 'შესანიშნავია!', line1: `${progress.streak} дней подряд!`, line2: 'Не останавливайся' }
    mascotMood = 'guide'
  } else {
    greeting = { geo: 'გამარჯობა!', line1: 'Бомбора ждёт!', line2: 'Погнали учиться' }
    mascotMood = 'guide'
  }

  // Suggestion
  let suggestion: {
    eyebrow: string
    title: string
    subtitle: string
    screen: Screen
  } | null = null

  if (nextModule && nextLesson) {
    if (todayLessons > 0 && satiety !== 'hungry') {
      // User already did lessons today — celebrate, then suggest more
      suggestion = {
        eyebrow: 'молодец! ещё?',
        title: nextLesson.title,
        subtitle: `${nextModule.title} · урок ${nextLesson.id}`,
        screen: {
          kind: 'lesson-theory',
          moduleId: nextModule.id,
          lessonId: nextLesson.id
        }
      }
    } else {
      suggestion = {
        eyebrow: satiety === 'hungry' || satiety === 'sleeping' ? 'начать урок' : 'следующий урок',
        title: nextLesson.title,
        subtitle: `${nextModule.title} · урок ${nextLesson.id}`,
        screen: {
          kind: 'lesson-theory',
          moduleId: nextModule.id,
          lessonId: nextLesson.id
        }
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

  return { greeting, mascotMood, satiety, satietyText, suggestion }
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
