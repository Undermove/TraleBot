import { CatalogDto, ProgressState, Screen } from './types'

/**
 * Has the user earned any XP yet? A brand-new user who just picked a level but
 * never finished a single lesson reads `false` here. We treat "completed a
 * lesson" as equivalent to "earned XP" so the gate is robust even if the XP
 * counter is ever 0 for a user who already has progress.
 */
export function hasEarnedXp(progress: ProgressState): boolean {
  if (progress.xp > 0) return true
  return Object.values(progress.completedLessons).some((lessons) => lessons.length > 0)
}

/**
 * First not-yet-completed lesson in catalog order — the lesson a fresh user
 * should be dropped into. Mirrors the "next lesson" suggestion logic on the
 * dashboard so the forced first lesson and the dashboard hint never diverge.
 */
export function findFirstLesson(
  catalog: CatalogDto,
  completedLessons: Record<string, number[]>
): { moduleId: string; lessonId: number } | null {
  for (const module of catalog.modules) {
    if (module.lessons.length === 0) continue
    const done = new Set(completedLessons[module.id] ?? [])
    const next = module.lessons.find((l) => !done.has(l.id))
    if (next) return { moduleId: module.id, lessonId: next.id }
  }
  return null
}

/**
 * Decide where a just-loaded (or just-onboarded) user lands.
 *
 * The dashboard ("Бомбора" hub) is the full module grid — half of the users
 * who open it without any XP bounce within a minute (prod funnel, 2026-06).
 * So we hold it back: a user who has a level but hasn't earned XP yet gets the
 * welcome lesson — a single-letter quick win — and the hub is revealed only
 * once they've earned their first XP there.
 */
export function resolveEntryScreen(params: {
  hasLevel: boolean
  progress: ProgressState
  catalog: CatalogDto
}): Screen {
  const { hasLevel, progress } = params
  if (!hasLevel) return { kind: 'onboarding' }
  if (!hasEarnedXp(progress)) return { kind: 'welcome' }
  return { kind: 'dashboard' }
}
