import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FirstLessonHeroCta from './FirstLessonHeroCta'

// #1002: navy hero-CTA rendered for brand-new users on the dashboard.
// It surfaces the very first Georgian word («გამარჯობა!») users see and drives
// them straight into lesson-theory of module.lessons[0] — the single conversion
// action for a fresh session.

describe('FirstLessonHeroCta', () => {
  const firstLesson = {
    moduleId: 'alphabet-progressive',
    lessonId: 1,
    title: 'Первые буквы',
    moduleTitle: 'Алфавит',
  }

  const originalTelegram = (window as any).Telegram

  beforeEach(() => {
    ;(window as any).Telegram = {
      WebApp: {
        HapticFeedback: { impactOccurred: vi.fn() },
      },
    }
  })

  afterEach(() => {
    ;(window as any).Telegram = originalTelegram
  })

  it('renders the eyebrow, title and Georgian subtitle from props', () => {
    render(<FirstLessonHeroCta firstLesson={firstLesson} onStart={vi.fn()} />)

    expect(screen.getByText('первый урок')).toBeInTheDocument()
    expect(screen.getByText('Первые буквы')).toBeInTheDocument()
    // Subtitle: «გამარჯობა! · Алфавит, урок 1»
    expect(
      screen.getByText(/გამარჯობა!\s*·\s*Алфавит,\s*урок\s*1/)
    ).toBeInTheDocument()
  })

  it('calls onStart and fires medium haptic feedback on tap', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<FirstLessonHeroCta firstLesson={firstLesson} onStart={onStart} />)

    await user.click(screen.getByTestId('dashboard-first-lesson-hero'))

    expect(onStart).toHaveBeenCalledTimes(1)
    const haptic = (window as any).Telegram.WebApp.HapticFeedback.impactOccurred
    expect(haptic).toHaveBeenCalledWith('medium')
  })

  it('still calls onStart when Telegram HapticFeedback is unavailable', async () => {
    ;(window as any).Telegram = undefined
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<FirstLessonHeroCta firstLesson={firstLesson} onStart={onStart} />)

    await user.click(screen.getByTestId('dashboard-first-lesson-hero'))

    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
