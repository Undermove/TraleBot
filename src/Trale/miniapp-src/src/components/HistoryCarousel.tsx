import React, { useRef, useState } from 'react'
import Mascot from './Mascot'

interface HistoryCarouselProps {
  onClose: () => void
}

const TOTAL = 4

/**
 * Full-screen carousel of 4 fact-cards about the Georgian alphabet history.
 * Shown when the user taps "История письма" in an alphabet module.
 * Purely static content — no backend dependency.
 */
export default function HistoryCarousel({ onClose }: HistoryCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [prevSlide, setPrevSlide] = useState<number | null>(null)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [transitioning, setTransitioning] = useState(false)
  const [closing, setClosing] = useState(false)

  const touchStart = useRef(0)

  const goTo = (idx: number, dir: 'next' | 'prev') => {
    if (transitioning) return
    setPrevSlide(current)
    setCurrent(idx)
    setDirection(dir)
    setTransitioning(true)
    setTimeout(() => {
      setPrevSlide(null)
      setTransitioning(false)
    }, 240)
  }

  const next = () => { if (current < TOTAL - 1) goTo(current + 1, 'next') }
  const prev = () => { if (current > 0) goTo(current - 1, 'prev') }

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) {
      delta > 0 ? next() : prev()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-cream"
      style={{
        animation: closing
          ? 'history-fade-out 200ms ease both'
          : 'slow-fade 180ms ease both',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Kilim stripe — top */}
      <div className="mn-kilim" />

      {/* Top bar: × close + slide counter */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={handleClose}
          className="flex items-center justify-center font-sans text-[20px] text-jewelInk-mid"
          style={{ width: 44, height: 44, WebkitTapHighlightColor: 'transparent' }}
          aria-label="Закрыть историю письма"
        >
          ×
        </button>
        <div className="font-sans text-[11px] text-jewelInk-hint">
          {current + 1} / {TOTAL}
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Outgoing card */}
        {transitioning && prevSlide !== null && (
          <div
            key={`prev-${prevSlide}`}
            className="absolute inset-0 flex items-center justify-center px-4"
            style={{
              animation: `history-slide-exit-${direction === 'next' ? 'left' : 'right'} 220ms ease-in both`,
            }}
          >
            <div
              className="jewel-tile w-[90%] px-5 py-6 overflow-y-auto"
              style={{ maxHeight: 'calc(100dvh - 220px)' }}
            >
              <div className="relative z-[1]">
                {renderCardContent(prevSlide)}
              </div>
            </div>
          </div>
        )}

        {/* Current card */}
        <div
          key={`current-${current}`}
          className="absolute inset-0 flex items-center justify-center px-4"
          style={{
            animation: transitioning
              ? `history-slide-enter-${direction === 'next' ? 'right' : 'left'} 220ms 20ms ease-out both`
              : undefined,
          }}
        >
          <div
            className="jewel-tile w-[90%] px-5 py-6 overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - 220px)' }}
          >
            <div className="relative z-[1]">
              {renderCardContent(current)}
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 py-4">
        {Array.from({ length: TOTAL }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${i === current ? 'bg-gold' : 'bg-jewelInk/20'}`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 px-5 pb-3" style={{ paddingBottom: 'calc(var(--safe-b) + 12px)' }}>
        <button
          onClick={prev}
          disabled={current === 0}
          className="jewel-btn jewel-btn-cream flex-1"
          style={{ minHeight: 52 }}
        >
          ← Назад
        </button>

        {current < TOTAL - 1 ? (
          <button
            onClick={next}
            className="jewel-btn jewel-btn-navy flex-1"
            style={{ minHeight: 52 }}
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={handleClose}
            className="jewel-btn jewel-btn-navy flex-1"
            style={{ minHeight: 52 }}
          >
            Запомнил! ✓
          </button>
        )}
      </div>

      {/* Kilim stripe — bottom */}
      <div className="mn-kilim" />
    </div>
  )
}

/* ─── Card content renderers ─── */

function renderCardContent(slide: number): React.ReactNode {
  switch (slide) {
    case 0: return <Card1 />
    case 1: return <Card2 />
    case 2: return <Card3 />
    case 3: return <Card4 />
    default: return null
  }
}

/** Card 1 — Возраст алфавита */
function Card1() {
  return (
    <div className="flex flex-col gap-3">
      <div className="mn-eyebrow">ФАКТ 1 ИЗ 4</div>

      <div className="display-xl text-navy mt-1">V</div>

      <div className="font-sans text-[15px] font-bold text-jewelInk leading-snug">
        Грузинский алфавит создан<br />в V веке нашей эры
      </div>

      <div className="font-sans text-[14px] text-jewelInk-mid leading-relaxed">
        Один из 10 старейших письменностей в мире.
        Древнейшие надписи найдены в Палестине (430 г. н.э.)
      </div>

      {/* Term badge */}
      <div className="mt-1">
        <span
          className="font-sans text-[13px] text-navy font-bold px-2 py-0.5 rounded border border-gold"
        >
          ასო — буква
        </span>
      </div>
    </div>
  )
}

/** Card 2 — Три стиля */
function Card2() {
  return (
    <div className="flex flex-col gap-3">
      <div className="mn-eyebrow">ФАКТ 2 ИЗ 4</div>

      <div className="font-sans text-[15px] font-bold text-jewelInk leading-snug">
        Три стиля одного алфавита
      </div>

      {/* Three mini tiles */}
      <div className="flex gap-2 mt-1">
        {/* მხედრული — active */}
        <div
          className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center gap-1 border-[1.5px] border-navy bg-navy-wash"
        >
          <div className="font-sans text-[10px] font-bold text-navy text-center leading-tight">
            მხედრული
          </div>
          <div className="font-sans text-[22px] font-bold text-navy leading-none">ა</div>
          <div className="font-sans text-[9px] text-navy opacity-70 text-center">современный</div>
          <div
            className="font-sans text-[9px] font-bold text-gold-deep px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(245,184,32,0.25)', border: '1px solid #F5B820' }}
          >
            учим!
          </div>
        </div>

        {/* ასომთავრული */}
        <div
          className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center gap-1 border-[1.5px] border-jewelInk/30 bg-cream-tile"
        >
          <div className="font-sans text-[10px] font-bold text-jewelInk-mid text-center leading-tight">
            ასომთავ-<br/>რული
          </div>
          <div className="font-sans text-[22px] font-bold text-jewelInk-mid leading-none">Ⴀ</div>
          <div className="font-sans text-[9px] text-jewelInk-hint text-center">церковный</div>
        </div>

        {/* ნუსხური */}
        <div
          className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center gap-1 border-[1.5px] border-jewelInk/30 bg-cream-tile"
        >
          <div className="font-sans text-[10px] font-bold text-jewelInk-mid text-center leading-tight">
            ნუსხური
          </div>
          <div className="font-sans text-[22px] font-bold text-jewelInk-mid leading-none">ⴀ</div>
          <div className="font-sans text-[9px] text-jewelInk-hint text-center">старинный</div>
        </div>
      </div>

      <div className="font-sans text-[14px] text-jewelInk-mid leading-relaxed mt-1">
        Сегодня мы учим <span className="font-bold text-navy">მხედრული</span> — «воинский шрифт»
      </div>
    </div>
  )
}

/** Card 3 — Уникальность */
function Card3() {
  return (
    <div className="flex flex-col gap-3">
      <div className="mn-eyebrow">ФАКТ 3 ИЗ 4</div>

      <div className="display-xl text-ruby mt-1">14</div>

      <div className="font-sans text-[15px] font-bold text-jewelInk leading-snug">
        Один из 14 независимых алфавитов в мире
      </div>

      <div className="font-sans text-[14px] text-jewelInk-mid leading-relaxed">
        Большинство алфавитов мира — потомки финикийского.
        Грузинский возник независимо.
      </div>

      {/* Inner list tile */}
      <div
        className="jewel-tile px-4 py-3 mt-1"
      >
        <div className="relative z-[1] grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            'Грузинский', 'Армянский',
            'Эфиопский', 'Корейский',
            'Японский', 'Тибетский',
          ].map((name) => (
            <div key={name} className="font-sans text-[12px] text-jewelInk">
              • {name}
            </div>
          ))}
          <div className="font-sans text-[12px] text-jewelInk-hint col-span-2">
            • ... и ещё 8
          </div>
        </div>
      </div>
    </div>
  )
}

/** Card 4 — Reveal: буква ქ */
function Card4() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="mn-eyebrow w-full text-left">ФАКТ 4 ИЗ 4</div>

      {/* Mascot */}
      <Mascot mood="cheer" size={64} />

      {/* ქ with breathing animation */}
      <div
        className="mn-loader-letter text-gold-deep"
        style={{ fontSize: 'clamp(44px, 12vw, 64px)', lineHeight: 1 }}
      >
        ქ
      </div>

      <div className="font-sans text-[15px] font-bold text-jewelInk leading-snug">
        Ты знаешь эту букву!
      </div>

      <div className="font-sans text-[14px] text-jewelInk-mid leading-relaxed">
        Это «кани» — первая буква слова{' '}
        <span className="font-bold text-navy">ქართული</span> (картули) —
        «грузинский язык».
        Она встречала тебя при каждом входе в приложение.
      </div>

      {/* Stamp — ძველი მეგობარი */}
      <div
        className="mt-2 px-4 py-2.5 border-[1.5px] border-ruby rounded-lg rotate-xs bg-cream-tile"
        style={{
          maxWidth: 200,
          boxShadow: '2px 2px 0 #15100A',
        }}
      >
        <div className="font-geo text-[16px] font-extrabold text-ruby leading-tight">
          ძველი მეგობარი
        </div>
        <div className="font-sans text-[10px] font-bold text-ruby opacity-70 mt-0.5 tracking-wide">
          старый знакомый
        </div>
      </div>
    </div>
  )
}
