import React, { useState } from 'react'
import Mascot from './Mascot'

/* ─── Card data ─── */

interface HistoryCard {
  id: string
  bomboraMood: 'cheer' | 'think' | 'happy'
  /** Shown as large accent header above the divider.
   *  null → card 4 special layout (big ქ letter instead of text). */
  accent: string | null
  body: React.ReactNode
}

const HISTORY_CARDS: HistoryCard[] = [
  /* ── Card 1: V century ── */
  {
    id: 'century',
    bomboraMood: 'cheer',
    accent: 'V საუკუნე',
    body: (
      <>
        <p className="font-sans text-[14px] text-jewelInk leading-relaxed">
          Грузинский алфавит создан в V веке нашей эры — один из 14 письменных
          систем мира, включённых в список нематериального наследия UNESCO.
        </p>
        <p className="font-sans text-[14px] font-bold text-jewelInk leading-relaxed mt-3">
          Ему больше 1 500 лет.
        </p>
      </>
    ),
  },

  /* ── Card 2: Three styles ── */
  {
    id: 'styles',
    bomboraMood: 'think',
    accent: 'სამი სტილი — три стиля',
    body: (
      <>
        {/* Three-column style showcase */}
        <div className="flex gap-2 mb-4">
          {/* Mkhedruli */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <span
              className="font-geo font-bold text-navy"
              style={{ fontSize: 36, lineHeight: 1, display: 'block' }}
            >
              ა
            </span>
            <span
              className="font-sans font-bold text-center text-navy"
              style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}
            >
              მხედრული
            </span>
            <span className="font-sans text-[10px] text-jewelInk-mid text-center leading-tight">
              (повседн.)
            </span>
          </div>

          {/* Asomtavruli */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <span
              className="font-geo font-bold text-ruby"
              style={{ fontSize: 36, lineHeight: 1, display: 'block' }}
            >
              Ⴀ
            </span>
            <span
              className="font-sans font-bold text-center text-ruby"
              style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}
            >
              ასომთავრული
            </span>
            <span className="font-sans text-[10px] text-jewelInk-mid text-center leading-tight">
              (V в., церк.)
            </span>
          </div>

          {/* Nuskhuri */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <span
              className="font-geo font-bold text-gold-deep"
              style={{ fontSize: 36, lineHeight: 1, display: 'block' }}
            >
              ⴀ
            </span>
            <span
              className="font-sans font-bold text-center text-gold-deep"
              style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}
            >
              ნუსხური
            </span>
            <span className="font-sans text-[10px] text-jewelInk-mid text-center leading-tight">
              (средн.)
            </span>
          </div>
        </div>

        <p className="font-sans text-[14px] text-jewelInk leading-relaxed">
          Одна и та же буква — три облика.{' '}
          <span className="font-bold text-navy">მხედრული</span> — «воинский» —
          используется сейчас.{' '}
          <span className="font-bold text-ruby">ასომთავრული</span> появился
          первым, <span className="font-bold text-gold-deep">ნუსხური</span> —
          для манускриптов.
        </p>
      </>
    ),
  },

  /* ── Card 3: Uniqueness ── */
  {
    id: 'unique',
    bomboraMood: 'happy',
    accent: '33 ასო — 33 буквы',
    body: (
      <>
        <p className="font-sans text-[14px] text-jewelInk leading-relaxed mb-3">
          Грузинское письмо уникально:
        </p>
        <ul className="space-y-2">
          {[
            'Нет заглавных букв',
            'Читается слева направо',
            'Ни одна буква не похожа на знаки других алфавитов',
            'Каждая буква = один звук, без исключений',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-navy font-bold text-[14px] leading-none mt-[2px] flex-shrink-0">
                •
              </span>
              <span className="font-sans text-[14px] text-jewelInk leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </>
    ),
  },

  /* ── Card 4: Reveal ქ ── */
  {
    id: 'reveal',
    bomboraMood: 'cheer',
    accent: null, // special layout — big ქ replaces the accent header
    body: (
      <>
        <p className="font-sans text-[14px] text-jewelInk-mid text-center">
          kani
        </p>
        <p className="font-sans text-[16px] font-bold text-navy text-center mt-1">
          ქართული = «грузинский язык»
        </p>
        <div className="w-full h-[1px] bg-gold/40 my-3" />
        <p className="font-sans text-[14px] text-jewelInk leading-relaxed text-center">
          Это та самая буква, которую ты видел в загрузчике с первого дня.
          Теперь ты знаешь, что означало это вращающееся ქ.
        </p>
      </>
    ),
  },
]

/* ─── Component ─── */

interface Props {
  onClose: () => void
}

export default function ScriptHistoryCarousel({ onClose }: Props) {
  const [card, setCard] = useState(0)
  const [closing, setClosing] = useState(false)

  const total = HISTORY_CARDS.length
  const current = HISTORY_CARDS[card]
  const isLast = card === total - 1
  const isReveal = current.id === 'reveal'

  function handleNext() {
    if (isLast) {
      handleClose()
      return
    }
    setCard((c) => c + 1)
  }

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 250)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-cream"
      style={{
        animation: closing
          ? 'history-overlay-out 250ms ease-in both'
          : 'history-overlay-in 320ms ease-out both',
      }}
    >
      {/* Top kilim strip */}
      <div className="mn-kilim" />

      {/* Header: close × and page counter */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full text-[18px] text-jewelInk active:bg-jewelInk/10"
          style={{
            border: '1px solid rgba(21,16,10,0.2)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ×
        </button>
        <span className="font-sans text-[12px] font-bold text-jewelInk-mid">
          {card + 1} / {total}
        </span>
      </div>

      {/* Card content — flex-1, grows between header and navigation */}
      <div className="flex-1 mx-5 mb-1 flex flex-col min-h-0">
        <div
          key={card}
          className="jewel-tile px-5 py-5 flex-1 flex flex-col mn-card-enter"
        >
          <div className="relative z-[1] flex flex-col gap-3 flex-1">
            {/* Bombora */}
            <div className="flex justify-center">
              <Mascot mood={current.bomboraMood} size={56} />
            </div>

            {isReveal ? (
              /* Card 4 special header: big ქ with gold underline — static (no animation) */
              <div className="flex flex-col items-center">
                <span
                  className="font-geo font-bold text-navy"
                  style={{ fontSize: 64, lineHeight: 1, display: 'inline-block' }}
                >
                  ქ
                </span>
                <div className="w-10 h-[3px] bg-gold rounded-full mt-2" />
              </div>
            ) : (
              /* Cards 1–3: Georgian accent text header */
              <div>
                <div className="font-sans text-[18px] font-extrabold text-navy">
                  {current.accent}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="w-full h-[1px] bg-gold/40" />

            {/* Body */}
            <div className="flex-1">{current.body}</div>
          </div>
        </div>
      </div>

      {/* Navigation: progress dots + next/done button */}
      <div className="flex items-center justify-between px-5 py-4">
        {/* Dots */}
        <div className="flex gap-2 items-center">
          {HISTORY_CARDS.map((_, i) => (
            <div
              key={i}
              className={
                i === card
                  ? 'w-3 h-3 rounded-full bg-navy'
                  : 'w-2 h-2 rounded-full bg-jewelInk/20'
              }
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={handleNext}
          className={`jewel-btn min-w-[140px] ${
            isLast ? 'jewel-btn-ruby' : 'jewel-btn-navy'
          }`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {isLast ? 'Запомню!' : 'Дальше →'}
        </button>
      </div>

      {/* Bottom kilim strip */}
      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />
    </div>
  )
}
