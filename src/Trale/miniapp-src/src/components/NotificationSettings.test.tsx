import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSettings from './NotificationSettings'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NotificationSettings', () => {
  it('NotificationSettings_Renders_CorrectInitialState — shows toggle and all sub-labels', () => {
    render(<NotificationSettings initialEnabled={true} />)

    expect(screen.getByTestId('notifications-toggle')).toBeInTheDocument()
    expect(screen.getByText('Праздники')).toBeInTheDocument()
    expect(screen.getByText('Накопленные монеты')).toBeInTheDocument()
    expect(screen.getByText('Стрик-достижения')).toBeInTheDocument()
  })

  it('NotificationSettings_ToggleClick_CallsCorrectApiEndpoint — calls PATCH /api/miniapp/notifications with enabled=false', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    render(<NotificationSettings initialEnabled={true} />)

    await user.click(screen.getByTestId('notifications-toggle'))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/miniapp/notifications',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      })
    )
  })

  it('NotificationSettings_ToggleOn_CallsApiWithEnabledTrue — toggles from off to on', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', mockFetch)

    const user = userEvent.setup()
    render(<NotificationSettings initialEnabled={false} />)

    await user.click(screen.getByTestId('notifications-toggle'))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/miniapp/notifications',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: true }),
      })
    )
  })
})
