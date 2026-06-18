import { describe, it, expect } from 'vitest'
import { resolveEntryScreen, hasEarnedXp, findFirstLesson } from './entryFlow'
import { defaultProgress } from './progress'
import { CatalogDto, ProgressState } from './types'

function lesson(id: number) {
  return { id, title: `L${id}`, short: '', theory: { title: `L${id}`, goal: '', blocks: [] } }
}

const catalog: CatalogDto = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '🔤', description: '', lessons: [lesson(1), lesson(2)] },
    { id: 'intro', title: 'Знакомство', emoji: '👋', description: '', lessons: [lesson(1)] },
  ],
}

function progressWith(patch: Partial<ProgressState>): ProgressState {
  return { ...defaultProgress, ...patch }
}

describe('hasEarnedXp', () => {
  it('is false for a brand-new user (no xp, no completed lessons)', () => {
    expect(hasEarnedXp(defaultProgress)).toBe(false)
  })

  it('is true once any xp has been earned', () => {
    expect(hasEarnedXp(progressWith({ xp: 10 }))).toBe(true)
  })

  it('is true when a lesson is completed even if xp reads 0', () => {
    expect(hasEarnedXp(progressWith({ completedLessons: { 'alphabet-progressive': [1] } }))).toBe(true)
  })
})

describe('findFirstLesson', () => {
  it('returns the very first lesson for a fresh user', () => {
    expect(findFirstLesson(catalog, {})).toEqual({ moduleId: 'alphabet-progressive', lessonId: 1 })
  })

  it('skips already-completed lessons within a module', () => {
    expect(findFirstLesson(catalog, { 'alphabet-progressive': [1] })).toEqual({
      moduleId: 'alphabet-progressive',
      lessonId: 2,
    })
  })

  it('moves to the next module once the first is finished', () => {
    expect(findFirstLesson(catalog, { 'alphabet-progressive': [1, 2] })).toEqual({
      moduleId: 'intro',
      lessonId: 1,
    })
  })

  it('returns null when the catalog has no lessons', () => {
    expect(findFirstLesson({ ...catalog, modules: [] }, {})).toBeNull()
  })
})

describe('resolveEntryScreen', () => {
  it('sends a user without a level to onboarding', () => {
    expect(resolveEntryScreen({ hasLevel: false, progress: defaultProgress, catalog })).toEqual({
      kind: 'onboarding',
    })
  })

  it('drops a fresh (0-XP) user into the welcome lesson, not the dashboard', () => {
    expect(resolveEntryScreen({ hasLevel: true, progress: defaultProgress, catalog })).toEqual({
      kind: 'welcome',
    })
  })

  it('shows the dashboard once the user has earned XP', () => {
    expect(resolveEntryScreen({ hasLevel: true, progress: progressWith({ xp: 20 }), catalog })).toEqual({
      kind: 'dashboard',
    })
  })

  it('reveals the dashboard as soon as the first lesson is completed', () => {
    expect(
      resolveEntryScreen({
        hasLevel: true,
        progress: progressWith({ completedLessons: { 'alphabet-progressive': [1] } }),
        catalog,
      })
    ).toEqual({ kind: 'dashboard' })
  })

  it('sends a fresh user to the welcome lesson regardless of catalog contents', () => {
    expect(
      resolveEntryScreen({ hasLevel: true, progress: defaultProgress, catalog: { ...catalog, modules: [] } })
    ).toEqual({ kind: 'welcome' })
  })
})
