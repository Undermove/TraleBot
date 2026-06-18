import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingSpotlight from './OnboardingSpotlight'

// Renders a fake target element (matching the hint's selector) alongside the spotlight,
// so document.querySelector inside the component finds something to highlight.
function renderWithTarget(
  hint: string,
  testid: string,
  opts: { onShown?: () => void; onDismiss?: () => void; onTargetClick?: () => void } = {}
) {
  const onShown = vi.fn(opts.onShown)
  const onDismiss = vi.fn(opts.onDismiss)
  render(
    <>
      <button data-testid={testid} onClick={opts.onTargetClick}>
        target
      </button>
      <OnboardingSpotlight hint={hint} onShown={onShown} onDismiss={onDismiss} />
    </>
  )
  return { onShown, onDismiss }
}

describe('OnboardingSpotlight', () => {
  it('reports itself shown once on mount', () => {
    const { onShown } = renderWithTarget('feed_bombora', 'dashboard-feed-button')
    expect(onShown).toHaveBeenCalledTimes(1)
    expect(onShown).toHaveBeenCalledWith('feed_bombora')
  })

  it('shows a caption pointing at the real element', () => {
    renderWithTarget('feed_bombora', 'dashboard-feed-button')
    expect(screen.getByTestId('onboarding-spotlight-feed_bombora')).toBeInTheDocument()
    expect(screen.getByText(/покормить бомбору/i)).toBeInTheDocument()
  })

  it('renders nothing for an unknown hint', () => {
    render(<OnboardingSpotlight hint="totally_unknown" onShown={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.queryByText(/жми/i)).not.toBeInTheDocument()
  })

  it('renders nothing when the target element is absent', () => {
    // No matching element in the DOM → nothing to highlight.
    render(<OnboardingSpotlight hint="feed_bombora" onShown={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.queryByTestId('onboarding-spotlight-feed_bombora')).not.toBeInTheDocument()
  })

  it('dismisses when the highlighted target is tapped (teaching the real gesture)', async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderWithTarget('feed_bombora', 'dashboard-feed-button')
    await user.click(screen.getByTestId('dashboard-feed-button'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses via the × button', async () => {
    const user = userEvent.setup()
    const { onDismiss } = renderWithTarget('first_lesson', 'dashboard-suggestion')
    await user.click(screen.getByRole('button', { name: /закрыть подсказку/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
