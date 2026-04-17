import React, { useState, useEffect, useRef } from 'react'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import ProBadge from '../components/ProBadge'
import ProPaywall, { PaywallTrigger } from '../components/ProPaywall'
import DayOfWeekChip from '../components/DayOfWeekChip'
import DashboardTopBar from '../components/DashboardTopBar'
import MilestoneBanner, { XP_MILESTONES, STREAK_MILESTONES } from '../components/MilestoneBanner'
import { CatalogDto, ModuleDto, ProgressState, Screen, PRO_MODULE_IDS } from '../types'
import { UserLevel } from './Onboarding'

const XP_THRESHOLDS = Object.keys(XP_MILESTONES).map(Number)
const STREAK_THRESHOLDS = Object.keys(STREAK_MILESTONES).map(Number)

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

// Ordered unlock chain for beginners: each section unlocks when the previous is fully done
const UNLOCK_CHAIN = ['basics', 'grammar', 'vocab', 'advanced']

function pluralDays(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

function getSectionProgress(
  modules: ModuleDto[],
  completedLessons: Record<string, number[]>
): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const m of modules) {
    total += m.lessons.length
    done += (completedLessons[m.id] ?? []).length
  }
  return { total, done }
}

function isSectionUnlocked(
  key: string,
  sections: Array<{ key: string; modules: ModuleDto[] }>,
  completedLessons: Record<string, number[]>
): boolean {
  if (key === 'basics' || key === 'myvocab') return true
  const idx = UNLOCK_CHAIN.indexOf(key)
  if (idx <= 0) return true
  const prevKey = UNLOCK_CHAIN[idx - 1]
  const prevSection = sections.find((s) => s.key === prevKey)
  if (!prevSection) return true
  const { total, done } = getSectionProgress(prevSection.modules, completedLessons)
  return total > 0 && done >= total
}

/**
 * Dashboard — Minanka pilot.
 *
 * Board game tiles + Georgian enamel palette.
 * Learning-design: module numbers use Georgian numeral letters (ა=1, ბ=2, გ=3),
 * module icons use meaningful Georgian letters that tie into what's taught,
 * product signature is a tiny kilim strip at the top.
 */
export default function Dashboard({ catalog, progress, todayLessons, userLevel, isPro, isTrialActive = false, trialDaysLeft = 0, onPurchaseSuccess, navigate }: Props) {
  const isBeginner = userLevel === 'beginner'
  const hasAccess = isPro || isTrialActive
  const [paywall, setPaywall] = useState<{ trigger: PaywallTrigger } | null>(null)

  // Auto-open paywall when arrived via deep link "?paywall=1" — used by the
  // bot's "💳 Оплатить подписку" button so users land straight on the sheet.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('paywall') === '1' && !isPro) {
      setPaywall({ trigger: 'module' })
      // Strip the query so a manual reload doesn't keep popping the paywall
      const url = new URL(window.location.href)
      url.searchParams.delete('paywall')
      window.history.replaceState({}, '', url.toString())
    }
  }, [isPro])

  // Section data — defined early so unlock logic can reference them
  const basicsIds = ['alphabet-progressive', 'intro', 'numbers']
  const grammarIds = ['pronouns', 'present-tense', 'cases', 'postpositions', 'adjectives']
  const vocabIds = ['cafe', 'shopping', 'taxi', 'doctor', 'emergency']
  const advancedIds = [
    'verb-classes', 'version-vowels', 'preverbs', 'imperfect', 'aorist',
    'pronoun-declension', 'conditionals', 'verbs-of-movement',
  ]

  const basics = catalog.modules.filter((m) => basicsIds.includes(m.id))
  const grammar = catalog.modules.filter((m) => grammarIds.includes(m.id))
  const vocab = catalog.modules.filter((m) => vocabIds.includes(m.id))
  const advanced = catalog.modules.filter((m) => advancedIds.includes(m.id))
  const myVocab = catalog.modules.filter((m) => m.id === 'my-vocabulary')

  const sections = [
    { key: 'basics', label: 'основы', geoLabel: 'საფუძვლები', modules: basics, accent: 'navy' as const },
    { key: 'grammar', label: 'грамматика', geoLabel: 'გრამატიკა', modules: grammar, accent: 'navy' as const },
    { key: 'vocab', label: 'лексика по темам', geoLabel: 'ლექსიკა', modules: vocab, accent: 'gold' as const },
    { key: 'advanced', label: 'продвинутое', geoLabel: 'გაღრმავება', modules: advanced, accent: 'ruby' as const },
    { key: 'myvocab', label: 'мой словарь', geoLabel: 'ლექსიკონი', modules: myVocab, accent: 'ruby' as const },
  ]

  // Per-section collapse state (persisted in localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('bombora_collapsed')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Sections currently playing the one-time unlock animation
  const [animatingSections, setAnimatingSections] = useState<Set<string>>(new Set())
  // Temporary mascot cheer after unlock sequence (step 5: 500ms in, lasts 2s)
  const [mascotCheering, setMascotCheering] = useState(false)

  // Milestone banner — shown when XP or streak crosses a threshold for the first time
  const [milestone, setMilestone] = useState<{ type: 'xp' | 'streak'; value: number } | null>(null)
  const prevProgressRef = useRef<ProgressState | null>(null)

  // Detect newly unlocked sections on mount — play the one-time animation sequence
  useEffect(() => {
    if (!isBeginner) return
    try {
      const saved = localStorage.getItem('bombora_unlocked_once')
      const prevSeen = new Set<string>(saved ? JSON.parse(saved) : [])

      const newlyUnlocked: string[] = []
      for (const section of sections) {
        if (section.key === 'basics' || section.key === 'myvocab') continue
        if (
          isSectionUnlocked(section.key, sections, progress.completedLessons) &&
          !prevSeen.has(section.key)
        ) {
          newlyUnlocked.push(section.key)
        }
      }

      if (newlyUnlocked.length > 0) {
        // Persist so animation only plays once per section unlock
        localStorage.setItem(
          'bombora_unlocked_once',
          JSON.stringify([...prevSeen, ...newlyUnlocked])
        )
        // Auto-expand newly unlocked sections so tiles are visible
        setCollapsedSections((prev) => {
          const next = { ...prev }
          for (const key of newlyUnlocked) next[key] = false
          try { localStorage.setItem('bombora_collapsed', JSON.stringify(next)) } catch {}
          return next
        })
        setAnimatingSections(new Set(newlyUnlocked))
        // Bombora cheers at 500ms (step 5 of animation sequence)
        const cheerTimer = setTimeout(() => {
          setMascotCheering(true)
          setTimeout(() => setMascotCheering(false), 2000)
        }, 500)
        // Clear animation classes after 600ms (sequence complete)
        const clearTimer = setTimeout(() => setAnimatingSections(new Set()), 600)
        return () => { clearTimeout(cheerTimer); clearTimeout(clearTimer) }
      }
    } catch { /* ignore storage errors */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect milestone crossings — show banner once per threshold
  useEffect(() => {
    const prev = prevProgressRef.current
    if (prev) {
      // Check XP milestones
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
      // Check streak milestones
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

  // Toggle using the current visual state so beginner defaults are respected
  function toggleSection(key: string, currentlyCollapsed: boolean) {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !currentlyCollapsed }
      try { localStorage.setItem('bombora_collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

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
          const { greeting, mascotMood: baseMood, satiety, satietyText, suggestion } = computeHero(catalog, progress, todayLessons)
          // Override mascot mood during unlock celebration
          const mascotMood = mascotCheering ? 'cheer' : baseMood
          const bowlFill = Math.min(3, todayLessons)
          return (
            <>
              {/* Bombora card — tappable → profile */}
              <button
                onClick={() => navigate({ kind: 'profile' })}
                className="w-full flex flex-col items-center gap-2 text-center active:opacity-80 transition-opacity"
              >
                <div className="relative">
                  <Mascot mood={mascotMood} size={120} />
                  {/* Bowl indicator */}
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
                  <div className="font-geo text-[12px] text-jewelInk-mid leading-none mb-1 font-semibold">
                    {greeting.geo}
                  </div>
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

              {/* ── Georgian day of week chip ── */}
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

      {/* ══ Module sections ══ */}
      {(() => {
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
          'alphabet': 'navy', 'verbs-of-movement': 'ruby', 'cases': 'navy',
          'pronouns': 'ruby', 'present-tense': 'navy', 'cafe': 'gold',
          'taxi': 'ruby', 'doctor': 'ruby', 'shopping': 'gold',
          'intro': 'navy', 'emergency': 'ruby', 'my-vocabulary': 'gold',
        }

        let globalIdx = 0

        return (
          <>
          {/* Trial banner — visible while trial is active (not for Pro users) */}
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
          {sections.map((section) => {
            if (section.modules.length === 0) return null

            // Section-level locking is disabled — users can expand any section.
            // Per-module gating (isProLocked) handles Pro/trial access below.
            const isLocked = false
            const isAnimatingUnlock = animatingSections.has(section.key)

            // Determine collapsed state: localStorage overrides beginner defaults
            const hasUserInteracted = Object.prototype.hasOwnProperty.call(collapsedSections, section.key)
            const defaultCollapsed = isBeginner && section.key !== 'basics' && section.key !== 'myvocab'
            const isUserCollapsed = hasUserInteracted ? collapsedSections[section.key] === true : defaultCollapsed

            // Compute locked hint: show when previous section is ≥80% done
            let lockedHint: string | null = null
            if (isLocked) {
              const chainIdx = UNLOCK_CHAIN.indexOf(section.key)
              if (chainIdx > 0) {
                const prevKey = UNLOCK_CHAIN[chainIdx - 1]
                const prevSection = sections.find((s) => s.key === prevKey)
                if (prevSection) {
                  const { total, done } = getSectionProgress(prevSection.modules, progress.completedLessons)
                  if (total > 0 && done / total >= 0.8) {
                    const remaining = total - done
                    lockedHint = remaining === 1
                      ? 'ერთი გაკვეთილი — и раздел откроется'
                      : `Ещё ${remaining} уроков до разблокировки`
                  }
                }
              }
            }

            return (
              <div key={section.key}>
                {/* Section header */}
                {isLocked ? (
                  /* Locked: visual-only, не реагирует на тапы */
                  <div
                    className="w-full px-5 pt-4 pb-3 flex items-center gap-3 opacity-60 transition-opacity duration-200"
                    style={{ pointerEvents: 'none' }}
                    role="button"
                    aria-disabled="true"
                    aria-label="Раздел заблокирован. Пройдите предыдущий раздел, чтобы открыть."
                  >
                    <div className="mn-eyebrow">{section.label}</div>
                    <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">{section.geoLabel}</div>
                    <div className="flex-1 h-px bg-jewelInk/15" />
                    {/* Lock icon — 12×12 padlock */}
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      className="shrink-0 text-jewelInk-hint"
                      aria-hidden="true"
                    >
                      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : (
                  /* Unlocked — tappable to collapse/expand, gold pulse animation on first unlock */
                  <button
                    onClick={() => toggleSection(section.key, isUserCollapsed)}
                    className={`w-full px-5 pt-4 pb-3 flex items-center gap-3 active:opacity-70 transition-opacity${isAnimatingUnlock ? ' unlock-pulse' : ''}`}
                  >
                    <div className="mn-eyebrow">{section.label}</div>
                    <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">{section.geoLabel}</div>
                    <div className="flex-1 h-px bg-jewelInk/15" />
                    <div className="font-sans text-[11px] font-semibold text-jewelInk-mid tabular-nums">
                      {section.modules.length}
                    </div>
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      className={`shrink-0 text-jewelInk-mid transition-transform duration-200 ease-out ${isUserCollapsed ? '-rotate-90' : ''}`}
                    >
                      <path d="M6 9 L12 15 L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}

                {/* Hint below locked header — appears when previous section is ≥80% done */}
                {lockedHint && (
                  <div className="font-sans text-[11px] text-jewelInk-hint px-5 pb-2">
                    {lockedHint}
                  </div>
                )}

                {/* Module tiles — hidden when locked or collapsed */}
                {!isLocked && !isUserCollapsed && (
                  <section className="px-5 flex flex-col gap-3 pb-2">
                    {section.modules.map((m, tileIdx) => {
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

                      // During unlock animation: stagger tiles from 300ms (spec step 4); otherwise normal entrance
                      const tileAnimClass = isAnimatingUnlock ? ' tile-appear' : ''
                      const tileAnimDelay = isAnimatingUnlock
                        ? 300 + tileIdx * 60
                        : 120 + currentIdx * 50

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
                          className={`jewel-tile jewel-pressable text-left px-4 py-4${tileAnimClass}`}
                          style={{ animationDelay: `${tileAnimDelay}ms` }}
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
                    })}
                  </section>
                )}
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

      {/* Milestone banner — slides up from bottom on first XP/streak threshold */}
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

