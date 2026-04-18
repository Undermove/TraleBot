import React, { useState, useEffect, useRef } from 'react'
import Mascot from '../components/Mascot'
import KilimProgress from '../components/KilimProgress'
import ProBadge from '../components/ProBadge'
import ProPaywall, { PaywallTrigger } from '../components/ProPaywall'
import DashboardTopBar from '../components/DashboardTopBar'
import MilestoneBanner, { XP_MILESTONES, STREAK_MILESTONES } from '../components/MilestoneBanner'
import TreatShop from '../components/TreatShop'
import FeedingAnimation from '../components/FeedingAnimation'
import LaunchPathBar from '../components/LaunchPathBar'
import { CatalogDto, ModuleDto, ProgressState, Screen, PRO_MODULE_IDS } from '../types'
import { UserLevel } from './Onboarding'

const XP_THRESHOLDS = Object.keys(XP_MILESTONES).map(Number)
const STREAK_THRESHOLDS = Object.keys(STREAK_MILESTONES).map(Number)

// Ordered launch path modules shown in «старт» section
const LAUNCH_MODULE_IDS = ['alphabet-progressive', 'numbers', 'intro', 'pronouns', 'present-tense']
// Fixed Georgian numeral letters for the 5 launch tiles (ა=1 … ე=5)
const LAUNCH_GEO_NUMERALS = ['ა', 'ბ', 'გ', 'დ', 'ე']

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
  onProgressUpdate?: (patch: Partial<ProgressState>) => void
  navigate: (s: Screen) => void
}

/**
 * Dashboard — Minankari pilot.
 *
 * 2-section layout:
 *   «старт» — 5 fixed launch modules + LaunchPathBar + «Мой словарь»
 *   «все темы» — all other active modules, collapsible (default: collapsed)
 */
export default function Dashboard({ catalog, progress, todayLessons, userLevel: _userLevel, isPro, isTrialActive = false, trialDaysLeft = 0, onPurchaseSuccess, onProgressUpdate, navigate }: Props) {
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

  // «все темы» collapse state (default: collapsed for all users)
  const [allThemesCollapsed, setAllThemesCollapsed] = useState<boolean>(() => {
    try {
      return (localStorage.getItem('bombora_allthemes_collapsed') ?? 'true') === 'true'
    } catch { return true }
  })

  function toggleAllThemes() {
    setAllThemesCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('bombora_allthemes_collapsed', String(next)) } catch {}
      return next
    })
  }

  // Milestone banner — shown when XP or streak crosses a threshold for the first time
  const [milestone, setMilestone] = useState<{ type: 'xp' | 'streak'; value: number } | null>(null)
  const prevProgressRef = useRef<ProgressState | null>(null)

  // Treat shop state
  const [treatShopOpen, setTreatShopOpen] = useState(false)
  const [feedingAnimation, setFeedingAnimation] = useState<number | null>(null)
  const [feedToast, setFeedToast] = useState<string | null>(null)

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

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* ══ Kilim + stats bar ══ */}
      <DashboardTopBar
        progress={progress}
        onNavigateProfile={() => navigate({ kind: 'profile' })}
        onOpenTreatShop={() => setTreatShopOpen(true)}
      />

      {/* ══ Hero — Bombora tamagotchi + greeting ══ */}
      <section className="px-5 pt-3 pb-4">
        {(() => {
          const { greeting, mascotMood: baseMood, satiety, satietyText, suggestion } = computeHero(catalog, progress, todayLessons)
          const availableXp = Math.max(0, progress.xp - progress.xpSpent)
          const hoursSinceFed = progress.lastFedAtUtc
            ? (Date.now() - new Date(progress.lastFedAtUtc).getTime()) / (1000 * 60 * 60)
            : null
          const isHungry = progress.totalTreatsGiven > 0 && hoursSinceFed !== null && hoursSinceFed >= 24
          // Recently fed — Bombora stays sated for a window after eating
          const recentlyFed = hoursSinceFed !== null && hoursSinceFed < 2
          // Satiety tier derived from the last treat: 0-1 → tier 1 (snack), 2-3 → tier 2 (meal), 4 → tier 3 (feast)
          const satietyTier: 1 | 2 | 3 =
            progress.lastTreatIndex == null
              ? 1
              : progress.lastTreatIndex >= 4
                ? 3
                : progress.lastTreatIndex >= 2
                  ? 2
                  : 1
          // Priority: sated (recently fed) > hungry > baseline
          const mascotMood: 'happy' | 'cheer' | 'think' | 'guide' | 'sleep' | 'hungry' | 'sated' =
            recentlyFed ? 'sated' : isHungry ? 'hungry' : baseMood
          // Single status line — chooses the most contextual message
          const statusLine = recentlyFed
            ? 'Бомбора доволен 💛'
            : isHungry
              ? 'проголодался — покорми'
              : satietyText
          const statusTone = recentlyFed
            ? 'text-ruby'
            : isHungry
              ? 'text-gold-deep'
              : 'text-jewelInk-mid'
          const bowlFill = Math.min(3, todayLessons)
          return (
            <>
              {/* Bombora card — tappable → profile */}
              <button
                onClick={() => navigate({ kind: 'profile' })}
                className="w-full flex flex-col items-center gap-2 text-center active:opacity-80 transition-opacity"
              >
                <div className="relative">
                  <Mascot mood={mascotMood} satietyTier={satietyTier} size={120} />
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
                  <div className="font-sans font-extrabold text-[20px] leading-[1.1] text-jewelInk tracking-tight">
                    {greeting.line1}
                  </div>
                  <div className={`mt-1 font-sans text-[13px] font-semibold ${statusTone}`}>
                    {statusLine}
                  </div>
                </div>
              </button>

              {/* ── Feed button ── */}
              <div className="mt-3 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setTreatShopOpen(true)}
                  className="px-4 py-2 rounded-xl font-sans text-[13px] font-extrabold bg-gold text-jewelInk border-[1.5px] border-jewelInk active:scale-95 transition-transform flex items-center gap-2"
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                >
                  <span className="text-[16px] leading-none">🍖</span>
                  <span>Покормить</span>
                  <span className="text-jewelInk/70 font-bold">· ⭐ {availableXp}</span>
                </button>
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

        // Compute which launch modules are fully completed (for LaunchPathBar)
        const completedModuleIds = LAUNCH_MODULE_IDS.filter((id) => {
          const m = catalog.modules.find((mod) => mod.id === id)
          return m && m.lessons.length > 0 && (progress.completedLessons[id]?.length ?? 0) >= m.lessons.length
        })

        // Launch path: ordered by LAUNCH_MODULE_IDS
        const launchModules = LAUNCH_MODULE_IDS
          .map((id) => catalog.modules.find((m) => m.id === id))
          .filter((m): m is ModuleDto => m !== undefined)

        const myVocabModule = catalog.modules.find((m) => m.id === 'my-vocabulary')

        // «все темы»: all modules except launch path and my-vocabulary
        const allThemesModules = catalog.modules.filter(
          (m) => !LAUNCH_MODULE_IDS.includes(m.id) && m.id !== 'my-vocabulary'
        )

        // Shared tile renderer
        function renderTile(m: ModuleDto, geoNum: string, animIdx: number) {
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
              style={{ animationDelay: `${120 + animIdx * 50}ms` }}
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

        const geoNumerals = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'ჱ', 'თ', 'ი', 'კ', 'ლ']

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

            {/* ── «старт» section header ── */}
            <div className="w-full px-5 pt-4 pb-3 flex items-center gap-3">
              <div className="mn-eyebrow">старт</div>
              <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">დასაწყისი</div>
              <div className="flex-1 h-px bg-jewelInk/15" />
            </div>

            {/* ── Launch modules ა–ე ── */}
            <section className="px-5 flex flex-col gap-3 pb-2">
              {launchModules.map((m, idx) =>
                renderTile(m, LAUNCH_GEO_NUMERALS[idx] ?? '?', idx)
              )}
            </section>

            {/* ── LaunchPathBar ── */}
            <LaunchPathBar
              completedModules={completedModuleIds}
              launchModuleIds={LAUNCH_MODULE_IDS}
            />

            {/* ── «Мой словарь» (ვ) ── */}
            {myVocabModule && (
              <section className="px-5 pb-2">
                {renderTile(myVocabModule, 'ვ', 5)}
              </section>
            )}

            {/* ── «все темы» section header (collapsible) ── */}
            <button
              onClick={toggleAllThemes}
              className="w-full px-5 pt-4 pb-3 flex items-center gap-3 active:opacity-70 transition-opacity"
              style={{ minHeight: 48 }}
            >
              <div className="mn-eyebrow">все темы</div>
              <div className="font-geo text-[10px] text-jewelInk-hint font-semibold">ყველა თემა</div>
              <div className="flex-1 h-px bg-jewelInk/15" />
              <div className="font-sans text-[11px] font-semibold text-jewelInk-mid tabular-nums">
                {allThemesModules.length}
              </div>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                className={`shrink-0 text-jewelInk-mid transition-transform duration-200 ease-out ${allThemesCollapsed ? '-rotate-90' : ''}`}
              >
                <path d="M6 9 L12 15 L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* ── «все темы» module tiles ── */}
            {!allThemesCollapsed && (
              <section className="px-5 flex flex-col gap-3 pb-2">
                {allThemesModules.map((m, idx) =>
                  renderTile(m, geoNumerals[idx] ?? '?', idx)
                )}
              </section>
            )}
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

      {/* Treat shop modal */}
      {treatShopOpen && (
        <TreatShop
          availableXp={Math.max(0, progress.xp - progress.xpSpent)}
          totalTreatsGiven={progress.totalTreatsGiven}
          onFed={(r) => {
            setTreatShopOpen(false)
            onProgressUpdate?.({
              xpSpent: r.xpSpent,
              totalTreatsGiven: r.totalTreatsGiven,
              lastFedAtUtc: r.lastFedAtUtc,
              lastTreatIndex: r.lastTreatIndex,
            })
            setFeedingAnimation(r.treatIndex)
          }}
          onClose={() => setTreatShopOpen(false)}
        />
      )}

      {/* Per-treat feeding animation overlay */}
      {feedingAnimation !== null && (
        <FeedingAnimation
          treatIndex={feedingAnimation}
          onComplete={() => {
            setFeedingAnimation(null)
            setFeedToast('Бомбора доволен! მადლობა 💛')
            setTimeout(() => setFeedToast(null), 2500)
          }}
        />
      )}

      {/* Feed success toast */}
      {feedToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-jewelInk text-cream font-sans text-[14px] font-bold shadow-lg"
          style={{ bottom: 'calc(var(--safe-b) + 24px)' }}
        >
          {feedToast}
        </div>
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
