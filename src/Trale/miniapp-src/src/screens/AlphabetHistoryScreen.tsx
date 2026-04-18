import React, { useState, useRef } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import { Screen } from '../types'

interface Props {
  moduleId: string
  navigate: (s: Screen) => void
}

const DOTS = ['ა', 'ბ', 'გ', 'დ']

// ─── Card components (pure presentational, no state) ─────────────────────────

function Card1() {
  return (
    <div className="jewel-tile px-5 py-6 flex flex-col h-full">
      <div className="mn-eyebrow text-gold">ა — начало</div>
      <div className="font-sans text-[24px] font-extrabold text-jewelInk leading-tight mt-1">
        V век — рождение
      </div>
      <div className="font-sans text-[40px] font-extrabold text-navy text-center my-4">
        ანბანი
      </div>
      <div className="font-sans text-[13px] text-jewelInk/80 leading-relaxed flex-1">
        Грузинский алфавит появился в V веке н.э. Старейшие известные надписи (~430 г.)
        найдены в Палестине. Один из немногих алфавитов с точной датой рождения.
      </div>
      <Mascot size={64} mood="think" className="ml-auto mt-4" />
    </div>
  )
}

function Card2() {
  const styles = [
    { letter: 'მ', name: 'მხედრული', label: 'современный', navy: true },
    { letter: 'Ⴋ', name: 'ასომთავრული', label: 'церковный',   navy: false },
    { letter: '⴬', name: 'ნუსხური',     label: 'рукописный',  navy: false },
  ]
  return (
    <div className="jewel-tile px-5 py-6 flex flex-col h-full">
      <div className="mn-eyebrow text-gold">ბ — три стиля</div>
      <div className="font-sans text-[24px] font-extrabold text-jewelInk leading-tight mt-1">
        Три стиля одного письма
      </div>
      <div className="flex gap-2 my-4">
        {styles.map((s) => (
          <div
            key={s.name}
            className="flex-1 flex flex-col items-center rounded-xl border border-jewelInk/20 bg-cream-tile px-2 py-3"
          >
            <span
              className={`font-sans text-[28px] font-extrabold ${s.navy ? 'text-navy' : 'text-jewelInk'}`}
            >
              {s.letter}
            </span>
            <span className="font-sans text-[10px] text-jewelInk/60 text-center mt-1 leading-tight">
              {s.name}
            </span>
          </div>
        ))}
      </div>
      <div className="font-sans text-[10px] text-jewelInk/60 text-center -mt-2 mb-3 tracking-wide">
        современный · церковный · рукописный
      </div>
      <div className="font-sans text-[13px] text-jewelInk/80 leading-relaxed flex-1">
        Мы учим მხედრული — современное светское письмо. Остальные два встречаются в
        церковных текстах.
      </div>
      <Mascot size={64} mood="guide" className="mt-4" />
    </div>
  )
}

function Card3() {
  return (
    <div className="jewel-tile px-5 py-6 flex flex-col h-full">
      <div className="mn-eyebrow text-gold">გ — в мире</div>
      <div className="font-sans text-[24px] font-extrabold text-jewelInk leading-tight mt-1">
        Наследие ЮНЕСКО
      </div>
      <div className="font-sans text-[36px] font-extrabold text-navy text-center mt-4">
        ქართული
      </div>
      <div className="font-sans text-[12px] text-jewelInk/60 text-center font-semibold tracking-wide mt-0.5 mb-4">
        грузинский
      </div>
      <div className="font-sans text-[13px] text-jewelInk/80 leading-relaxed flex-1">
        В 2016 году три грузинских письма включены в Реестр документального наследия
        ЮНЕСКО. Из ~7 000 языков лишь ~100 имеют собственный алфавит. Грузинский —
        один из старейших непрерывно используемых.
      </div>
      <Mascot size={64} mood="happy" className="ml-auto mt-4" />
    </div>
  )
}

function Card4() {
  return (
    <div className="jewel-tile gold-reveal-glow px-5 py-6 flex flex-col h-full">
      <div className="mn-eyebrow text-ruby">დ — финал</div>
      <div className="font-sans text-[24px] font-extrabold text-jewelInk leading-tight mt-1">
        Ты уже знал эту букву
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div
          className="display-xl text-navy text-center anim-scale-reveal"
          style={{ fontSize: 'clamp(64px, 18vw, 80px)', animationDelay: '150ms' }}
        >
          ქ
        </div>
      </div>
      <div className="font-sans text-[13px] text-jewelInk/80 leading-relaxed">
        Каждый раз, открывая Бомбору, ты видел эту букву. Это ქ — первая буква слова
        ქართული (грузинский). Загрузчик был уроком с первого дня.
      </div>
      <Mascot size={72} mood="cheer" className="anim-wag mx-auto mt-4" />
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AlphabetHistoryScreen({ moduleId, navigate }: Props) {
  const [cardIndex, setCardIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<React.ReactNode | null>(null)
  const [animDir, setAnimDir] = useState<'left' | 'right'>('left')
  const [animating, setAnimating] = useState(false)
  const animRef = useRef(false)

  function renderCard(index: number): React.ReactNode {
    switch (index) {
      case 0: return <Card1 />
      case 1: return <Card2 />
      case 2: return <Card3 />
      case 3: return <Card4 />
      default: return null
    }
  }

  function goTo(newIndex: number) {
    if (animRef.current || newIndex === cardIndex || newIndex < 0 || newIndex > 3) return
    const dir: 'left' | 'right' = newIndex > cardIndex ? 'left' : 'right'
    animRef.current = true
    setOutgoing(renderCard(cardIndex))
    setAnimDir(dir)
    setAnimating(true)
    setCardIndex(newIndex)
    setTimeout(() => {
      setOutgoing(null)
      setAnimating(false)
      animRef.current = false
    }, 295)
  }

  const outClass = animDir === 'left' ? 'card-slide-out-left' : 'card-slide-out-right'
  const inClass  = animDir === 'left' ? 'card-slide-in-right' : 'card-slide-in-left'

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        onBack={() => navigate({ kind: 'module', moduleId })}
        title="История алфавита"
      />

      <div
        className="flex-1 flex flex-col px-5 pt-6"
        style={{ paddingBottom: 'calc(var(--safe-b) + 24px)' }}
      >
        {/* Card carousel — overflow-hidden clips slide animations */}
        <div className="relative overflow-hidden flex-1" style={{ minHeight: 420 }}>
          {outgoing && (
            <div key="outgoing" className={`absolute inset-0 ${outClass}`}>
              {outgoing}
            </div>
          )}
          <div
            key="current"
            className={animating ? `absolute inset-0 ${inClass}` : 'absolute inset-0'}
          >
            {renderCard(cardIndex)}
          </div>
        </div>

        {/* Progress dots — Georgian letters ა ბ გ დ */}
        <div className="flex gap-4 justify-center items-center py-3">
          {DOTS.map((letter, i) => (
            <button
              key={letter}
              onClick={() => goTo(i)}
              className="w-11 h-11 flex items-center justify-center"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  i === cardIndex ? 'bg-navy' : 'border-2 border-jewelInk/30'
                }`}
              >
                <span
                  className={`font-sans font-extrabold ${
                    i === cardIndex
                      ? 'text-[16px] text-cream'
                      : 'text-[14px] text-jewelInk/30'
                  }`}
                >
                  {letter}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* CTA button */}
        <button
          className="jewel-btn jewel-btn-navy w-full"
          onClick={() =>
            cardIndex === 3
              ? navigate({ kind: 'module', moduleId })
              : goTo(cardIndex + 1)
          }
        >
          {cardIndex === 3 ? 'Начать алфавит' : 'Далее →'}
        </button>
      </div>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />
    </div>
  )
}
