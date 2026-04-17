import React, { useState } from 'react'

interface TimePhrase {
  geo: string
  translit: string
  russian: string
  note: string
}

const TIME_PHRASES: Record<string, TimePhrase> = {
  morning: {
    geo:      'დილა მშვიდობისა',
    translit: 'dila mshvidobisa',
    russian:  'доброе утро',
    note:     '«მშვიდობა» — мир, покой.\nГрузины желают мира с утра.',
  },
  day: {
    geo:      'გამარჯობა',
    translit: 'gamarjoba',
    russian:  'привет',
    note:     '«გამარჯვება» — победа.\nБуквально: «Да победишь!» — воинское пожелание,\nставшее универсальным приветствием.',
  },
  evening: {
    geo:      'საღამო მშვიდობისა',
    translit: 'saghamo mshvidobisa',
    russian:  'добрый вечер',
    note:     '«საღამო» — вечер, «მშვიდობა» — мир.\nВечером — снова пожелание покоя.',
  },
  night: {
    geo:      'კარგი ღამე',
    translit: 'kargi ghame',
    russian:  'спокойной ночи',
    note:     '«კარგი» — хорошо/добрый,\n«ღამე» — ночь. Просто и тепло.',
  },
}

function getTimePhrase(): TimePhrase {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return TIME_PHRASES.morning
  if (h >= 12 && h < 18) return TIME_PHRASES.day
  if (h >= 18 && h < 23) return TIME_PHRASES.evening
  return TIME_PHRASES.night
}

interface TimeGreetingProps {
  className?: string
}

export default function TimeGreeting({ className }: TimeGreetingProps) {
  const phrase = getTimePhrase()

  const [noteVisible, setNoteVisible] = useState(false)
  const [noteEverOpened, setNoteEverOpened] = useState(
    () => sessionStorage.getItem('bombora_time_greeting_noted') === phrase.geo
  )

  function handleInfoTap(e: React.MouseEvent) {
    e.stopPropagation()
    if (noteEverOpened) return
    setNoteVisible(true)
    setNoteEverOpened(true)
    sessionStorage.setItem('bombora_time_greeting_noted', phrase.geo)
  }

  return (
    <div className={`anim-fade mb-1 ${className ?? ''}`}>
      {/* Phrase row */}
      <div className="flex items-center justify-center gap-0 flex-wrap">
        <span className="font-geo text-[14px] text-jewelInk-mid font-semibold leading-none">
          {phrase.geo}
        </span>
        {!noteEverOpened && (
          <button
            type="button"
            onClick={handleInfoTap}
            className="p-2.5 -m-2.5 ml-1 shrink-0 inline-flex items-center justify-center"
            aria-label="Культурная заметка"
          >
            <span
              className="w-5 h-5 rounded-full border border-jewelInk/30 text-jewelInk-mid text-[10px] font-bold leading-none inline-flex items-center justify-center active:bg-jewelInk/10 transition-colors"
            >
              i
            </span>
          </button>
        )}
      </div>

      {/* Transliteration */}
      <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5 font-semibold tracking-wide leading-none">
        {phrase.translit}
      </div>

      {/* Cultural note card */}
      {noteVisible && (
        <div className="mn-slide-down mt-2">
          <div
            className="jewel-tile px-4 py-3 text-left w-full overflow-hidden"
          >
            <div className="font-geo text-[15px] font-extrabold text-jewelInk leading-tight">
              {phrase.geo}
            </div>
            <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5 font-semibold tracking-wide">
              {phrase.translit}
            </div>
            <div className="h-px bg-jewelInk/10 my-2" />
            <div className="font-sans text-[12px] text-jewelInk leading-snug whitespace-pre-line">
              {phrase.note}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
