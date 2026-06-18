import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingNudge from './OnboardingNudge'
import { CatalogDto, ProgressState } from '../types'
import { defaultProgress } from '../progress'

const catalog: CatalogDto = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: '',
      lessons: [{ id: 1, title: 'L1', short: '', theory: { title: 'L1', goal: '', blocks: [] } }],
    },
  ],
}

function renderNudge(hint: string, overrides: Partial<Parameters<typeof OnboardingNudge>[0]> = {}) {
  const props = {
    hint,
    catalog,
    progress: defaultProgress as ProgressState,
    navigate: vi.fn(),
    onFeed: vi.fn(),
    onClose: vi.fn(),
    onShown: vi.fn(),
    ...overrides,
  }
  render(<OnboardingNudge {...props} />)
  return props
}

describe('OnboardingNudge', () => {
  it('reports itself shown once on mount', () => {
    const onShown = vi.fn()
    renderNudge('first_lesson', { onShown })
    expect(onShown).toHaveBeenCalledTimes(1)
    expect(onShown).toHaveBeenCalledWith('first_lesson')
  })

  it('renders nothing for an unknown hint key', () => {
    renderNudge('totally_unknown')
    expect(screen.queryByTestId('onboarding-nudge-cta')).not.toBeInTheDocument()
  })

  it('first_lesson CTA navigates to the first lesson and closes', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const onClose = vi.fn()
    renderNudge('first_lesson', { navigate, onClose })

    await user.click(screen.getByTestId('onboarding-nudge-cta'))

    expect(navigate).toHaveBeenCalledWith({ kind: 'lesson-theory', moduleId: 'alphabet-progressive', lessonId: 1 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('feed_bombora CTA opens the treat shop', async () => {
    const user = userEvent.setup()
    const onFeed = vi.fn()
    renderNudge('feed_bombora', { onFeed })

    await user.click(screen.getByTestId('onboarding-nudge-cta'))
    expect(onFeed).toHaveBeenCalledTimes(1)
  })

  it('add_vocab CTA navigates to the vocabulary list', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    renderNudge('add_vocab', { navigate })

    await user.click(screen.getByTestId('onboarding-nudge-cta'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'vocabulary-list' })
  })

  it('the dismiss button closes the nudge', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderNudge('explore_module', { onClose })

    await user.click(screen.getByRole('button', { name: /закрыть подсказку/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
