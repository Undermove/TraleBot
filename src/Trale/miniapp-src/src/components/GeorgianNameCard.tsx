import React, { useEffect, useState } from 'react'
import Mascot from './Mascot'
import {
  transliterateToGeorgian,
  clampNameFontSize,
  nameLetterSpacingClass,
} from '../utils/georgianizerName'

interface GeorgianNameCardProps {
  /** First name from Telegram.WebApp.initDataUnsafe.user.first_name */
  firstName: string
  /** True when all lessons of the 'alphabet-progressive' module are completed */
  alphabetDone: boolean
}

/**
 * GeorgianNameCard — shows the user's name in Georgian script on Profile.
 *
 * Phase 1 (alphabet not done): Georgian name + transliteration hint + mascot guide + learn-hint
 * Phase 2 (alphabet done):     Georgian name only + reveal badge (2.5s) + mascot cheer
 *
 * Hides itself entirely when the name cannot be transliterated.
 */
export default function GeorgianNameCard({ firstName, alphabetDone }: GeorgianNameCardProps) {
  const result = transliterateToGeorgian(firstName)
  // Nothing to show
  if (!result) return null

  return <GeorgianNameCardInner
    firstName={firstName}
    alphabetDone={alphabetDone}
    geo={result.geo}
    translit={result.translit}
  />
}

// Separated so hooks can run after the null-guard above.
function GeorgianNameCardInner({
  firstName,
  alphabetDone,
  geo,
  translit,
}: {
  firstName: string
  alphabetDone: boolean
  geo: string
  translit: string
}) {
  const [revealShown, setRevealShown] = useState(false)
  const [badgeFadingOut, setBadgeFadingOut] = useState(false)

  // Trigger reveal badge once when alphabet becomes done
  useEffect(() => {
    if (
      alphabetDone &&
      !revealShown &&
      localStorage.getItem('bombora_name_reveal_shown') !== '1'
    ) {
      localStorage.setItem('bombora_name_reveal_shown', '1')
      setRevealShown(true)
      setBadgeFadingOut(false)
      const t1 = setTimeout(() => setBadgeFadingOut(true), 2200)
      const t2 = setTimeout(() => setRevealShown(false), 2500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [alphabetDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const fontSize = clampNameFontSize(geo)
  const spacingClass = nameLetterSpacingClass(geo)

  return (
    <div className="jewel-tile px-5 py-4 mb-5 relative overflow-hidden anim-fade">
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-3">
        <div className="mn-eyebrow">моё имя по-грузински</div>
        {alphabetDone && (
          <div className="mn-eyebrow text-navy">★ знаю 33/33</div>
        )}
      </div>

      {/* Name block */}
      <div className="text-center py-3 px-2 bg-cream/60 rounded-lg border border-jewelInk/10">
        {/* Georgian letters */}
        <div
          className={`font-geo font-extrabold text-jewelInk leading-none ${spacingClass}`}
          style={{ fontSize }}
        >
          {geo}
        </div>

        {/* Transliteration — fades out after reveal */}
        <div
          className="font-sans text-[11px] text-jewelInk-mid mt-1.5 tracking-widest uppercase font-semibold"
          style={{
            opacity: alphabetDone ? 0 : 1,
            transition: 'opacity 400ms ease-out',
            pointerEvents: 'none',
          }}
        >
          {translit}
        </div>
      </div>

      {/* Bombora comment */}
      <div className="flex items-start gap-3 mt-4">
        <div className="shrink-0">
          <Mascot mood={alphabetDone ? 'cheer' : 'guide'} size={32} />
        </div>
        <div className="flex-1">
          <div className="font-geo text-[14px] font-bold text-jewelInk leading-tight">
            ქართულად შენ ხარ {geo}!
          </div>
          <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">
            На грузинском ты — {firstName}!
          </div>
        </div>
      </div>

      {/* Phase 1 hint */}
      {!alphabetDone && (
        <div className="font-sans text-[11px] text-navy/70 text-center mt-3">
          Выучи Алфавит — сможешь прочитать без подсказки
        </div>
      )}

      {/* Reveal badge — temporary, pointer-events: none */}
      {revealShown && (
        <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
          <div
            className="bg-gold border-[1.5px] border-jewelInk rounded-full px-4 py-1.5"
            style={{
              opacity: badgeFadingOut ? 0 : 1,
              transition: badgeFadingOut ? 'opacity 300ms ease-in' : 'opacity 200ms ease-out',
            }}
          >
            <span className="font-sans text-[12px] font-extrabold text-jewelInk">
              ✓ Ты можешь прочитать своё имя!
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
