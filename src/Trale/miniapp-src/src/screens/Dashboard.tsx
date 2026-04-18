import React, { useState, useEffect, useRef } from 'react'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import ProBadge from '../components/ProBadge'
import ProPaywall, { PaywallTrigger } from '../components/ProPaywall'
import DayOfWeekChip from '../components/DayOfWeekChip'
import DashboardTopBar from '../components/DashboardTopBar'
import MilestoneBanner, { XP_MILESTONES, STREAK_MILESTONES } from '../components/MilestoneBanner'
import TimeGreeting from '../components/TimeGreeting'
import { CatalogDto, ModuleDto, ProgressState, Screen, PRO_MODULE_IDS } from '../types'
import { UserLevel } from './Onboarding'

const XP_THRESHOLDS = Object.keys(XP_MILESTONES).map(Number)
const STREAK_THRESHOLDS = Object.keys(STREAK_MILESTONES).map(Number)

// Ordered launch modules (fixed sequence ა→ბ→გ→დ→ე)
const LAUNCH_MODULE_IDS = ['alphabet-progressive', 'numbers', 'intro', 'pronouns', 'present-tense']

// Extra modules — all other topics rendered below launch + vocab, grouped
// into three sub-blocks (grammar → situations → advanced verbs) inside the
// collapsible "все темы" section.
const EXTRA_GROUPS: Array<{
  ruTitle: string
  geoTitle: string
  moduleIds: string[]
}> = [
  {
    ruTitle: 'грамматика',
    geoTitle: 'გრამატიკა',
    moduleIds: ['cases', 'postpositions', 'adjectives'],
  },
  {
    ruTitle: 'ситуации',
    geoTitle: 'სიტუაციები',
    moduleIds: ['cafe', 'shopping', 'taxi', 'doctor', 'emergency'],
  },
  {
    ruTitle: 'глаголы · продвинутое',
    geoTitle: 'ზმნები',
    moduleIds: [
      'verb-classes', 'version-vowels', 'preverbs', 'imperfect', 'aorist',
      'pronoun-declension', 'conditionals', 'verbs-of-movement',
    ],
  },
]

// Georgian letter numerals for launch tiles (ა=1 … ვ=6)
const GEO_LAUNCH_NUMERALS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ']

// Continued Georgian letters (ზ=7 … ქ=22) for extra-section badges,
// consumed sequentially across all three sub-blocks.
const GEO_EXTRA_NUMERALS = [
  'ზ', 'თ', 'ი', 'კ', 'ლ', 'მ', 'ნ', 'ო',
  'პ', 'ჟ', 'რ', 'ს', 'ტ', 'უ', 'ფ', 'ქ',
]

function pluralDays(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  todayLessons: number
  userLevel: UserLevel
  isPro: boolean
  isTrialActive?: boolean
  trialDaysLeft?: number
  onPurchaseSuccess: () => void
  navigate: (s: Screen) => void
}

/**
 * Dashboard — Minanka pilot.
 *
 * Board game tiles + Georgian enamel palette.
 * Learning-design: module numbers use Georgian numeral letters (ა=1, ბ=2, გ=3),
 * module icons use meaningful Georgian letters that tie into what's taught,
 * product signature is a tiny kilim strip at the top.
 *
 * Layout:
 *   Hero → LaunchSection (5 modules) → MyVocab → ExtraTopics (grammar / situations / verbs) → Profile
 */
export default function Dashboard({ catalog, progress, todayLessons, userLevel, isPro, isTrialActive = false, trialDaysLeft = 0, onPurchaseSuccess, navigate }: Props) {
  const hasAccess = isPro || isTrialActive
  const [paywall, setPaywall] = useState<{ trigger: PaywallTrigger } | null>(null)

  // Auto-open paywall when arrived via deep link "?paywall=1"
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('paywall') === '1' && !isPro) {
      setPaywall({ trigger: 'module' })
      const url = new URL(window.location.href)
      url.searchParams.delete('paywall')
      window.history.replaceState({}, '', url.toString())
    }
  }, [isPro])

  // Milestone banner
  const [milestone, setMilestone] = useState<{ type: 'xp' | 'streak'; value: number } | null>(null)
  const prevProgressRef = useRef<ProgressState | null>(null)

  useEffect(() => {
    const prev = prevProgressRef.current
    if (prev) {
      for (const threshold of XP_THRESHOLDS) {
        if (prev.xp < threshold && progress.xp >= threshold) {
          const key = `bombora_milestone_xp_${threshold}`
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1')
            setMilestone({ type: 'xp', value: threshold })
            break
          }
        }
      }
      for (const threshold of STREAK_THRESHOLDS) {
        if (prev.streak < threshold && progress.streak >= threshold) {
          const key = `bombora_milestone_streak_${threshold}`
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1')
            setMilestone({ type: 'streak', value: threshold })
            break
          }
        }
      }
    }
    prevProgressRef.current = progress
  }, [progress.xp, progress.streak])

  // Extra-modules collapse state — persisted in localStorage, collapsed by default
  // so the dashboard stays focused on the launch path; tap to expand all topics.
  const [extraCollapsed, setExtraCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bombora_extra_collapsed')
      return saved !== null ? JSON.parse(saved) : true
    } catch { return true }
  })

  function toggleExtra() {
    setExtraCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('bombora_extra_collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Module metadata
  const moduleIcons: Record<string, string> = {
    'alphabet-progressive': 'ა', 'alphabet': 'ა', 'numbers': '①',
    'postpositions': 'შ', 'adjectives': 'ლ',
    'verb-classes': 'ზ', 'version-vowels': 'უ', 'preverbs': 'და', 'imperfect': 'დ',
    'aorist': 'მ', 'pronoun-declension': 'ი', 'conditionals': 'თ',
    'verbs-of-movement': 'ზ', 'cases': 'ბ', 'pronouns': 'მ',
    'present-tense': 'დ', 'cafe': 'ყ', 'taxi': 'ტ', 'doctor': 'ე',
    'shopping': 'ხ', 'intro': 'გ', 'emergency': 'ს', 'my-vocabulary': 'ლ',
  }

  const moduleGeoLabels: Record<string, string> = {
    'alphabet-progressive': 'ანბანი', 'alphabet': 'ანბანი',
    'numbers': 'რიცხვები', 'postpositions': 'თანდებულები', 'adjectives': 'ზედსართავები',
    'verb-classes': 'ზმნის კლასები', 'version-vowels': 'ვერსია', 'preverbs': 'პრევერბები',
    'imperfect': 'უწყვეტელი', 'aorist': 'წყვეტილი', 'pronoun-declension': 'ბრუნვა',
    'conditionals': 'პირობითი',
    'verbs-of-movement': 'ზმნები', 'cases': 'ბრუნვები',
    'pronouns': 'ნაცვალსახელები', 'present-tense': 'აწმყო', 'cafe': 'კაფე',
    'taxi': 'ტაქსი', 'doctor': 'ექიმი', 'shopping': 'მაღაზია',
    'intro': 'გაცნობა', 'emergency': 'დახმარება', 'my-vocabulary': 'ლექსიკონი',
  }

  const moduleAccents: Record<string, 'navy' | 'ruby' | 'gold'> = {
    'alphabet-progressive': 'navy', 'alphabet': 'navy',
    'numbers': 'navy', 'intro': 'navy', 'pronouns': 'ruby', 'present-tense': 'navy',
    'verb-classes': 'ruby', 'version-vowels': 'navy', 'preverbs': 'navy', 'imperfect': 'navy',
    'aorist': 'navy', 'pronoun-declension': 'navy', 'conditionals': 'navy',
    'verbs-of-movement': 'ruby', 'cases': 'navy',
    'cafe': 'gold', 'taxi': 'ruby', 'doctor': 'ruby', 'shopping': 'gold',
    'emergency': 'ruby', 'my-vocabulary': 'gold',
  }

  // Build module lookup from catalog
  const moduleById = Object.fromEntries(catalog.modules.map((m) => [m.id, m]))

  function renderModuleTile(m: ModuleDto, geoNum: string, tileIdx: number) {
    const hasLessons = m.lessons.length > 0
    const done = (progress.completedLessons[m.id] ?? []).length
    const total = m.lessons.length
    const isComplete = hasLessons && done === total
    const icon = moduleIcons[m.id] ?? '?'
    const moduleGeo = moduleGeoLabels[m.id] ?? ''
    const accent = moduleAccents[m.id] ?? 'navy'
    const accentBg = accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
    const accentText = accent === 'navy' ? 'text-navy' : accent === 'ruby' ? 'text-ruby' : 'text-gold-deep'
    const isProLocked = !hasAccess && PRO_MODULE_IDS.has(m.id)
    const isVocabAtLimit = !hasAccess && m.id === 'my-vocabulary' && (progress.completedLessons['my-vocabulary']?.length ?? 0) >= 50

    return (
      <button
        key={m.id}
        onClick={() => {
          if (isProLocked) {
            setPaywall({ trigger: 'module' })
          } else if (isVocabAtLimit) {
            setPaywall({ trigger: 'vocabulary_limit' })
          } else if (m.id === 'my-vocabulary') {
            navigate({ kind: 'vocabulary-list' })
          } else {
            navigate({ kind: 'module', moduleId: m.id })
          }
        }}
        className="jewel-tile jewel-pressable text-left px-4 py-4"
        style={{ animationDelay: `${120 + tileIdx * 50}ms` }}
      >
        <div className="flex items-center gap-3.5 relative z-[1]">
          {/* Icon medallion */}
          <div className="shrink-0 relative">
            <div
              className={`w-12 h-12 rounded-xl ${accentBg} border-[1.5px] border-jewelInk flex items-center justify-center${isProLocked ? ' opacity-60' : ''}`}
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
            <div className="flex items-center gap-2">
              <h2 className="font-sans text-[17px] font-extrabold text-jewelInk leading-tight tracking-tight truncate">
                {m.title}
              </h2>
              {moduleGeo && (
                <span className="font-geo text-[10px] text-jewelInk-hint font-semibold shrink-0">
                  {moduleGeo}
                </span>
              )}
              {(isProLocked || isVocabAtLimit) && (
                <span className="shrink-0 ml-auto">
                  <ProBadge />
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
                  ) : isProLocked ? (
                    <span className="text-jewelInk-hint">{total} уроков</span>
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
                  {isVocabAtLimit ? '50 слов — лимит Free' : 'твои слова · квизы на выбор'}
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
  }

  // Modules for each section
  const launchModules = LAUNCH_MODULE_IDS.map((id) => moduleById[id]).filter(Boolean) as ModuleDto[]
  const myVocabModule = moduleById['my-vocabulary']

  // Resolve extra groups against the catalog — drop any id the backend didn't
  // return, then compute a single sequential numeral index for badge assignment.
  const extraGroupsResolved = EXTRA_GROUPS.map((g) => ({
    ruTitle: g.ruTitle,
    geoTitle: g.geoTitle,
    modules: g.moduleIds.map((id) => moduleById[id]).filter(Boolean) as ModuleDto[],
  })).filter((g) => g.modules.length > 0)
  const extraCount = extraGroupsResolved.reduce((sum, g) => sum + g.modules.length, 0)

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* ══ Kilim + stats bar ══ */}
      <DashboardTopBar
        progress={progress}
        onNavigateProfile={() => navigate({ kind: 'profile' })}
      />

      {/* ══ Hero — Bombora tamagotchi + greeting ══ */}
      <section className="px-5 pt-3 pb-4">
        {(() => {
          const { greeting, mascotMood, satiety, satietyText, suggestion } = computeHero(catalog, progress, todayLessons)
          const bowlFill = Math.min(3, todayLessons)
          return (
            <>
              <button
                onClick={() => navigate({ kind: 'profile' })}
                className="w-full flex flex-col items-center gap-2 text-center active:opacity-80 transition-opacity"
              >
                <div className="relative">
                  <Mascot mood={mascotMood} size={120} />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full border-2 transition-all ${
                          i < bowlFill ? 'bg-gold border-gold shadow-sm' : 'bg-cream-deep border-jewelInk/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <TimeGreeting />
                  <div className="font-sans font-extrabold text-[22px] leading-[1.1] text-jewelInk tracking-tight">
                    {greeting.line1}
                  </div>
                  <div className="font-sans text-[14px] text-ruby font-bold leading-tight mt-0.5">
                    {greeting.line2}
                  </div>
                  <div className="mt-1.5 font-sans text-[12px] text-jewelInk-mid">
                    {satietyText}
                  </div>
                </div>
              </button>

              <div className="mt-2 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                <DayOfWeekChip />
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

      {/* ══ Trial banner ══ */}
      {isTrialActive && !isPro && trialDaysLeft > 0 && (
        <div className="px-5 pt-2 pb-1">
          <div
            className="jewel-tile px-4 py-3 flex items-center gap-3"
            style={{ background: '#FBF6EC' }}
          >
            <div className="relative z-[1] text-[22px] leading-none shrink-0">⭐</div>
            <div className="relative z-[1] flex-1 min-w-0">
              <div className="font-sans text-[13px] font-extrabold text-jewelInk leading-tight">
                Бесплатный период — {trialDaysLeft} {pluralDays(trialDaysLeft)} осталось
              </div>
              <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
                Все модули открыты — учи грузинский без ограничений
              </div>
            </div>
            <button
              onClick={() => setPaywall({ trigger: 'module' })}
              className="relative z-[1] shrink-0 px-3 py-1.5 rounded-lg font-sans text-[11px] font-extrabold"
              style={{ background: '#F5B820', color: '#15100A', border: '1.5px solid #15100A' }}
            >
              купить
            </button>
          </div>
        </div>
      )}

      {/* ══ Launch section — «старт» ══ */}
      <div>
        {/* Section header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="mn-eyebrow">старт</div>
          <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">დასაწყისი</div>
          <div className="flex-1 h-px bg-jewelInk/15" />
        </div>

        {/* Launch module tiles */}
        <section className="px-5 flex flex-col gap-3 pb-2">
          {launchModules.map((m, idx) =>
            renderModuleTile(m, GEO_LAUNCH_NUMERALS[idx] ?? '?', idx)
          )}
        </section>

        {/* My Vocabulary — ვ (6th, always present) */}
        {myVocabModule && (
          <section className="px-5 pb-3 pt-1">
            {renderModuleTile(myVocabModule, 'ვ', launchModules.length)}
          </section>
        )}
      </div>

      {/* ══ All other topics — «все темы», grouped by block (collapsible) ══ */}
      {extraCount > 0 && (
        <div>
          {/* Section header — tappable to collapse/expand the whole area */}
          <button
            onClick={toggleExtra}
            className="w-full px-5 pt-4 pb-3 flex items-center gap-3 active:opacity-70 transition-opacity"
            style={{ minHeight: 48 }}
          >
            <div className="mn-eyebrow">все темы</div>
            <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">ყველა თემა</div>
            <div className="flex-1 h-px bg-jewelInk/15" />
            <div className="font-sans text-[11px] font-bold text-jewelInk-hint tabular-nums">
              {extraCount}
            </div>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              className={`shrink-0 text-jewelInk-mid transition-transform duration-200 ease-out ${extraCollapsed ? '-rotate-90' : ''}`}
            >
              <path d="M6 9 L12 15 L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Sub-blocks: грамматика / ситуации / глаголы — each with its own
              lighter eyebrow, tiles rendered via the same active renderer,
              Georgian numeral badges continue across blocks (ზ→ქ). */}
          {!extraCollapsed && (() => {
            let numeralCursor = 0
            let tileCursor = launchModules.length + 1
            return (
              <div className="flex flex-col gap-2">
                {extraGroupsResolved.map((group) => (
                  <div key={group.ruTitle}>
                    {/* Sub-block header — smaller, no interaction */}
                    <div className="px-5 pt-3 pb-2 flex items-center gap-3">
                      <div
                        className="font-sans text-[10px] font-extrabold uppercase tracking-wider text-jewelInk-mid"
                      >
                        {group.ruTitle}
                      </div>
                      <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">
                        {group.geoTitle}
                      </div>
                      <div className="flex-1 h-px bg-jewelInk/10" />
                    </div>

                    <section className="px-5 flex flex-col gap-3 pb-1">
                      {group.modules.map((m) => {
                        const geoNum = GEO_EXTRA_NUMERALS[numeralCursor] ?? '?'
                        const tileIdx = tileCursor
                        numeralCursor++
                        tileCursor++
                        return renderModuleTile(m, geoNum, tileIdx)
                      })}
                    </section>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ══ Profile button ══ */}
      <div className="px-5 pb-6 pt-2">
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

      {/* ══ Bottom kilim strip ══ */}
      <div className="mt-auto">
        <div className="mn-kilim opacity-70" />
      </div>

      <div style={{ height: 'calc(var(--safe-b) + 12px)' }} />

      {/* Pro Paywall */}
      {paywall && (
        <ProPaywall
          trigger={paywall.trigger}
          onClose={() => setPaywall(null)}
          onPurchaseSuccess={() => {
            setPaywall(null)
            onPurchaseSuccess()
          }}
        />
      )}

      {/* Milestone banner */}
      {milestone && (
        <MilestoneBanner
          type={milestone.type}
          value={milestone.value}
          onDismiss={() => setMilestone(null)}
        />
      )}
    </div>
  )
}

type SatietyLevel = 'hungry' | 'snack' | 'fed' | 'full' | 'sleeping'

function computeHero(
  catalog: CatalogDto,
  progress: ProgressState,
  todayLessons: number
): {
  greeting: { line1: string; line2: string }
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

  const daysSincePlayed = progress.lastPlayedDate
    ? Math.floor(
        (Date.now() - new Date(progress.lastPlayedDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : -1

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

  let greeting: { line1: string; line2: string }
  let mascotMood: 'happy' | 'cheer' | 'think' | 'guide' | 'sleep'

  if (totalDone === 0) {
    greeting = { line1: 'Привет!', line2: 'Давай начнём' }
    mascotMood = 'cheer'
    satiety = 'hungry'
    satietyText = 'готова к знакомству'
  } else if (satiety === 'sleeping') {
    greeting = { line1: 'О, привет!', line2: 'Бомбора соскучилась' }
    mascotMood = 'sleep'
  } else if (allDone && satiety === 'full') {
    greeting = { line1: 'Все пройдено!', line2: 'Бомбора гордится' }
    mascotMood = 'cheer'
  } else if (satiety === 'full') {
    greeting = { line1: 'Какой день!', line2: 'Бомбора в восторге' }
    mascotMood = 'cheer'
  } else if (satiety === 'fed') {
    greeting = { line1: 'Отлично идём!', line2: 'Хочешь ещё?' }
    mascotMood = 'happy'
  } else if (satiety === 'snack') {
    greeting = { line1: 'Хорошее начало!', line2: 'Продолжим?' }
    mascotMood = 'happy'
  } else if (progress.streak >= 3) {
    greeting = { line1: `${progress.streak} дней подряд!`, line2: 'Не останавливайся' }
    mascotMood = 'guide'
  } else {
    greeting = { line1: 'Бомбора ждёт!', line2: 'Погнали учиться' }
    mascotMood = 'guide'
  }

  let suggestion: {
    eyebrow: string
    title: string
    subtitle: string
    screen: Screen
  } | null = null

  if (nextModule && nextLesson) {
    if (todayLessons > 0 && satiety !== 'hungry') {
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
