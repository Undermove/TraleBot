import React, { useState } from 'react'
import { api } from '../api'

interface Props {
  initialEnabled: boolean
}

const SUB_LABELS = ['Праздники', 'Накопленные монеты', 'Стрик-достижения']

export default function NotificationSettings({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (loading) return
    const next = !enabled
    setEnabled(next)
    setLoading(true)
    try {
      await api.updateNotifications(next)
    } catch {
      setEnabled(enabled)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="jewel-tile px-4 py-4" data-testid="notifications-section">
        <div className="relative z-[1]">
          {/* Header row: label + toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="font-sans text-[14px] font-bold text-jewelInk">Уведомления</div>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={handleToggle}
              disabled={loading}
              data-testid="notifications-toggle"
              className={`relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none ${
                enabled
                  ? 'bg-gold border-jewelInk'
                  : 'bg-jewelInk/20 border-jewelInk/40'
              }`}
              style={{ minHeight: '44px', minWidth: '52px', width: '52px', height: '44px' }}
            >
              <span
                className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition duration-200 ${
                  enabled ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>

          {/* Sub-labels — muted when master toggle is off */}
          <div
            data-testid="notification-sublabels"
            className={`mt-3 flex flex-col gap-0.5 transition-opacity ${!enabled ? 'opacity-40' : ''}`}
          >
            {SUB_LABELS.map((label) => (
              <div key={label} className="font-sans text-[12px] text-jewelInk-mid py-1">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
