import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import IntroOpener from './IntroOpener'

const setTelegramName = (first_name?: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).Telegram = { WebApp: { initDataUnsafe: { user: first_name ? { first_name } : undefined } } }
}

describe('IntroOpener — имя', () => {
  beforeEach(() => { localStorage.clear(); setTelegramName(undefined) })

  it('asks the name when there is none that Georgian letters can write, and saves it', () => {
    setTelegramName('🦊')
    const onStart = vi.fn()
    render(<IntroOpener lessonId={2} onBack={() => {}} onStart={onStart} details={null} />)

    const start = screen.getByText('Начать').closest('button')!
    expect(start).toBeDisabled()
    fireEvent.change(screen.getByTestId('opener-name-input'), { target: { value: 'Карлос' } })
    expect(screen.getByTestId('opener-name').textContent).toContain('კარლოსი')
    fireEvent.click(start)

    expect(onStart).toHaveBeenCalled()
    expect(localStorage.getItem('intro_name')).toBe('Карлос')
  })

  it('does not ask when the Telegram name is fine', () => {
    setTelegramName('Дима')
    render(<IntroOpener lessonId={2} onBack={() => {}} onStart={() => {}} details={null} />)
    expect(screen.queryByTestId('opener-name')).toBeNull()
    expect(screen.getByText('Начать').closest('button')).toBeEnabled()
  })
})
