import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../Dashboard'
import type { CatalogDto, ProgressState } from '../../types'

// #1002: Dashboard shows the FirstLessonHeroCta only for brand-new users
// (completedLessons empty). Returning users see the regular suggestion tile.

function makeCatalog(): CatalogDto {
  return {
    botUsername: 'TraleBot',
    miniAppEnabled: true,
    modules: [
      {
        id: 'alphabet-progressive',
        title: 'Алфавит',
        emoji: '🔤',
        description: 'Грузинский алфавит',
        lessons: [
          {
            id: 1,
            title: 'Первые буквы',
            short: 'L1',
            theory: { title: 't', goal: 'g', blocks: [] },
          },
          {
            id: 2,
            title: 'Ещё буквы',
            short: 'L2',
            theory: { title: 't', goal: 'g', blocks: [] },
          },
        ],
      },
      {
        id: 'intro',
        title: 'Знакомство',
        emoji: '👋',
        description: 'Первые фразы',
        lessons: [
          { id: 1, title: 'Привет', short: 'I1', theory: { title: 't', goal: 'g', blocks: [] } },
        ],
      },
    ],
  }
}

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    xp: 0,
    streak: 0,
    completedLessons: {},
    lastPlayedDate: null,
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
    ...overrides,
  }
}

describe('Dashboard — FirstLessonHeroCta gate', () => {
  beforeEach(() => {
    localStorage.clear()
    ;(window as any).Telegram = {
      WebApp: {
        HapticFeedback: { impactOccurred: vi.fn() },
      },
    }
  })

  it('brand-new user (completedLessons = {}) sees hero, no suggestion tile, mascot 80px, bowl hidden', () => {
    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress()}
        todayLessons={0}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={vi.fn()}
      />
    )

    // Hero visible …
    const hero = screen.getByTestId('dashboard-first-lesson-hero')
    expect(hero).toBeInTheDocument()
    expect(hero).toHaveTextContent('первый урок')
    expect(hero).toHaveTextContent('Первые буквы')

    // … regular suggestion tile hidden.
    expect(screen.queryByTestId('dashboard-suggestion')).not.toBeInTheDocument()

    // Mascot shrinks to 80px and bowl indicator is hidden.
    const mascot = screen.getByTestId('dashboard-mascot').querySelector('svg')
    expect(mascot).toHaveAttribute('width', '80')
    expect(screen.queryByTestId('dashboard-bowl-indicator')).not.toBeInTheDocument()
  })

  it('hero click navigates to lesson-theory of the first module\'s first lesson', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()

    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress()}
        todayLessons={0}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={navigate}
      />
    )

    await user.click(screen.getByTestId('dashboard-first-lesson-hero'))

    expect(navigate).toHaveBeenCalledWith({
      kind: 'lesson-theory',
      moduleId: 'alphabet-progressive',
      lessonId: 1,
    })
  })

  it('returning user (completedLessons non-empty) sees regular suggestion tile and mascot 120px', () => {
    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress({
          completedLessons: { 'alphabet-progressive': [1] },
          xp: 15,
        })}
        todayLessons={0}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={vi.fn()}
      />
    )

    // Hero absent.
    expect(screen.queryByTestId('dashboard-first-lesson-hero')).not.toBeInTheDocument()

    // Regular suggestion tile visible.
    expect(screen.getByTestId('dashboard-suggestion')).toBeInTheDocument()

    // Mascot back to 120px, bowl indicator present.
    const mascot = screen.getByTestId('dashboard-mascot').querySelector('svg')
    expect(mascot).toHaveAttribute('width', '120')
    expect(screen.getByTestId('dashboard-bowl-indicator')).toBeInTheDocument()
  })
})
