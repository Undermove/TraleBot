import React, { useState, useEffect, useRef } from 'react'

interface ComingSoonTileProps {
  geoTitle: string
  geoIcon: string
  onTap?: () => void
}

export default function ComingSoonTile({ geoTitle, geoIcon, onTap }: ComingSoonTileProps) {
  const [showToast, setShowToast] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTap() {
    if (onTap) {
      onTap()
      return
    }
    // Show inline toast
    setShowToast(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setShowToast(false), 2500)
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  return (
    <>
      <button
        onClick={handleTap}
        aria-label={`Модуль ${geoTitle}, скоро`}
        className="w-full text-left active:opacity-70 transition-opacity"
        style={{
          background: '#F5EFE0',
          border: '1.5px solid rgba(21,16,10,0.25)',
          borderRadius: 10,
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 72,
        }}
      >
        {/* Icon medallion */}
        <div
          className="shrink-0 flex items-center justify-center rounded-xl"
          style={{
            width: 32,
            height: 32,
            background: 'rgba(21,16,10,0.1)',
          }}
        >
          <span
            className="font-geo font-bold leading-none"
            style={{ fontSize: 16, color: 'rgba(21,16,10,0.4)' }}
          >
            {geoIcon}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div
            className="font-geo font-semibold leading-tight truncate"
            style={{ fontSize: 14, color: 'rgba(21,16,10,0.5)' }}
          >
            {geoTitle}
          </div>
          <div
            className="font-sans leading-none mt-0.5"
            style={{ fontSize: 10, color: 'rgba(122,107,82,0.6)' }}
          >
            скоро
          </div>
        </div>
      </button>

      {/* Toast — positioned fixed at bottom */}
      {showToast && (
        <div
          className="fixed left-4 right-4 bottom-8 z-50 text-center"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="inline-block font-sans text-[13px] font-semibold text-cream px-4 py-2.5 rounded-xl"
            style={{
              background: 'rgba(21,16,10,0.88)',
              animation: 'comingsoon-toast 2.5s ease both',
            }}
          >
            Этот модуль появится после запуска
          </div>
        </div>
      )}
    </>
  )
}
