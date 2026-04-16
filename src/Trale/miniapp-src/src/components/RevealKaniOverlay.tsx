import React, { useEffect, useState } from 'react'
import Stamp from './Stamp'
import Button from './Button'

interface Props {
  onClose: () => void
}

/**
 * One-time overlay for the ქ reveal moment.
 * Shown when the user reaches the theory lesson containing the letter ქ in the Alphabet module.
 * Connects the familiar loader letter to the word ქართული (Georgian language).
 * After dismissal, localStorage flag `bombora_kani_reveal_shown` prevents re-display.
 */
export default function RevealKaniOverlay({ onClose }: Props) {
  const [closing, setClosing] = useState(false)
  const [stampVisible, setStampVisible] = useState(false)

  // Stamp appears 280ms after the card slides in
  useEffect(() => {
    const t = setTimeout(() => setStampVisible(true), 280)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setClosing(true)
    localStorage.setItem('bombora_kani_reveal_shown', '1')
    setTimeout(onClose, 220)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(21,16,10,0.65)',
        animation: closing
          ? 'reveal-backdrop-out 220ms ease both'
          : 'reveal-backdrop-in 250ms ease both',
      }}
    >
      {/* Card */}
      <div
        className="max-w-[340px] w-[calc(100%-32px)] bg-cream rounded-2xl overflow-hidden"
        style={{
          border: '1.5px solid #15100A',
          boxShadow: '4px 4px 0 #15100A',
          animation: closing
            ? 'reveal-card-out 220ms ease-in both'
            : 'reveal-card-in 320ms ease-out both',
        }}
      >
        {/* Kilim stripe — top */}
        <div className="h-2 w-full bg-gold" />

        <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-4">
          {/* Animated ქ letter — same breathing animation as the loader */}
          <div className="flex flex-col items-center">
            <div
              className="mn-loader-letter text-navy"
              style={{ fontSize: '120px', lineHeight: 1, height: '120px' }}
            >
              ქ
            </div>
            <div className="w-16 h-1 bg-gold rounded-full mx-auto mt-3" />
          </div>

          {/* Stamp — delayed so it pops in after the card settles */}
          <div className="h-10 flex items-center justify-center">
            {stampVisible && (
              <Stamp color="ink" tilt="left" animate>
                ძველი მეგობარი
              </Stamp>
            )}
          </div>

          {/* Headline */}
          <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
            Вот оно что!
          </h2>

          {/* Body */}
          <div className="text-center">
            <p className="font-sans text-[15px] text-jewelInk leading-[1.6]">
              Эта буква встречала тебя каждый раз при загрузке.
            </p>
            <p className="font-sans text-[15px] text-jewelInk leading-[1.6] mt-1">
              Теперь ты знаешь её имя.
            </p>
          </div>

          {/* Mini-tile: ქართული — fades up after stamp (delay 350ms) */}
          <div
            className="jewel-tile px-4 py-3 text-center w-full"
            style={{ animation: 'tile-appear 250ms ease 350ms both' }}
          >
            <div className="relative z-[1]">
              <div className="font-geo text-[22px] font-bold text-jewelInk">
                ქართული
              </div>
              <div className="font-sans text-[11px] text-jewelInk/60 mt-1">
                грузинский язык
              </div>
            </div>
          </div>

          {/* CTA — full width, ≥44px height (jewel-btn default is 52px); fades in last (delay 450ms) */}
          <div style={{ animation: 'slow-fade 200ms ease 450ms both', width: '100%' }}>
            <Button variant="primary" onClick={handleClose}>
              Запомню!
            </Button>
          </div>
        </div>

        {/* Kilim stripe — bottom */}
        <div className="h-2 w-full bg-gold" />
      </div>
    </div>
  )
}
