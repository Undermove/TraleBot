import React, { useEffect, useState } from 'react'
import Stamp from './Stamp'
import Mascot from './Mascot'
import Button from './Button'

interface AlphabetHistoryCarouselProps {
  onClose: () => void
}

type StripeColor = 'navy' | 'gold'

interface HistoryCard {
  id: string
  stripeColor: StripeColor
  isReveal?: boolean
}

const HISTORY_CARDS: HistoryCard[] = [
  { id: 'ancient', stripeColor: 'navy' },
  { id: 'three-scripts', stripeColor: 'navy' },
  { id: 'unique', stripeColor: 'navy' },
  { id: 'kani-reveal', stripeColor: 'gold', isReveal: true },
]

// Card 1: One of the oldest
function CardAncient() {
  return (
    <div className="px-5 pt-5 pb-6 flex flex-col items-center gap-4">
      {/* Roman numeral + Georgian word */}
      <div className="flex flex-col items-center">
        <div className="font-sans text-[80px] font-extrabold text-navy leading-none select-none">
          V
        </div>
        <div className="font-geo text-[13px] text-navy/70 tracking-wide mt-1">
          საუkუნე
        </div>
      </div>

      {/* Gold hairline */}
      <div className="w-full h-px bg-gold/60" />

      {/* Stamp */}
      <Stamp color="ink" tilt="right" animate>~430 н.э.</Stamp>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        Один из древнейших
      </h2>

      {/* Body */}
      <p className="font-sans text-[14px] text-jewelInk leading-snug text-center">
        Грузинское письмо создано в V веке (~430 г. н.э.) — на полторы тысячи лет старше русского. Один из ~14 алфавитов мира, который не изменился до наших дней.
      </p>
    </div>
  )
}

// Card 2: Three scripts
function CardThreeScripts() {
  return (
    <div className="px-5 pt-5 pb-6 flex flex-col items-center gap-4">
      {/* Three mini script tiles */}
      <div className="flex gap-2 w-full">
        {[
          { geo: 'ანბანი', name: 'მხედრული', label: 'светское' },
          { geo: 'ႠႬႡႠႬႨ', name: 'ასომTavr.', label: 'заглавные' },
          { geo: 'ⴀⴌⴁ', name: 'ნუSXuri', label: 'курсив' },
        ].map((script) => (
          <div
            key={script.name}
            className="flex-1 border border-jewelInk/20 rounded px-2 py-2 text-center"
          >
            <div className="font-geo text-[12px] font-bold text-jewelInk leading-snug">
              {script.geo}
            </div>
            <div className="font-sans text-[10px] text-jewelInk/60 mt-1 leading-tight">
              {script.label}
            </div>
          </div>
        ))}
      </div>

      {/* Caption */}
      <div className="font-sans text-[10px] text-jewelInk/50 text-center -mt-2">
        мхедрули / ასომTavr. / ნუSXuri
      </div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        Три письма одного языка
      </h2>

      {/* Body */}
      <p className="font-sans text-[14px] text-jewelInk leading-snug text-center">
        Грузинский — единственный язык с тремя параллельными письменностями. Все три — в наследии ЮНЕСКО с 2016 года.
      </p>
    </div>
  )
}

// Card 3: Unique
function CardUnique() {
  const letters = ['ა', 'გ', 'ე', 'მ', 'ნ', 'ო', 'რ', 'ს', 'ტ']
  return (
    <div className="px-5 pt-5 pb-6 flex flex-col items-center gap-4">
      {/* Decorative 3×3 letter grid */}
      <div className="grid grid-cols-3 gap-2 w-full text-center select-none">
        {letters.map((l) => (
          <div key={l} className="font-geo text-[28px] text-navy/40 leading-tight">
            {l}
          </div>
        ))}
      </div>

      {/* Gold hairline */}
      <div className="w-full h-px bg-gold/60" />

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        Ни на что не похоже
      </h2>

      {/* Body */}
      <p className="font-sans text-[14px] text-jewelInk leading-snug text-center">
        В мире ~40 живых алфавитов. Грузинский не связан ни с одним из них — не латиница, не кириллица, не арабский. Его нельзя «угадать» через другой язык — нужно выучить с нуля.
      </p>

      {/* Mini tile */}
      <div className="jewel-tile px-3 py-2 text-center w-full">
        <div className="font-geo text-[13px] font-bold text-jewelInk relative z-[1]">
          ქართული დამწერლობა
        </div>
        <div className="font-sans text-[11px] text-jewelInk/60 mt-0.5 relative z-[1]">
          грузинское письмо
        </div>
      </div>
    </div>
  )
}

// Card 4: Old acquaintance (Reveal)
function CardReveal({ stampVisible }: { stampVisible: boolean }) {
  return (
    <div className="px-5 pt-5 pb-6 flex flex-col items-center gap-3 overflow-y-auto">
      {/* Animated ქ letter */}
      <div className="flex flex-col items-center">
        <div
          className="mn-loader-letter text-navy"
          style={{ fontSize: '96px', lineHeight: 1, height: '96px' }}
        >
          ქ
        </div>
        <div className="w-14 h-1 bg-gold rounded-full mx-auto mt-2" />
      </div>

      {/* Bombora mascot */}
      <Mascot mood="cheer" size={56} />

      {/* Stamp */}
      <div className="h-8 flex items-center justify-center">
        {stampVisible && (
          <Stamp color="ink" tilt="left" animate>
            ძველი მეგობარი
          </Stamp>
        )}
      </div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        Старый знакомый!
      </h2>

      {/* Body */}
      <p className="font-sans text-[14px] text-jewelInk leading-snug text-center">
        Эта буква встречала тебя каждый раз при загрузке приложения. Теперь ты знаешь: это ქ — первая буква слова
      </p>

      {/* Mini tile */}
      <div
        className="jewel-tile px-4 py-3 text-center w-full"
        style={{ animation: 'tile-appear 250ms ease 350ms both' }}
      >
        <div className="font-geo text-[16px] font-bold text-jewelInk relative z-[1]">
          ქართული — грузинский язык
        </div>
      </div>
    </div>
  )
}

export default function AlphabetHistoryCarousel({ onClose }: AlphabetHistoryCarouselProps) {
  const [cardIndex, setCardIndex] = useState(0)
  const [closing, setClosing] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [slideClass, setSlideClass] = useState<string>('')
  const [stampVisible, setStampVisible] = useState(false)

  // Trigger stamp on card 4
  useEffect(() => {
    if (cardIndex === 3) {
      const t = setTimeout(() => setStampVisible(true), 280)
      return () => clearTimeout(t)
    } else {
      setStampVisible(false)
    }
  }, [cardIndex])

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 220)
  }

  function goNext() {
    if (cardIndex >= HISTORY_CARDS.length - 1) return
    setSlideClass('mn-slide-out-left')
    setTimeout(() => {
      setCardIndex((i) => i + 1)
      setSlideClass('mn-slide-in-right')
    }, 200)
  }

  function goPrev() {
    if (cardIndex <= 0) return
    setSlideClass('mn-slide-out-right')
    setTimeout(() => {
      setCardIndex((i) => i - 1)
      setSlideClass('mn-slide-in-left')
    }, 200)
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return
    const delta = e.changedTouches[0].clientX - touchStartX
    if (delta < -50 && cardIndex < HISTORY_CARDS.length - 1) goNext()
    if (delta > 50 && cardIndex > 0) goPrev()
    setTouchStartX(null)
  }

  function handleCardTap(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    if (e.clientX > midX && cardIndex < HISTORY_CARDS.length - 1) goNext()
    if (e.clientX < midX && cardIndex > 0) goPrev()
  }

  const card = HISTORY_CARDS[cardIndex]
  const stripeClass = card.stripeColor === 'gold' ? 'bg-gold' : 'bg-navy'
  const isLast = cardIndex === HISTORY_CARDS.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(21,16,10,0.72)',
        animation: closing
          ? 'reveal-backdrop-out 220ms ease both'
          : 'reveal-backdrop-in 250ms ease both',
      }}
    >
      {/* Card container */}
      <div
        className="max-w-[340px] w-[calc(100%-32px)] bg-cream rounded-2xl overflow-hidden flex flex-col"
        style={{
          border: '1.5px solid #15100A',
          boxShadow: '4px 4px 0 #15100A',
          animation: closing
            ? 'reveal-card-out 220ms ease-in both'
            : 'reveal-card-in 320ms ease-out both',
        }}
      >
        {/* Top kilim stripe */}
        <div className={`h-2 w-full ${stripeClass}`} />

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          {/* Dot indicator */}
          <div className="flex items-center gap-1.5">
            {HISTORY_CARDS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === cardIndex
                    ? 'w-3 h-2 bg-navy'
                    : 'w-2 h-2 bg-jewelInk/25'
                }`}
              />
            ))}
          </div>

          {/* Page counter */}
          <span className="font-sans text-[11px] text-jewelInk/50 tabular-nums">
            {cardIndex + 1} / {HISTORY_CARDS.length}
          </span>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-10 h-10 -mr-2 flex items-center justify-center text-jewelInk/50 hover:text-jewelInk transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Закрыть"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 2 L14 14 M14 2 L2 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Card content — tappable for navigation */}
        <div
          className={`flex-1 cursor-pointer select-none ${slideClass}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleCardTap}
        >
          {cardIndex === 0 && <CardAncient />}
          {cardIndex === 1 && <CardThreeScripts />}
          {cardIndex === 2 && <CardUnique />}
          {cardIndex === 3 && <CardReveal stampVisible={stampVisible} />}
        </div>

        {/* CTA button */}
        <div className="px-5 pb-5">
          <Button
            variant="primary"
            onClick={isLast ? handleClose : goNext}
          >
            {isLast ? 'Понятно!' : 'Далее'}
          </Button>
        </div>

        {/* Bottom kilim stripe */}
        <div className={`h-2 w-full ${stripeClass}`} />
      </div>
    </div>
  )
}
