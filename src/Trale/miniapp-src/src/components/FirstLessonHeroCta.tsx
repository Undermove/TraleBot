import React from 'react'

interface FirstLessonHeroCtaProps {
  firstLesson: {
    moduleId: string
    lessonId: number
    title: string
    moduleTitle: string
  }
  onStart: () => void
}

// Navy hero-CTA rendered on the dashboard for brand-new users
// (completedLessons empty). Surfaces the first Georgian word users will meet
// («გამარჯობა!») and drives them straight into lesson-theory of the first
// lesson — a single, unambiguous conversion action. See design-specs/936.
export default function FirstLessonHeroCta({ firstLesson, onStart }: FirstLessonHeroCtaProps) {
  const handleTap = () => {
    try {
      ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium')
    } catch { /* haptic is optional */ }
    onStart()
  }

  return (
    <button
      type="button"
      data-testid="dashboard-first-lesson-hero"
      onClick={handleTap}
      className="jewel-tile jewel-pressable mt-4 w-full min-h-[100px] bg-navy text-left px-5 py-5 flex items-center gap-4"
    >
      <div className="relative z-[1] shrink-0">
        <div
          className="w-12 h-12 rounded-xl bg-cream border-[1.5px] border-jewelInk flex items-center justify-center"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className="text-[22px] leading-none" aria-hidden="true">🎯</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 relative z-[1]">
        <div className="mn-eyebrow text-cream/70">первый урок</div>
        <div className="font-sans text-[18px] font-extrabold text-cream leading-tight">
          {firstLesson.title}
        </div>
        <div className="font-geo text-[11px] text-cream/60 mt-0.5">
          გამარჯობა! · {firstLesson.moduleTitle}, урок {firstLesson.lessonId}
        </div>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 text-cream/70 relative z-[1]"
        aria-hidden="true"
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
  )
}
