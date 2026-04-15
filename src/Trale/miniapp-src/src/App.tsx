import React, { useEffect, useState } from 'react'
import { CatalogDto, ProgressState, Screen } from './types'
import { defaultProgress, progressFromDto } from './progress'
import { api } from './api'
import Dashboard from './screens/Dashboard'
import ModuleMap from './screens/ModuleMap'
import LessonTheory from './screens/LessonTheory'
import Practice from './screens/Practice'
import Result from './screens/Result'
import Profile from './screens/Profile'
import VocabularyList from './screens/VocabularyList'
import VocabularyPractice from './screens/VocabularyPractice'
import LandingScreen from './screens/LandingScreen'
import Onboarding, { UserLevel } from './screens/Onboarding'
import Mascot from './components/Mascot'
import LoaderLetter from './components/LoaderLetter'

function isInsideTelegram(): boolean {
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
  const [showProSuccessToast, setShowProSuccessToast] = useState(false)

  // Load catalog + progress from backend on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([api.content(), api.me().catch(() => null)])
      .then(([catalogData, meData]) => {
        if (cancelled) return
        setCatalog(catalogData)
        if (meData?.authenticated && meData.progress) {
          setAuthenticated(true)
          setProgress(progressFromDto(meData.progress))
          if (meData.level === 'beginner' || meData.level === 'intermediate') {
            setUserLevel(meData.level)
          }
          setIsPro(meData.isPro ?? false)
        }
        const hasLevel = meData?.level === 'beginner' || meData?.level === 'intermediate'
        setScreen(hasLevel ? { kind: 'dashboard' } : { kind: 'onboarding' })
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
    const canBack = screen.kind !== 'dashboard' && screen.kind !== 'loading'
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
      }
    }
    tg.BackButton.onClick(handler)
    return () => {
      try {
        tg.BackButton.offClick(handler)
      } catch {}
    }
  }, [screen])

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
    case 'onboarding':
      return (
        <Onboarding
          onSelect={(level) => {
            setUserLevel(level)
            if (authenticated) {
              api.setLevel(level).catch(() => {})
            }
            navigate({ kind: 'dashboard' })
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
            onPurchaseSuccess={handleProPurchaseSuccess}
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
            onPurchaseSuccess={handleProPurchaseSuccess}
            navigate={navigate}
          />
        </>
      )
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
      return <Dashboard catalog={catalog} progress={progress} todayLessons={todayLessons} userLevel={userLevel ?? 'beginner'} isPro={isPro} onPurchaseSuccess={handleProPurchaseSuccess} navigate={navigate} />
  }
}
