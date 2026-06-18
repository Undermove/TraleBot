import React, { useEffect, useState } from 'react'
import { CatalogDto, ProgressState, Screen } from './types'
import { defaultProgress, progressFromDto } from './progress'
import { resolveEntryScreen, hasEarnedXp } from './entryFlow'
import { api } from './api'
import Dashboard from './screens/Dashboard'
import ModuleMap from './screens/ModuleMap'
import LessonTheory from './screens/LessonTheory'
import Practice from './screens/Practice'
import PracticeMistakes from './screens/PracticeMistakes'
import Result from './screens/Result'
import MistakesResult from './screens/MistakesResult'
import Profile from './screens/Profile'
import AdminScreen from './screens/AdminScreen'
import AdminUserScreen from './screens/AdminUserScreen'
import VocabularyList from './screens/VocabularyList'
import VocabularyPractice from './screens/VocabularyPractice'
import LandingScreen from './screens/LandingScreen'
import Onboarding, { UserLevel } from './screens/Onboarding'
import Welcome from './screens/Welcome'
import Mascot from './components/Mascot'
import LoaderLetter from './components/LoaderLetter'

function isInsideTelegram(): boolean {
  if (new URLSearchParams(window.location.search).get('playwright') === '1') return true
  const tg = (window as any).Telegram?.WebApp
  return Boolean(tg?.initData && tg.initData.length > 0)
}

function getTodayLessons(): number {
  try {
    const raw = localStorage.getItem('bombora_today')
    if (!raw) return 0
    const { date, count } = JSON.parse(raw)
    if (date === new Date().toISOString().slice(0, 10)) return count
  } catch {}
  return 0
}

function incrementTodayLessons(): number {
  const today = new Date().toISOString().slice(0, 10)
  const current = getTodayLessons()
  const next = current + 1
  localStorage.setItem('bombora_today', JSON.stringify({ date: today, count: next }))
  return next
}

// Deep-link routing: a push opens the WebApp at e.g.
// ?screen=practice&moduleId=…&lessonId=… (or ?screen=feed). Resolve that to a
// concrete screen — validated against the catalog — so the notification lands on
// the actual lesson / dashboard, not just "the app".
function parseDeepLink(catalog: CatalogDto): Screen | null {
  try {
    const p = new URLSearchParams(window.location.search)
    const target = p.get('screen')
    const moduleId = p.get('moduleId')
    const lessonIdRaw = p.get('lessonId')
    const lessonId = lessonIdRaw ? parseInt(lessonIdRaw, 10) : null

    if (target === 'feed') return { kind: 'dashboard' } // Bombora is fed on the dashboard
    if (target === 'vocabulary') return { kind: 'vocabulary-list' }

    if (moduleId) {
      const mod = catalog.modules.find((m) => m.id === moduleId)
      if (!mod) return null
      if (lessonId != null && Number.isFinite(lessonId) && mod.lessons.some((l) => l.id === lessonId)) {
        return { kind: 'practice', moduleId, lessonId }
      }
      return { kind: 'module', moduleId }
    }
    return null
  } catch {
    return null
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' })
  const [progress, setProgress] = useState<ProgressState>(defaultProgress)
  const [catalog, setCatalog] = useState<CatalogDto | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [insideTelegram] = useState(() => isInsideTelegram())
  const [todayLessons, setTodayLessons] = useState(() => getTodayLessons())
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [isTrialActive, setIsTrialActive] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [shouldShowReferralExtensionCta, setShouldShowReferralExtensionCta] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [telegramId, setTelegramId] = useState<number | null>(null)
  const [showProSuccessToast, setShowProSuccessToast] = useState(false)
  const [vocabularyCount, setVocabularyCount] = useState<number>(0)
  const [onboardingHint, setOnboardingHint] = useState<string | null>(null)

  // Load catalog + progress from backend on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([api.content(), api.me().catch(() => null)])
      .then(([catalogData, meData]) => {
        if (cancelled) return
        setCatalog(catalogData)
        let loadedProgress = defaultProgress
        if (meData?.authenticated && meData.progress) {
          setAuthenticated(true)
          loadedProgress = progressFromDto(meData.progress)
          setProgress(loadedProgress)
          if (meData.level === 'beginner' || meData.level === 'intermediate') {
            setUserLevel(meData.level)
          }
          setIsPro(meData.isPro ?? false)
          setIsTrialActive((meData as any).isTrialActive ?? false)
          setTrialDaysLeft((meData as any).trialDaysLeft ?? 0)
          setShouldShowReferralExtensionCta((meData as any).shouldShowReferralExtensionCta ?? false)
          setIsOwner((meData as any).isOwner ?? false)
          setTelegramId((meData as any).telegramId ?? null)
          setVocabularyCount((meData as any).vocabularyCount ?? 0)
          setOnboardingHint((meData as any).onboardingHint ?? null)
        }
        const hasLevel = meData?.level === 'beginner' || meData?.level === 'intermediate'
        const deepLink = hasLevel ? parseDeepLink(catalogData) : null
        if (deepLink) {
          // Consume the params so a later refresh/back doesn't re-force the deep-link.
          window.history.replaceState({}, '', window.location.pathname)
        }
        // A push deep-link wins; otherwise resolveEntryScreen decides — a brand-new
        // user (level but no XP) gets the welcome lesson, and the dashboard hub is
        // revealed only once that first XP is earned. See entryFlow.resolveEntryScreen.
        setScreen(deepLink ?? resolveEntryScreen({ hasLevel, progress: loadedProgress, catalog: catalogData }))
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleProPurchaseSuccess() {
    api.me().then((meData) => {
      if (meData.isPro) {
        setIsPro(true)
        setShowProSuccessToast(true)
        setTimeout(() => setShowProSuccessToast(false), 3500)
      }
    }).catch(() => {
      // silently ignore; next app open will re-fetch
    })
  }

  // Telegram BackButton integration
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg?.BackButton) return
    // The welcome lesson is the brand-new-user entry point and, while the user
    // hasn't earned any XP, so is the first lesson — no back button on either, so
    // they can't slip past the soft onboarding into the hidden hub.
    const inPreXpFirstLesson = !hasEarnedXp(progress) && screen.kind === 'lesson-theory'
    const canBack =
      screen.kind !== 'dashboard' &&
      screen.kind !== 'loading' &&
      screen.kind !== 'welcome' &&
      !inPreXpFirstLesson
    if (canBack) {
      tg.BackButton.show()
    } else {
      tg.BackButton.hide()
    }
    const handler = () => {
      if (
        screen.kind === 'module' ||
        screen.kind === 'profile' ||
        screen.kind === 'vocabulary-list'
      ) {
        setScreen({ kind: 'dashboard' })
      } else if (screen.kind === 'lesson-theory') {
        setScreen({ kind: 'module', moduleId: screen.moduleId })
      } else if (screen.kind === 'practice') {
        setScreen({ kind: 'lesson-theory', moduleId: screen.moduleId, lessonId: screen.lessonId })
      } else if (screen.kind === 'vocabulary-quiz') {
        setScreen({ kind: 'vocabulary-list' })
      } else if (screen.kind === 'result') {
        if (screen.moduleId === 'vocabulary') {
          setScreen({ kind: 'vocabulary-list' })
        } else {
          setScreen({ kind: 'module', moduleId: screen.moduleId })
        }
      } else if (screen.kind === 'practice-mistakes') {
        setScreen({ kind: 'module', moduleId: screen.moduleId })
      } else if (screen.kind === 'mistakes-result') {
        setScreen({ kind: 'module', moduleId: screen.moduleId })
      }
    }
    tg.BackButton.onClick(handler)
    return () => {
      try {
        tg.BackButton.offClick(handler)
      } catch {}
    }
  }, [screen, progress.xp])

  if (loadError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-6 text-center bg-cream"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(var(--safe-t) + 24px)',
          paddingBottom: 'calc(var(--safe-b) + 24px)'
        }}
      >
        <Mascot mood="sleep" size={140} />
        <div className="mn-eyebrow">связь потерялась</div>
        <div className="font-sans text-[22px] font-bold text-jewelInk">
          Бомбора не дозвонился
        </div>
        <div className="font-sans text-[14px] text-jewelInk-mid max-w-[280px]">
          Проверь соединение и попробуй открыть блокнот ещё раз.
        </div>
      </div>
    )
  }

  if (!catalog || screen.kind === 'loading') {
    return (
      <div
        className="flex flex-col items-center justify-center bg-cream"
        style={{
          minHeight: '100dvh',
          paddingTop: 'var(--safe-t)',
          paddingBottom: 'var(--safe-b)'
        }}
      >
        <LoaderLetter />
      </div>
    )
  }

  // Public visitors (no Telegram initData) get the landing page — this is the
  // same SPA but with a different root view. The mini-app content is only
  // active for users who actually opened the app from inside Telegram.
  if (!insideTelegram) {
    return <LandingScreen botUsername={catalog.botUsername} />
  }

  function navigate(s: Screen) {
    if (s.kind === 'result') {
      setTodayLessons(incrementTodayLessons())
    }
    setScreen(s)
    // Telegram WebView may scroll a container other than window
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  const proSuccessToast = showProSuccessToast && (
    <div
      className="fixed top-0 left-0 right-0 z-50 max-w-[480px] mx-auto"
      style={{ paddingTop: 'var(--safe-t)' }}
    >
      <div
        className="bg-gold border-b-2 border-jewelInk text-jewelInk px-5 py-3 flex flex-col items-center"
        style={{
          animation: 'toastSlideDown 250ms ease-out both',
        }}
      >
        <div className="font-sans text-[15px] font-extrabold leading-tight">
          ★ Добро пожаловать в Pro!
        </div>
        <div className="font-geo text-[11px] font-bold mt-0.5">
          ყველა მოდული ღიაა
        </div>
      </div>
      <style>{`
        @keyframes toastSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  )

  switch (screen.kind) {
    case 'welcome':
      return (
        <Welcome
          onFinish={() => {
            // The welcome lesson is recorded under its own "welcome" module id, so it
            // awards the first XP (flipping the entry gate to the dashboard) without
            // touching the real alphabet progression. Navigate regardless of the API
            // result so a transient failure doesn't trap the user on the welcome screen.
            // Re-fetch me() afterwards: completing welcome unlocks the first onboarding
            // hint, but the initial me() (taken before welcome) returned none — without a
            // refresh the dashboard spotlight only appears after a manual reload.
            api
              .completeLesson({ moduleId: 'welcome', lessonId: 1, correct: 1, total: 1 })
              .then((res) => setProgress(progressFromDto(res.progress)))
              .then(() => api.me())
              .then((meData) => setOnboardingHint((meData as any).onboardingHint ?? null))
              .catch(() => {})
              .finally(() => navigate({ kind: 'dashboard' }))
          }}
        />
      )
    case 'onboarding':
      return (
        <Onboarding
          vocabularyCount={vocabularyCount}
          onSelect={(level) => {
            setUserLevel(level)
            if (authenticated) {
              api.setLevel(level).catch(() => {})
            }
            // Fresh user → welcome lesson (one-letter quick win); the dashboard hub is
            // revealed only after that first XP is earned.
            navigate(resolveEntryScreen({ hasLevel: true, progress, catalog }))
          }}
        />
      )
    case 'dashboard':
      return (
        <>
          {proSuccessToast}
          <Dashboard
            catalog={catalog}
            progress={progress}
            todayLessons={todayLessons}
            userLevel={userLevel ?? 'beginner'}
            isPro={isPro}
            isTrialActive={isTrialActive}
            trialDaysLeft={trialDaysLeft}
            shouldShowReferralExtensionCta={shouldShowReferralExtensionCta}
            onboardingHint={onboardingHint}
            onHintSeen={(h) => api.markOnboardingHintSeen(h).catch(() => {})}
            onHintDismiss={() => setOnboardingHint(null)}
            onPurchaseSuccess={handleProPurchaseSuccess}
            onProgressUpdate={(patch) => setProgress((p) => ({ ...p, ...patch }))}
            navigate={navigate}
          />
        </>
      )
    case 'module':
      return <ModuleMap catalog={catalog} moduleId={screen.moduleId} progress={progress} navigate={navigate} />
    case 'lesson-theory':
      return (
        <LessonTheory
          catalog={catalog}
          moduleId={screen.moduleId}
          lessonId={screen.lessonId}
          progress={progress}
          navigate={navigate}
        />
      )
    case 'practice':
      return (
        <Practice
          moduleId={screen.moduleId}
          lessonId={screen.lessonId}
          progress={progress}
          setProgress={setProgress}
          authenticated={authenticated}
          navigate={navigate}
        />
      )
    case 'result':
      return (
        <Result
          catalog={catalog}
          moduleId={screen.moduleId}
          lessonId={screen.lessonId}
          correct={screen.correct}
          total={screen.total}
          xpEarned={screen.xpEarned}
          wrongQuestions={screen.wrongQuestions}
          navigate={navigate}
        />
      )
    case 'practice-mistakes':
      return (
        <PracticeMistakes
          moduleId={screen.moduleId}
          lessonId={screen.lessonId}
          wrongQuestions={screen.wrongQuestions}
          navigate={navigate}
        />
      )
    case 'mistakes-result':
      return (
        <MistakesResult
          moduleId={screen.moduleId}
          lessonId={screen.lessonId}
          corrected={screen.corrected}
          total={screen.total}
          remainingWrong={screen.remainingWrong}
          navigate={navigate}
        />
      )
    case 'profile':
      return (
        <>
          {proSuccessToast}
          <Profile
            catalog={catalog}
            progress={progress}
            setProgress={setProgress}
            isPro={isPro}
            isOwner={isOwner}
            telegramId={telegramId}
            onPurchaseSuccess={handleProPurchaseSuccess}
            navigate={navigate}
          />
        </>
      )
    case 'admin':
      return <AdminScreen progress={progress} navigate={navigate} />
    case 'admin-user':
      return <AdminUserScreen telegramId={screen.telegramId} progress={progress} navigate={navigate} />
    case 'vocabulary-list':
      return <VocabularyList progress={progress} navigate={navigate} />
    case 'vocabulary-quiz':
      return (
        <VocabularyPractice
          mode={screen.mode}
          wordIds={screen.wordIds}
          progress={progress}
          setProgress={setProgress}
          authenticated={authenticated}
          navigate={navigate}
        />
      )
    default:
      return <Dashboard catalog={catalog} progress={progress} todayLessons={todayLessons} userLevel={userLevel ?? 'beginner'} isPro={isPro} isTrialActive={isTrialActive} trialDaysLeft={trialDaysLeft} onPurchaseSuccess={handleProPurchaseSuccess} onProgressUpdate={(patch) => setProgress((p) => ({ ...p, ...patch }))} navigate={navigate} />
  }
}
