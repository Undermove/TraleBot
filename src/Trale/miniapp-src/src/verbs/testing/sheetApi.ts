import { vi } from 'vitest'

// Только для тестов. Карточка глагола (VerbSheet) сама зовёт API и рисует части, которые зовут его тоже:
// вход в лесенку, игры, комиксы. Тест любой из этих частей, открывающий карточку, подменяет '../api'
// этим набором — и не ломается, когда в карточке появляется ещё одна часть.
//
//   vi.mock('../api', async () => (await import('./testing/sheetApi')).sheetApi({ fetchVerb: vi.fn(() => …) }))

const noProgress = { verbId: '', canLearn: true, total: 0, forms: [] }

/** Подмена модуля api для тестов с карточкой глагола: по умолчанию прогресса и комиксов нет. */
export function sheetApi(overrides: Record<string, unknown> = {}) {
  return {
    fetchVerb: vi.fn(),
    fetchVerbProgress: vi.fn(() => Promise.resolve(noProgress)),
    saveVerbProgress: vi.fn(() => Promise.resolve(noProgress)),
    fetchVerbStories: vi.fn(() => Promise.resolve({ stories: [] })),
    parseVerbForm: vi.fn(() => Promise.resolve({ hits: [] })),
    ...overrides
  }
}
