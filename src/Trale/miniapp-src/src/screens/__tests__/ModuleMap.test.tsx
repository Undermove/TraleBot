import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModuleMap from '../ModuleMap'
import type { CatalogDto, ProgressState } from '../../types'

// Two-lesson stub module — pulsation targets the first circle (idx=0),
// and we need a second circle to prove that tapping any circle clears the flag.
function makeCatalog(moduleId: string = 'intro'): CatalogDto {
  return {
    botUsername: 'TraleBot',
    miniAppEnabled: true,
    modules: [
      {
        id: moduleId,
        title: 'Знакомство',
        emoji: '👋',
        description: 'Первые фразы',
        lessons: [
          { id: 1, title: 'Привет', short: 'L1', theory: { title: 't', goal: 'g', blocks: [] } },
          { id: 2, title: 'Как дела', short: 'L2', theory: { title: 't', goal: 'g', blocks: [] } },
        ],
      },
      {
        id: 'other',
        title: 'Другой',
        emoji: '🎯',
        description: 'Другой раздел',
        lessons: [
          { id: 1, title: 'A', short: 'A1', theory: { title: 't', goal: 'g', blocks: [] } },
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

const STARTED_KEY = (moduleId: string) => `bombora_module_started_${moduleId}`

describe('ModuleMap — «Начни здесь» pulsation & badge for pristine module', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('pristine module (0 completed + no start flag) pulses first circle and shows «Начни здесь» badge', () => {
    const catalog = makeCatalog('intro')
    render(
      <ModuleMap
        catalog={catalog}
        moduleId="intro"
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // The first-circle button gets an inline animation shorthand referencing pulse-ring.
    const firstBtn = screen.getByTestId('lesson-btn-1')
    const animation =
      firstBtn.style.animation || firstBtn.style.getPropertyValue('animation') || ''
    expect(animation).toMatch(/pulse-ring/)

    // The «▶ Начни здесь» badge is visible in the label block.
    expect(screen.getByText(/Начни здесь/)).toBeInTheDocument()
  })

  it('does NOT pulse when the module has completed lessons (even without the start flag)', () => {
    const catalog = makeCatalog('intro')
    render(
      <ModuleMap
        catalog={catalog}
        moduleId="intro"
        progress={makeProgress({ completedLessons: { intro: [1] } })}
        navigate={vi.fn()}
      />
    )

    const firstBtn = screen.getByTestId('lesson-btn-1')
    const animation =
      firstBtn.style.animation || firstBtn.style.getPropertyValue('animation') || ''
    expect(animation).not.toMatch(/pulse-ring/)
    expect(screen.queryByText(/Начни здесь/)).not.toBeInTheDocument()
  })

  it('does NOT pulse when the start flag is set for this module', () => {
    localStorage.setItem(STARTED_KEY('intro'), '1')
    const catalog = makeCatalog('intro')
    render(
      <ModuleMap
        catalog={catalog}
        moduleId="intro"
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    const firstBtn = screen.getByTestId('lesson-btn-1')
    const animation =
      firstBtn.style.animation || firstBtn.style.getPropertyValue('animation') || ''
    expect(animation).not.toMatch(/pulse-ring/)
    expect(screen.queryByText(/Начни здесь/)).not.toBeInTheDocument()
  })

  it('clicking any circle in the module sets the localStorage flag and clears pulsation + badge immediately', async () => {
    const user = userEvent.setup()
    const catalog = makeCatalog('intro')
    render(
      <ModuleMap
        catalog={catalog}
        moduleId="intro"
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // Sanity: pristine.
    expect(screen.getByText(/Начни здесь/)).toBeInTheDocument()

    // Tap the SECOND circle (not the first) — badge must still clear because the AC
    // says any tap in the module sets the flag.
    await user.click(screen.getByTestId('lesson-btn-2'))

    expect(localStorage.getItem(STARTED_KEY('intro'))).toBe('1')
    expect(screen.queryByText(/Начни здесь/)).not.toBeInTheDocument()

    const firstBtn = screen.getByTestId('lesson-btn-1')
    const animation =
      firstBtn.style.animation || firstBtn.style.getPropertyValue('animation') || ''
    expect(animation).not.toMatch(/pulse-ring/)
  })

  it('start flag is per moduleId — pulsation in another module is independent', () => {
    // Mark "intro" as started, but "other" is still pristine.
    localStorage.setItem(STARTED_KEY('intro'), '1')
    const catalog = makeCatalog('intro')

    const { unmount } = render(
      <ModuleMap
        catalog={catalog}
        moduleId="intro"
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )
    expect(screen.queryByText(/Начни здесь/)).not.toBeInTheDocument()
    unmount()

    render(
      <ModuleMap
        catalog={catalog}
        moduleId="other"
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )
    expect(screen.getByText(/Начни здесь/)).toBeInTheDocument()
  })
})
