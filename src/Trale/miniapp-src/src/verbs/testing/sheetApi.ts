import { vi } from 'vitest'

// Только для тестов. Карточка глагола (VerbSheet) сама зовёт API и рисует части, которые зовут его тоже:
// вход в сессию (она зовёт прогресс и комиксы). Тест любой из этих частей, открывающий карточку, подменяет '../api'
// этим набором — и не ломается, когда в карточке появляется ещё одна часть.
//
//   vi.mock('../api', async () => (await import('./testing/sheetApi')).sheetApi({ fetchVerb: vi.fn(() => …) }))

const noProgress = { verbId: '', canLearn: true, total: 0, forms: [] }

/** Состояние глагола, с которым ещё не играли (GET verbs/{id}/learning). */
export const newLearning = {
  progress: noProgress,
  level: 'new' as const,
  memory: { sessionsPlayed: 0, recentScenes: [], storyCompleted: false, examPassed: false },
  learner: { level: 'beginner', canType: false, dictionarySize: 0, dictionaryVerbs: 0, verbsLearned: 0 },
  session: null
}

/** Подмена модуля api для тестов с карточкой глагола: по умолчанию прогресса и комиксов нет. */
export function sheetApi(overrides: Record<string, unknown> = {}) {
  return {
    fetchVerb: vi.fn(),
    fetchVerbProgress: vi.fn(() => Promise.resolve(noProgress)),
    saveVerbProgress: vi.fn(() => Promise.resolve(noProgress)),
    fetchVerbLearning: vi.fn(() => Promise.resolve(newLearning)),
    saveVerbSession: vi.fn(() => Promise.resolve({ state: newLearning, xpEarned: 0, progress: null })),
    markUiHintSeen: vi.fn(() => Promise.resolve({ ok: true })),
    fetchVerbStories: vi.fn(() => Promise.resolve({ stories: [] })),
    parseVerbForm: vi.fn(() => Promise.resolve({ hits: [] })),
    ...overrides
  }
}
