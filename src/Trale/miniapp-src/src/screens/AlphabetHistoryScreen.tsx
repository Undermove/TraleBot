import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import Stamp from '../components/Stamp'
import { Screen } from '../types'

interface AlphabetHistoryScreenProps {
  moduleId: string
  navigate: (s: Screen) => void
}

// ─── Card data types ─────────────────────────────────────────────────────────

interface ScriptStyle {
  letters: string
  name: string
  desc: string
  accent: 'navy' | 'neutral' | 'muted'
}

interface Card1 {
  kind: 'birth'
  label: string
  labelRu: string
  bombora: 'cheer'
  body: string
  caption: string
}

interface Card2 {
  kind: 'styles'
  label: string
  labelRu: string
  bombora: 'guide'
  body: string
  styles: ScriptStyle[]
}

interface Card3 {
  kind: 'uniqueness'
  label: string
  labelRu: null
  bombora: 'think'
  body: string
  navyTile: { geo: string; text: string }
}

interface Card4 {
  kind: 'reveal'
  label: string
  labelRu: string
  bombora: 'happy'
  headline: string
  body: string
  reveal: { letter: string; word: string; translation: string }
  stamp: string
}

type HistoryCard = Card1 | Card2 | Card3 | Card4

// ─── Static card data — no backend needed ────────────────────────────────────

const HISTORY_CARDS: HistoryCard[] = [
  {
    kind: 'birth',
    label: 'V საუკუნე',
    labelRu: 'Пятый век',
    bombora: 'cheer',
    body: 'Грузинский алфавит создан в V веке нашей эры. Это один из немногих алфавитов мира, признанных ЮНЕСКО частью нематериального культурного наследия.',
    caption: '1 из 4 · «С чего всё началось»',
  },
  {
    kind: 'styles',
    label: 'სამი სახე',
    labelRu: 'Три лица алфавита',
    bombora: 'guide',
    body: 'Ты учишь მხედრული — именно им написаны все современные тексты.',
    styles: [
      { letters: 'ა ბ გ', name: 'მხედრული', desc: 'всадническое · стандарт', accent: 'navy' },
      { letters: 'Ⴀ Ⴁ Ⴂ', name: 'ასომთავრული', desc: 'заглавное · церковный декор', accent: 'neutral' },
      { letters: 'ⴀ ⴁ ⴂ', name: 'ნუსხური', desc: 'рукописное · XII–XIX вв.', accent: 'muted' },
    ],
  },
  {
    kind: 'uniqueness',
    label: 'Отдельный мир',
    labelRu: null,
    bombora: 'think',
    body: 'В мире около 40 активно используемых письменностей. Грузинская — среди немногих, у которых нет общего предка с другими алфавитами.',
    navyTile: {
      geo: 'ქართული',
      text: 'Грузинский — единственный официальный язык в регионе с полностью самобытной письменностью.',
    },
  },
  {
    kind: 'reveal',
    label: 'ძველი მეგობარი',
    labelRu: 'Старый знакомый',
    bombora: 'happy',
    headline: 'Ты уже знал её!',
    body: 'Эта буква встречала тебя при каждом открытии. Теперь ты знаешь: ქ — «кани», первая буква слова',
    reveal: { letter: 'ქ', word: 'ქართული', translation: 'грузинский язык' },
    stamp: 'ძველი მეგობარი',
  },
]

// ─── Shared sub-component ────────────────────────────────────────────────────

function KilimStripe() {
  return <div className="mn-kilim" />
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AlphabetHistoryScreen({ moduleId, navigate }: AlphabetHistoryScreenProps) {
  const [card, setCard] = useState(0)
  const [animClass, setAnimClass] = useState<string>('')
  const [showStamp, setShowStamp] = useState(false)

  // When card 4 appears, show stamp after 300ms
  useEffect(() => {
    if (card === 3) {
      const t = setTimeout(() => setShowStamp(true), 300)
      return () => clearTimeout(t)
    } else {
      setShowStamp(false)
    }
  }, [card])

  const goTo = (next: number, direction: 'right' | 'left') => {
    setAnimClass(direction === 'right' ? 'card-enter-right' : 'card-enter-left')
    setCard(next)
  }

  const goNext = () => {
    if (card < HISTORY_CARDS.length - 1) goTo(card + 1, 'right')
  }

  const goBack = () => {
    if (card > 0) goTo(card - 1, 'left')
  }

  const handleDone = () => {
    navigate({ kind: 'module', moduleId })
  }

  const current = HISTORY_CARDS[card]

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        onBack={() => navigate({ kind: 'module', moduleId })}
        title="История алфавита"
      />

      <div
        className="flex flex-col flex-1 px-5 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        {/* Card carousel — overflow-hidden clips slide animation */}
        <div className="relative overflow-hidden flex-1 flex flex-col" style={{ maxHeight: 520 }}>
          <div
            key={card}
            className={`jewel-tile flex flex-col flex-1 overflow-hidden ${animClass}`}
            onAnimationEnd={() => setAnimClass('')}
          >
            <CardContent current={current} showStamp={showStamp} />
          </div>
        </div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {HISTORY_CARDS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i === card
                  ? 'w-3 h-3 bg-gold'
                  : 'w-2 h-2 bg-jewelInk/20'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 px-0 pt-4">
          {/* Back button — hidden on card 0 */}
          <button
            className="jewel-btn jewel-btn-cream text-[14px] flex-1"
            style={{ minHeight: 52, opacity: card === 0 ? 0 : 1, pointerEvents: card === 0 ? 'none' : 'auto' }}
            onClick={goBack}
          >
            ← Назад
          </button>

          {/* Next / Done button */}
          {card < HISTORY_CARDS.length - 1 ? (
            <button
              className="jewel-btn jewel-btn-navy text-[14px] flex-1"
              style={{ minHeight: 52 }}
              onClick={goNext}
            >
              Дальше →
            </button>
          ) : (
            <button
              className="jewel-btn jewel-btn-navy text-[14px] flex-1"
              style={{ minHeight: 52 }}
              onClick={handleDone}
            >
              Готово ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Individual card renderers ───────────────────────────────────────────────

interface CardContentProps {
  current: HistoryCard
  showStamp: boolean
}

function CardContent({ current, showStamp }: CardContentProps) {
  if (current.kind === 'birth') {
    return (
      <div className="flex flex-col flex-1">
        <KilimStripe />
        <div className="flex flex-col items-center px-4 pt-4 pb-2 flex-1">
          <Mascot mood="cheer" size={64} />
          <div className="mt-3 text-center">
            <span className="font-sans text-[60px] font-extrabold text-navy leading-none">V</span>
            <div className="font-geo text-[18px] font-bold text-navy mt-0">საუკუნე</div>
            <div className="font-sans text-[11px] text-jewelInk/60">Пятый век</div>
          </div>
          <div className="h-px bg-gold/60 my-3 w-full" />
          <p className="font-sans text-[14px] text-jewelInk leading-relaxed text-center">
            {current.body}
          </p>
          <div className="mt-auto pt-3">
            <div className="font-sans text-[10px] text-jewelInk/40 text-center">{current.caption}</div>
          </div>
        </div>
        <KilimStripe />
      </div>
    )
  }

  if (current.kind === 'styles') {
    return (
      <div className="flex flex-col flex-1">
        <KilimStripe />
        <div className="flex flex-col items-center px-4 pt-4 pb-2 flex-1">
          <Mascot mood="guide" size={64} />
          <div className="mt-2 text-center">
            <div className="font-geo text-[22px] font-bold text-navy">{current.label}</div>
            <div className="font-sans text-[11px] text-jewelInk/60">{current.labelRu}</div>
          </div>
          <div className="h-px bg-gold/60 my-3 w-full" />

          {/* Styles table */}
          <div className="jewel-tile w-full overflow-hidden mx-0 p-0">
            {current.styles.map((s, i) => (
              <div
                key={s.name}
                className={`px-4 py-2.5 flex items-center gap-3 ${
                  i < current.styles.length - 1 ? 'border-b border-jewelInk/10' : ''
                } ${i === 0 ? 'bg-navy/5' : ''}`}
              >
                <span
                  className={`font-geo text-[18px] font-bold w-16 shrink-0 ${
                    s.accent === 'navy' ? 'text-navy' : s.accent === 'neutral' ? 'text-jewelInk' : 'text-jewelInk/50'
                  }`}
                >
                  {s.letters}
                </span>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`font-sans text-[11px] font-bold uppercase tracking-wide ${
                      s.accent === 'navy' ? 'text-navy' : s.accent === 'neutral' ? 'text-jewelInk' : 'text-jewelInk/50'
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="font-sans text-[10px] text-jewelInk/60">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="font-sans text-[13px] text-jewelInk leading-relaxed text-center mt-3">
            {current.body}
          </p>
        </div>
        <KilimStripe />
      </div>
    )
  }

  if (current.kind === 'uniqueness') {
    return (
      <div className="flex flex-col flex-1">
        <KilimStripe />
        <div className="flex flex-col items-center px-4 pt-4 pb-2 flex-1">
          <Mascot mood="think" size={64} />
          <div className="mt-2 flex items-center gap-2 justify-center">
            <span className="text-gold text-[16px]">✦</span>
            <span className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight text-center">
              {current.label}
            </span>
            <span className="text-gold text-[16px]">✦</span>
          </div>
          <div className="h-px bg-gold/60 my-3 w-full" />
          <p className="font-sans text-[14px] text-jewelInk leading-relaxed text-center">
            {current.body}
          </p>
          {/* Navy tile */}
          <div
            className="jewel-tile px-4 py-3 mt-3 w-full text-center"
            style={{ backgroundColor: '#1B5FB0' }}
          >
            <div className="font-geo text-[16px] font-bold text-cream">{current.navyTile.geo}</div>
            <div className="font-sans text-[12px] text-cream/90 mt-1 leading-snug">{current.navyTile.text}</div>
          </div>
        </div>
        <KilimStripe />
      </div>
    )
  }

  // Card 4 — reveal
  return (
    <div className="flex flex-col flex-1">
      <KilimStripe />
      <div className="flex flex-col items-center px-4 pt-4 pb-2 flex-1">
        <Mascot mood="happy" size={64} />
        <div className="mt-2 font-sans text-[22px] font-extrabold text-jewelInk text-center">
          {current.headline}
        </div>
        <div className="h-px bg-gold/60 my-3 w-full" />

        {/* Animated letter */}
        <div className="flex flex-col items-center">
          <span className="mn-loader-letter font-geo text-[80px] font-bold text-navy leading-none">
            {current.reveal.letter}
          </span>
          <div className="w-12 h-1 bg-gold rounded-full mx-auto mt-2 mb-4" />
        </div>

        <p className="font-sans text-[13px] text-jewelInk leading-relaxed text-center">
          {current.body}
        </p>

        {/* Mini tile */}
        <div className="jewel-tile px-4 py-3 mt-3 w-full text-center">
          <div className="font-geo text-[20px] font-bold text-jewelInk">{current.reveal.word}</div>
          <div className="font-sans text-[11px] text-jewelInk/60 mt-1">{current.reveal.translation}</div>
        </div>

        {/* Stamp — appears with delay */}
        {showStamp && (
          <div className="mt-4">
            <Stamp color="navy" tilt="left" animate>
              {current.stamp}
            </Stamp>
          </div>
        )}
      </div>
      <KilimStripe />
    </div>
  )
}
