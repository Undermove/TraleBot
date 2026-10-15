import React, { useEffect, useRef, useState } from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import '../alphabet/games/alphabet.css'
import GameFrame from '../alphabet/games/GameFrame'
import LetterIntro from '../alphabet/intro/LetterIntro'
import Catch from '../alphabet/games/Catch'
import WordIntro from '../alphabet/words/WordIntro'
import { burst, haptic, sound, unlockAudio } from '../alphabet/games/fx'
import { shuffle } from '../alphabet/games/logic'
import { markWelcomeLetter } from '../alphabet/known'
import { lessonFlow, type StepKind } from '../analytics/lessonEvents'

/**
 * Знакомство с приложением для нового человека — первая минута, сразу игрой:
 * 1) Бомбора здоровается одной строкой; 2) стираешь пушок с персика — под ним ა, звучит «ატამი», перо показывает,
 * как она пишется, и ты обводишь сам (то же знакомство с буквой, что в уроках); 3) короткая волна «Поймай букву»;
 * 4) Бомбора дарит вторую букву დ — и ты читаешь первое слово და («и») в сцене «Новое слово»;
 * 5) три карточки «что тут есть» (Бомбора идёт по дорожке); 6) «Ты уже знаешь 1 букву и 1 слово» → урок 1 алфавита,
 * где ა уже отмечена как знакомая. Всё можно пропустить. Урок «welcome» засчитывается (первый опыт, App) в момент
 * праздника — и при пропуске, чтобы знакомство не показывалось снова. Каждый шаг пишется в LessonEvents
 * (модуль «onboarding»), чтобы видеть, где люди уходят.
 */

interface Props {
  /** Знакомство закончено (или пропущено): App засчитывает урок «welcome» — первый опыт, хаб открывается. */
  onComplete: () => void
  /** Главное действие праздника: первый урок алфавита. */
  onNext: () => void
  /** Тихий выход: все уроки. */
  onBrowse: () => void
  /** Только для стенда ?alphabet-lab=welcome: открыть сразу этот шаг (праздник — как после всего знакомства). */
  start?: Step
}

export type Step = 'hello' | 'letter' | 'catch' | 'gift' | 'word' | 'tour' | 'win'

export const WELCOME_MODULE = 'onboarding'
const ORDER: Step[] = ['hello', 'letter', 'catch', 'gift', 'word', 'tour', 'win']
/** Шаг в аналитике: подарок буквы и чтение слова — один шаг «первое слово». */
const TRACK: Record<Step, [number, StepKind]> = {
  hello: [0, 'greeting'], letter: [1, 'letter-intro'], catch: [2, 'catch'], gift: [3, 'first-word'],
  word: [3, 'first-word'], tour: [4, 'tour'], win: [5, 'celebration']
}

const FIRST_LETTER = 'ა'
const GIFT_LETTER = 'დ'
/** Первое слово — из базового словаря (урок слов 12): და — «и». */
const FIRST_WORD = { geo: 'და', ru: 'и', lesson: 1 }

export default function Welcome({ onComplete, onNext, onBrowse, start = 'hello' }: Props) {
  const [step, setStep] = useState<Step>(start)
  const learned = useRef({ letter: start === 'win', word: start === 'win' })
  const completed = useRef(false)
  const fraction = ORDER.indexOf(step) / (ORDER.length - 1)

  useEffect(() => { lessonFlow.open(WELCOME_MODULE, 1, 'greeting') }, [])
  useEffect(() => {
    if (step === 'hello' || step === 'word') return
    const [n, kind] = TRACK[step]
    lessonFlow.step(WELCOME_MODULE, 1, n, kind)
    if (step === 'win') {
      lessonFlow.end('lesson_complete', (learned.current.letter ? 1 : 0) + (learned.current.word ? 1 : 0))
      if (!completed.current) { completed.current = true; onComplete() }
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: Step) => { lessonFlow.done(); setStep(next) }
  /** «Пропустить» / «назад» в любом шаге — сразу к финалу. */
  const skipAll = () => { haptic('tap'); lessonFlow.skip(); setStep('win') }

  switch (step) {
    case 'hello':
      return <Hello onStart={() => { void unlockAudio(); haptic('tap'); go('letter') }} onSkip={skipAll} />
    case 'letter':
      return (
        <LetterIntro letter={FIRST_LETTER} index={0} count={1} eyebrow="первая буква" fraction={fraction} onExit={skipAll}
          onDone={() => { learned.current.letter = true; markWelcomeLetter(FIRST_LETTER); go('catch') }} />
      )
    case 'catch':
      return (
        <Catch letters={[FIRST_LETTER]} lesson={1} fraction={fraction} onExit={skipAll} onDone={() => go('gift')}
          rounds={[{ target: FIRST_LETTER, bubbles: shuffle([FIRST_LETTER, FIRST_LETTER, FIRST_LETTER, GIFT_LETTER, 'რ', 'ო', 'ბ', 'მ'], Math.random) }]} />
      )
    case 'gift':
      return <Gift fraction={fraction} onExit={skipAll} onNext={() => { haptic('tap'); setStep('word') }} />
    case 'word':
      return (
        <WordIntro featured={[FIRST_WORD]} startCount={0} collect={false} title="Твоё первое слово" eyebrow="ა + დ" fraction={fraction}
          onExit={skipAll} onDone={() => { learned.current.word = true; go('tour') }} />
      )
    case 'tour':
      return <Tour fraction={fraction} onExit={skipAll} onDone={() => go('win')} />
    case 'win':
      return <Win learned={learned.current} onNext={onNext} onBrowse={onBrowse} />
  }
}

function Screen({ children, testId = 'welcome-screen' }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="ab-screen flex flex-col bg-cream" data-testid={testId}>
      <div className="shrink-0" style={{ paddingTop: 'var(--safe-t)' }}><div className="mn-kilim" /></div>
      <div className="flex-1 min-h-0 w-full max-w-[420px] mx-auto flex flex-col items-center px-6 pt-6 ab-short:pt-3 text-center"
        style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
        {children}
      </div>
    </div>
  )
}

function Hello({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <Screen>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5">
        <div className="ab-drip"><Mascot mood="cheer" size={150} /></div>
        <h1 className="text-[26px] ab-short:text-[22px] font-extrabold leading-tight max-w-[300px]" data-testid="welcome-hello">
          Привет! За минуту прочитаешь первое грузинское слово
        </h1>
      </div>
      <div className="shrink-0 w-full flex flex-col gap-1">
        <Button variant="green" onClick={onStart}>поехали →</Button>
        <button onClick={onSkip} className="h-11 text-[14px] font-bold text-jewelInk-hint underline underline-offset-4" data-testid="welcome-skip">пропустить знакомство</button>
      </div>
    </Screen>
  )
}

/** Бомбора дарит вторую букву: карточка переворачивается — დ, звук «д». */
function Gift({ fraction, onExit, onNext }: { fraction: number; onExit: () => void; onNext: () => void }) {
  const [open, setOpen] = useState(false)
  const card = useRef<HTMLButtonElement>(null)
  const flip = () => {
    if (open) return
    haptic('good'); sound.snap(6); setOpen(true)
    setTimeout(() => burst(card.current, 'small'), 200)
  }
  return (
    <GameFrame title="Подарок от Бомборы" eyebrow="твоё первое слово" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col items-center gap-4 text-center" data-testid="welcome-gift">
        <div className="text-[16px] font-bold text-jewelInk-mid leading-snug max-w-[300px]">
          Для первого слова не хватает одной буквы. Держи — открой карточку
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <button ref={card} onClick={flip} aria-label="Открыть карточку" data-testid="welcome-gift-card"
            className="ab-flip w-[150px] h-[200px] ab-short:w-[120px] ab-short:h-[160px]" data-flipped={open ? 'yes' : 'no'}>
            <div className="ab-flip-inner">
              <div className="ab-flip-face rounded-2xl border-[1.5px] border-jewelInk flex items-center justify-center ab-pulse" style={{ background: '#1B5FB0', boxShadow: '4px 4px 0 #15100A' }}>
                <GiftIcon />
              </div>
              <div className="ab-flip-face ab-flip-back rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex flex-col items-center justify-center gap-1" style={{ boxShadow: '4px 4px 0 #15100A' }}>
                <span className="font-geo text-[84px] ab-short:text-[64px] font-extrabold text-navy leading-none">{GIFT_LETTER}</span>
                <span className="text-[18px] font-extrabold">звук «д»</span>
              </div>
            </div>
          </button>
        </div>
        <div className="shrink-0 w-full max-w-[340px] min-h-[56px]">
          {open
            ? <div className="ab-drip"><Button onClick={onNext}>читать слово →</Button></div>
            : <div className="text-[13px] font-bold text-jewelInk-hint pt-3">Нажми на карточку</div>}
        </div>
      </div>
    </GameFrame>
  )
}

const TOUR: { title: string; line: string; icon: React.ReactNode }[] = [
  { title: 'Алфавит', line: 'Все 33 буквы — по три за урок, в играх. Ты уже начал', icon: <LetterArt /> },
  { title: 'Слова', line: 'Напиши боту любое слово — он переведёт и сложит его в «Словарь»', icon: <WordsArt /> },
  { title: 'Разговоры', line: 'Дальше — фразы, глаголы и живые диалоги', icon: <TalkArt /> }
]

/** Три карточки «что тут есть»: свайп или кнопка; Бомбора шагает по дорожке к следующей остановке. */
function Tour({ fraction, onExit, onDone }: { fraction: number; onExit: () => void; onDone: () => void }) {
  const [i, setI] = useState(0)
  const start = useRef<number | null>(null)
  const next = () => {
    haptic('tap'); sound.tick(i)
    if (i + 1 >= TOUR.length) onDone(); else setI(i + 1)
  }
  const back = () => { if (i > 0) { haptic('tap'); setI(i - 1) } }
  const card = TOUR[i]
  return (
    <GameFrame title="Что тут есть" eyebrow={`${i + 1} из ${TOUR.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col items-center gap-4 text-center" data-testid="welcome-tour" data-card={i}
        onPointerDown={e => { start.current = e.clientX }}
        onPointerUp={e => {
          const dx = start.current == null ? 0 : e.clientX - start.current
          start.current = null
          if (dx < -50) next(); else if (dx > 50) back()
        }}
        style={{ touchAction: 'pan-y' }}>
        {/* Дорожка с тремя остановками; Бомбора стоит у текущей. */}
        <div className="relative w-full max-w-[320px] h-[86px] ab-short:h-[70px] shrink-0" aria-hidden="true">
          <svg className="absolute inset-x-0 bottom-2 w-full" height="20" viewBox="0 0 320 20" preserveAspectRatio="none">
            <path d="M30 10 H290" stroke="#15100A" strokeWidth="2" strokeDasharray="6 6" />
            {[30, 160, 290].map((x, k) => (
              <circle key={k} cx={x} cy="10" r="8" fill={k <= i ? '#F5B820' : '#FDFAEF'} stroke="#15100A" strokeWidth="2" />
            ))}
          </svg>
          <div className="absolute bottom-5 transition-[left] duration-500 ease-out" style={{ left: `calc(${[9.4, 50, 90.6][i]}% - 28px)` }}>
            <Mascot mood="guide" size={56} />
          </div>
        </div>
        <div key={i} className="flex-1 min-h-0 w-full max-w-[320px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex flex-col items-center justify-center gap-3 px-5 py-4 ab-drip"
          style={{ boxShadow: '4px 4px 0 #15100A' }} data-testid="welcome-tour-card">
          <div className="shrink min-h-0">{card.icon}</div>
          <div className="text-[24px] font-extrabold leading-tight">{card.title}</div>
          <div className="text-[16px] font-bold text-jewelInk-mid leading-snug">{card.line}</div>
        </div>
        <div className="shrink-0 w-full max-w-[340px]">
          <Button onClick={next}>{i + 1 >= TOUR.length ? 'понятно →' : 'дальше →'}</Button>
        </div>
      </div>
    </GameFrame>
  )
}

function Win({ learned, onNext, onBrowse }: { learned: { letter: boolean; word: boolean }; onNext: () => void; onBrowse: () => void }) {
  const both = learned.letter && learned.word
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!both) return
    haptic('good'); sound.win()
    const t = setTimeout(() => burst(box.current, 'big'), 250)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
        <Mascot mood="cheer" size={110} />
        <div className="mn-eyebrow text-ruby">{both ? 'первая победа' : 'начнём'}</div>
        <h1 className="text-[26px] ab-short:text-[22px] font-extrabold leading-tight max-w-[320px]" data-testid="welcome-win">
          {both ? 'Ты уже знаешь 1\u00a0букву и 1\u00a0слово' : learned.letter ? 'Ты уже знаешь первую букву' : 'Начнём с алфавита — по три буквы за урок'}
        </h1>
        {learned.letter && (
          <div ref={box} className="flex gap-3 mt-1" data-testid="welcome-learned">
            <Tile geo={FIRST_LETTER} ru="звук «а»" />
            {learned.word && <Tile geo={FIRST_WORD.geo} ru={`«да» — ${FIRST_WORD.ru}`} />}
          </div>
        )}
      </div>
      <div className="shrink-0 w-full flex flex-col items-center gap-1 pt-4" data-testid="welcome-next-lesson">
        <Button variant="green" onClick={onNext}>продолжить алфавит →</Button>
        <button onClick={onBrowse} data-testid="welcome-browse"
          className="font-sans text-[14px] font-semibold text-jewelInk-mid underline underline-offset-4 px-4" style={{ minHeight: '44px' }}>
          посмотреть все уроки
        </button>
      </div>
    </Screen>
  )
}

function Tile({ geo, ru }: { geo: string; ru: string }) {
  return (
    <div className="w-[118px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-2 py-3 flex flex-col items-center gap-1" style={{ boxShadow: '3px 3px 0 #15100A' }}>
      <span className="font-geo text-[40px] font-extrabold text-navy leading-none">{geo}</span>
      <span className="text-[13px] font-bold text-jewelInk-mid leading-tight">{ru}</span>
    </div>
  )
}

const INK = '#15100A'
function GiftIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <rect x="12" y="30" width="48" height="32" rx="4" fill="#F5B820" stroke={INK} strokeWidth="2.5" />
      <rect x="8" y="22" width="56" height="12" rx="3" fill="#FDFAEF" stroke={INK} strokeWidth="2.5" />
      <path d="M36 22 V62" stroke={INK} strokeWidth="2.5" />
      <path d="M36 22 C28 8 16 14 24 22 M36 22 C44 8 56 14 48 22" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}
function LetterArt() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
      {[0, 1, 2].map(k => (
        <rect key={k} x={8 + k * 28} y={14 + (k === 1 ? -6 : 0)} width="24" height="34" rx="5" fill={k === 0 ? '#FDFAEF' : '#1B5FB0'} stroke={INK} strokeWidth="2" transform={`rotate(${(k - 1) * 6} ${20 + k * 28} 31)`} />
      ))}
      <text x="20" y="40" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1B5FB0" fontFamily="'Noto Sans Georgian', sans-serif">ა</text>
      <path d="M14 66 H82" stroke={INK} strokeWidth="2" strokeDasharray="4 5" />
    </svg>
  )
}
function WordsArt() {
  return (
    <svg width="110" height="80" viewBox="0 0 110 80" fill="none">
      <path d="M6 10 h48 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-30 l-10 9 v-9 h-8 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6z" fill="#FDFAEF" stroke={INK} strokeWidth="2" />
      <path d="M16 22 h32 M16 30 h22" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M64 46 l10 -6" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <rect x="70" y="30" width="34" height="44" rx="4" fill="#F5B820" stroke={INK} strokeWidth="2" />
      <path d="M78 30 V74" stroke={INK} strokeWidth="2" />
      <path d="M84 42 h14 M84 50 h10" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function TalkArt() {
  return (
    <svg width="110" height="80" viewBox="0 0 110 80" fill="none">
      <rect x="6" y="8" width="58" height="30" rx="12" fill="#FDFAEF" stroke={INK} strokeWidth="2" />
      <path d="M18 38 l-4 10 l12 -10" fill="#FDFAEF" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x="44" y="40" width="60" height="30" rx="12" fill="#1B5FB0" stroke={INK} strokeWidth="2" />
      <path d="M92 70 l4 8 l-12 -8" fill="#1B5FB0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="24" cy="23" r="3" fill={INK} /><circle cx="35" cy="23" r="3" fill={INK} /><circle cx="46" cy="23" r="3" fill={INK} />
      <path d="M58 55 h32" stroke="#FDFAEF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
