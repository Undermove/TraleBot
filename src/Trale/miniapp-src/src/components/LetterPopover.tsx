import React, { useEffect, useState } from 'react'
import { AlphabetLetterDto } from '../types'

interface LetterPopoverProps {
  letter: string
  data: AlphabetLetterDto | null
  isLearned: boolean
  onClose: () => void
}

export default function LetterPopover({ letter, data, isLearned, onClose }: LetterPopoverProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation on mount
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 150)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(21,16,10,0.4)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 150ms ease-out'
        }}
      />

      {/* Card */}
      <div
        className="relative z-[1] jewel-tile bg-cream max-w-[280px] w-full mx-4 px-5 py-5"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.85)',
          opacity: visible ? 1 : 0,
          transition: 'transform 150ms ease-out, opacity 150ms ease-out'
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-[32px] h-[32px] flex items-center justify-center text-jewelInk-mid font-bold text-[16px]"
          aria-label="Закрыть"
        >
          ×
        </button>

        {/* Letter */}
        <div className="text-center mb-3">
          <div
            className="font-geo text-[64px] font-extrabold leading-none"
            style={{ color: isLearned ? '#1B5FB0' : 'rgba(21,16,10,0.4)' }}
          >
            {letter}
          </div>
        </div>

        {/* Name and translit */}
        {data ? (
          <>
            <div className="mn-eyebrow text-center mb-0.5">{data.name}</div>
            <div className="font-sans text-[14px] font-bold text-jewelInk text-center mb-4">
              [{data.translit}]
            </div>

            {isLearned ? (
              /* Example word */
              <div className="text-center">
                <div className="font-geo text-[18px] text-jewelInk leading-snug">
                  {data.exampleGe}
                </div>
                <div className="font-sans text-[12px] text-jewelInk-mid mt-1">
                  {data.exampleRu}
                </div>
              </div>
            ) : (
              /* Locked hint */
              <div className="mn-eyebrow text-jewelInk-hint text-center">
                узнаешь в Алфавите
              </div>
            )}
          </>
        ) : (
          /* No data fallback */
          <div className="mn-eyebrow text-jewelInk-hint text-center">
            данные недоступны
          </div>
        )}
      </div>
    </div>
  )
}
