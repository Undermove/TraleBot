import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../Dashboard'
import type { CatalogDto, ProgressState } from '../../types'

// #1001: When availableXp === 0, hide the «Покормить» button and render a
// one-line hint in its place. When availableXp > 0, keep the button as-is.

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

describe('Dashboard — Feed button hint gate (#1001)', () => {
  beforeEach(() => {
    localStorage.clear()
    ;(window as any).Telegram = {
      WebApp: {
        HapticFeedback: { impactOccurred: vi.fn() },
      },
    }
  })

  it('brand-new user with availableXp = 0 → no «Покормить» button, hint shown', () => {
    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress({ xp: 0, xpSpent: 0 })}
        todayLessons={0}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={vi.fn()}
      />
    )

    expect(screen.queryByTestId('dashboard-feed-button')).not.toBeInTheDocument()

    const hint = screen.getByTestId('dashboard-feed-hint')
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveTextContent('Заработай XP первым уроком — получишь угощения для Бомборы')
    expect(hint.tagName.toLowerCase()).toBe('p')
    expect(hint.className).toContain('text-jewelInk-hint')
    expect(hint.className).toContain('text-[12px]')
  })

  it('returning user with availableXp = 0 (all XP spent) → hint shown, button hidden', () => {
    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress({
          xp: 10,
          xpSpent: 10,
          completedLessons: { 'alphabet-progressive': [1] },
        })}
        todayLessons={1}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={vi.fn()}
      />
    )

    expect(screen.queryByTestId('dashboard-feed-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('dashboard-feed-hint')).toBeInTheDocument()
  })

  it('availableXp = 5 → «Покормить» button shown with ⭐ 5, no hint', () => {
    render(
      <Dashboard
        catalog={makeCatalog()}
        progress={makeProgress({ xp: 5, xpSpent: 0 })}
        todayLessons={0}
        userLevel="beginner"
        isPro={false}
        onPurchaseSuccess={vi.fn()}
        navigate={vi.fn()}
      />
    )

    const btn = screen.getByTestId('dashboard-feed-button')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Покормить')
    expect(btn).toHaveTextContent('⭐ 5')

    expect(screen.queryByTestId('dashboard-feed-hint')).not.toBeInTheDocument()
  })
})
