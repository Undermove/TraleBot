import React, { useState } from 'react'
import Mascot from './Mascot'
import Stamp from './Stamp'
import Button from './Button'

interface Props {
  onClose: () => void
}

/**
 * Full-screen carousel with 4 historical fact cards about the Georgian alphabet.
 * Entry point: AlphabetHistoryTile in ModuleMap (alphabet-progressive only).
 * No localStorage flag — can be reopened freely.
 */
export default function AlphabetHistoryOverlay({ onClose }: Props) {
  const [cardIndex, setCardIndex] = useState(0)
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 220)
  }

  function goNext() {
    if (cardIndex < 3) setCardIndex(cardIndex + 1)
    else handleClose()
  }

  function goPrev() {
    if (cardIndex > 0) setCardIndex(cardIndex - 1)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-cream"
      style={{
        animation: closing
          ? 'reveal-backdrop-out 220ms ease both'
          : 'reveal-backdrop-in 250ms ease both',
      }}
    >
      {/* Kilim strip — top */}
      <div className="h-2 w-full bg-gold flex-shrink-0" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, WebkitTapHighlightColor: 'transparent' }}
          aria-label="Закрыть"
        >
          <span className="font-sans text-[20px] text-jewelInk leading-none">×</span>
        </button>

        {/* Dot indicator */}
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-150"
              style={{
                width: i === cardIndex ? 12 : 8,
                height: i === cardIndex ? 12 : 8,
                background: i === cardIndex ? '#1B5FB0' : 'rgba(21,16,10,0.20)',
              }}
            />
          ))}
        </div>

        {/* Card counter */}
        <div className="mn-eyebrow" style={{ minWidth: 44, textAlign: 'right' }}>
          {cardIndex + 1} / 4
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full"
          style={{
            transform: `translateX(-${cardIndex * 100}%)`,
            transition: 'transform 250ms ease-out',
            width: '400%',
          }}
        >
          <div className="w-[25%] h-full overflow-y-auto">
            <Card1 />
          </div>
          <div className="w-[25%] h-full overflow-y-auto">
            <Card2 />
          </div>
          <div className="w-[25%] h-full overflow-y-auto">
            <Card3 />
          </div>
          <div className="w-[25%] h-full overflow-y-auto">
            <Card4 />
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-5 pb-4 pt-3 flex-shrink-0 flex gap-3">
        {cardIndex > 0 ? (
          <button
            onClick={goPrev}
            className="jewel-btn bg-cream text-jewelInk flex-1"
            style={{ minHeight: 52 }}
          >
            <span className="relative z-[1]">← Назад</span>
          </button>
        ) : null}
        <button
          onClick={goNext}
          className={`jewel-btn bg-navy text-cream ${cardIndex === 0 ? 'w-full' : 'flex-1'}`}
          style={{ minHeight: 52 }}
        >
          <span className="relative z-[1]">
            {cardIndex === 3 ? 'Начну учить!' : 'Далее →'}
          </span>
        </button>
      </div>
      {cardIndex === 3 && (
        <div
          className="text-center pb-3 flex-shrink-0"
          style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 11, color: 'rgba(21,16,10,0.5)' }}
        >
          ვისწავლი
        </div>
      )}

      {/* Kilim strip — bottom */}
      <div className="h-2 w-full bg-gold flex-shrink-0" />
      <div style={{ height: 'calc(var(--safe-b, 0px) + 4px)' }} />
    </div>
  )
}

/* ─── Card 1: «Рождение алфавита» ─────────────────────────── */
function Card1() {
  return (
    <div className="px-5 pt-4 pb-6 flex flex-col items-center gap-4 relative">
      <div className="mn-eyebrow self-start">карточка 1 из 4</div>

      {/* Big letter */}
      <div className="flex flex-col items-center">
        <div
          className="text-navy font-extrabold leading-none"
          style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 96 }}
        >
          ა
        </div>
        <div className="w-12 h-1 bg-gold rounded-full mx-auto mt-2 mb-2" />
      </div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        V век нашей эры
      </h2>

      {/* Body */}
      <p className="font-sans text-[15px] text-jewelInk leading-[1.65] text-center">
        Грузинский алфавит создан около 430 года н.э. —
        один из старейших в мире. С первых дней использовался
        для записи молитв, законов и поэзии.
      </p>

      {/* Mini jewel-tile */}
      <div className="jewel-tile px-4 py-3 text-center w-full">
        <div className="relative z-[1]">
          <div className="mn-eyebrow mb-1">по-грузински</div>
          <div
            className="font-extrabold text-navy"
            style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 20 }}
          >
            ანბანი
          </div>
          <div className="mn-eyebrow mt-1">алфавит</div>
        </div>
      </div>

      {/* Bombora */}
      <div className="flex justify-center">
        <Mascot mood="cheer" size={80} />
      </div>
    </div>
  )
}

/* ─── Card 2: «Три стиля письма» ──────────────────────────── */
function Card2() {
  return (
    <div className="px-5 pt-4 pb-6 flex flex-col gap-4">
      <div className="mn-eyebrow">карточка 2 из 4</div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
        Три облика одной буквы
      </h2>

      {/* Body */}
      <p className="font-sans text-[15px] text-jewelInk leading-[1.65]">
        За 16 веков грузинское письмо развило три стиля.
        Сегодня используется мхедрули — «воинское письмо».
      </p>

      {/* Three-style table */}
      <div className="flex gap-3">
        {[
          { letter: 'Ⴁ', name: 'ასომ', date: 'V в.' },
          { letter: 'ბ', name: 'ნუს', date: 'IX в.' },
          { letter: 'ბ', name: 'მხედ', date: 'XI в.' },
        ].map(({ letter, name, date }) => (
          <div key={name} className="jewel-tile px-2 py-3 flex flex-col items-center flex-1">
            <div
              className="relative z-[1] font-extrabold text-jewelInk leading-none"
              style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 28 }}
            >
              {letter}
            </div>
            <div
              className="relative z-[1] text-center leading-tight mt-1"
              style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 10, color: 'rgba(21,16,10,0.70)' }}
            >
              {name}
            </div>
            <div className="relative z-[1] mn-eyebrow mt-0.5" style={{ color: 'rgba(21,16,10,0.5)' }}>
              {date}
            </div>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="mn-eyebrow text-center" style={{ color: 'rgba(21,16,10,0.5)' }}>
        мхедрули — то, что ты учишь сейчас
      </div>

      {/* Bombora */}
      <div className="flex justify-center">
        <Mascot mood="think" size={64} />
      </div>
    </div>
  )
}

/* ─── Card 3: «Один из 14 в мире» ─────────────────────────── */
function Card3() {
  return (
    <div className="px-5 pt-4 pb-6 flex flex-col gap-4">
      <div className="mn-eyebrow">карточка 3 из 4</div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
        Один из 14 в мире
      </h2>

      {/* Body */}
      <p className="font-sans text-[15px] text-jewelInk leading-[1.65]">
        В мире существует только 14 алфавитов с полностью
        оригинальными буквами. Ни одна из 33 грузинских букв
        не заимствована у других систем письма.
      </p>

      {/* Gold badge */}
      <div className="jewel-tile px-4 py-4 flex flex-col items-center">
        <div
          className="relative z-[1] flex flex-col items-center justify-center rounded-full bg-gold border-[1.5px] border-jewelInk mb-3"
          style={{ width: 80, height: 80 }}
        >
          <span className="font-sans text-[32px] font-extrabold text-jewelInk leading-none">14</span>
          <span
            className="font-sans text-[10px] text-center leading-tight px-2"
            style={{ color: 'rgba(21,16,10,0.70)' }}
          >
            оригинальных алфавитов
          </span>
        </div>
      </div>

      {/* Second body */}
      <p className="font-sans text-[15px] text-jewelInk leading-[1.65]">
        Кириллица и латиница возникли на основе греческого.
        Грузинский — создан независимо.
      </p>

      {/* Mini jewel-tile */}
      <div className="jewel-tile px-4 py-3 text-center w-full">
        <div className="relative z-[1]">
          <div className="mn-eyebrow mb-1">по-грузински</div>
          <div
            className="font-extrabold text-navy"
            style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 20 }}
          >
            მხედრული
          </div>
          <div className="mn-eyebrow mt-1">воинское письмо</div>
        </div>
      </div>

      {/* Bombora */}
      <div className="flex justify-center">
        <Mascot mood="happy" size={64} />
      </div>
    </div>
  )
}

/* ─── Card 4: «Буква, которую ты уже видел» ───────────────── */
function Card4() {
  return (
    <div className="px-5 pt-4 pb-6 flex flex-col items-center gap-4">
      <div className="mn-eyebrow self-start">карточка 4 из 4</div>

      {/* Animated ქ — same breathing animation as the loader */}
      <div className="flex flex-col items-center">
        <div
          className="mn-loader-letter text-navy"
          style={{ fontSize: 96, lineHeight: 1, height: 96 }}
        >
          ქ
        </div>
        <div className="w-12 h-1 bg-gold rounded-full mx-auto mt-2 mb-2" />
      </div>

      {/* Headline */}
      <h2 className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight text-center w-full">
        Ты её уже знаешь
      </h2>

      {/* Body */}
      <p className="font-sans text-[15px] text-jewelInk leading-[1.65] text-center">
        Буква ქ («кани») — первая буква слова
        ქართული — «грузинский язык».
      </p>

      {/* Mini jewel-tile */}
      <div className="jewel-tile px-4 py-3 text-center w-full">
        <div className="relative z-[1]">
          <div
            className="font-extrabold text-navy"
            style={{ fontFamily: "'Noto Sans Georgian', 'Manrope', sans-serif", fontSize: 20 }}
          >
            ქართული
          </div>
          <div className="mn-eyebrow mt-1">грузинский язык</div>
        </div>
      </div>

      {/* Secondary body */}
      <p className="font-sans text-[13px] text-center" style={{ color: 'rgba(21,16,10,0.55)' }}>
        Именно её ты видел при каждой загрузке.
      </p>

      {/* Stamp */}
      <Stamp color="navy" tilt="left" animate>
        ძველი მეგობარი
      </Stamp>

      {/* Bombora */}
      <Mascot mood="cheer" size={72} />
    </div>
  )
}
