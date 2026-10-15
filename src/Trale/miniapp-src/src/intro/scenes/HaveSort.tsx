import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { GameEnd, GameIntro, Meter, Person, Pill, RuleCard, Tip, INK, type Look } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  DECK_SIZE, GAME_MS, fallMs, fell, haveDeck, hintFor, isOver, send, sentence, startState, verbOf,
  type Card, type HaveMode, type HaveState, type Side
} from './HaveSort.logic'

/**
 * «Живое или вещь». Сверху падают карточки: грузинское слово и картинка. Внизу две корзины: слева მყავს
 * (живое — люди и звери), справа მაქვს (вещи). Нажми корзину (или смахни карточку влево/вправо), пока
 * карточка не упала. Поймал — на миг видна целая фраза «მე მყავს ძაღლი». Промах — карточка отскакивает
 * наверх с подсказкой. Чем дальше, тем быстрее; верные подряд дают комбо. 20 карточек или 45 секунд.
 */

// ── Картинки слов ────────────────────────────────────────────────────────────────────────────────

const look = (coat: string, extra: Partial<Look> = {}): Look => ({ coat, skin: '#F2C9A0', hair: '#5A3A22', ...extra })
const PEOPLE_LOOKS: Record<string, Look> = {
  мама: look('#E01A3C', { long: true, age: 'old' }),
  папа: look('#1B5FB0', { age: 'old' }),
  брат: look('#4E8A5B'),
  сестра: look('#C68F10', { long: true }),
  муж: look('#2F7F86', { hair: '#15100A' }),
  жена: look('#7A4E9A', { long: true, hair: '#9A6A3A' }),
  сын: look('#D4563B', { age: 'kid' }),
  дочь: look('#E01A3C', { age: 'kid', long: true }),
  друг: look('#3A2B1F', { bag: true }),
  ребёнок: look('#F5B820', { age: 'kid', hair: '#9A6A3A' })
}

const S = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function ThingIcon({ ru, size }: { ru: string; size: number }) {
  const body = (() => {
    switch (ru) {
      case 'собака': return <>
        <path d="M10 22 Q10 12 20 12 Q30 12 30 22 L30 28 Q30 34 20 34 Q10 34 10 28Z" fill="#C68A5E" {...S} />
        <path d="M10 15 Q4 16 6 27 Q10 26 11 20Z" fill="#5A3A22" {...S} /><path d="M30 15 Q36 16 34 27 Q30 26 29 20Z" fill="#5A3A22" {...S} />
        <circle cx="16" cy="21" r="1.6" fill={INK} /><circle cx="24" cy="21" r="1.6" fill={INK} />
        <ellipse cx="20" cy="27" rx="3" ry="2.2" fill={INK} /><path d="M20 29 v2 M18 32 Q20 33.5 22 32" {...S} fill="none" />
      </>
      case 'кошка': return <>
        <path d="M9 15 L11 5 L17 11 Q20 10 23 11 L29 5 L31 15 Q34 22 30 29 Q26 34 20 34 Q14 34 10 29 Q6 22 9 15Z" fill="#E8A13A" {...S} />
        <circle cx="15.5" cy="20" r="1.6" fill={INK} /><circle cx="24.5" cy="20" r="1.6" fill={INK} />
        <path d="M18.5 24 L20 25.5 L21.5 24Z" fill="#E01A3C" {...S} /><path d="M20 25.5 Q18 28 16 27 M20 25.5 Q22 28 24 27 M6 23 h7 M27 23 h7" fill="none" {...S} />
      </>
      case 'машина': return <>
        <path d="M5 26 L7 19 Q8 17 11 17 L14 11 Q15 9 18 9 L26 9 Q29 9 30 11 L33 17 Q36 17 36 20 L36 26Z" fill="#1B5FB0" {...S} />
        <path d="M16 12 L18 16.5 L28 16.5 L27 12Z" fill="#CFE3F5" {...S} />
        <circle cx="12" cy="27" r="4" fill="#3A2B1F" {...S} /><circle cx="29" cy="27" r="4" fill="#3A2B1F" {...S} />
      </>
      case 'книга': return <>
        <path d="M6 10 Q13 8 20 11 L20 33 Q13 30 6 32Z" fill="#E01A3C" {...S} /><path d="M34 10 Q27 8 20 11 L20 33 Q27 30 34 32Z" fill="#F7EAD0" {...S} />
        <path d="M24 15 Q28 14 31 15 M24 19 Q28 18 31 19 M24 23 Q28 22 31 23" fill="none" {...S} strokeWidth={1.2} />
      </>
      case 'дом': return <>
        <path d="M5 19 L20 7 L35 19Z" fill="#E01A3C" {...S} /><rect x="9" y="19" width="22" height="15" fill="#F7EAD0" {...S} />
        <rect x="17" y="25" width="6" height="9" fill="#5A3A22" {...S} /><rect x="11" y="22" width="4.5" height="4.5" fill="#CFE3F5" {...S} /><rect x="25" y="22" width="4.5" height="4.5" fill="#CFE3F5" {...S} />
      </>
      case 'хачапури': return <>
        <path d="M3 21 Q10 9 20 13 Q30 9 37 21 Q30 32 20 29 Q10 32 3 21Z" fill="#E8A13A" {...S} />
        <ellipse cx="20" cy="21" rx="9" ry="5" fill="#FFF3D6" {...S} /><circle cx="20" cy="21" r="3" fill="#F5B820" {...S} />
      </>
      case 'деньги': return <>
        <rect x="4" y="12" width="32" height="18" rx="2" fill="#9BC79F" {...S} /><circle cx="20" cy="21" r="5" fill="#D6E9D9" {...S} />
        <path d="M20 18 v6 M8 16 h4 M28 26 h4" fill="none" {...S} />
      </>
      case 'кофе': return <>
        <path d="M8 16 L30 16 L28 32 Q27 34 25 34 L13 34 Q11 34 10 32Z" fill="#F7EAD0" {...S} />
        <path d="M29 19 Q35 19 34 24 Q33 28 28 27" fill="none" {...S} /><ellipse cx="19" cy="17" rx="10" ry="2" fill="#5A3A22" {...S} />
        <path d="M15 12 Q13 9 15 6 M20 12 Q18 9 20 6 M25 12 Q23 9 25 6" fill="none" {...S} strokeWidth={1.2} />
      </>
      case 'чай': return <>
        <path d="M7 18 L31 18 Q31 32 19 32 Q7 32 7 18Z" fill="#F7EAD0" {...S} /><path d="M30 21 Q36 21 35 25 Q33 29 28 28" fill="none" {...S} />
        <ellipse cx="19" cy="19" rx="11" ry="2" fill="#C68F10" {...S} /><path d="M22 18 L24 8" {...S} /><rect x="22" y="5" width="5" height="5" fill="#E01A3C" {...S} />
        <path d="M5 34 h28" {...S} />
      </>
      default: return <circle cx="20" cy="20" r="12" fill="#D8CBB0" {...S} />
    }
  })()
  return <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>{body}</svg>
}

export function WordPicture({ ru, size = 48 }: { ru: string; size?: number }) {
  const p = PEOPLE_LOOKS[ru]
  if (p) return <Person look={p} height={size} />
  return <ThingIcon ru={ru} size={size} />
}

function BasketIcon({ alive }: { alive: boolean }) {
  return (
    <svg viewBox="0 0 40 28" width={40} height={28} aria-hidden>
      <path d="M4 10 h32 l-4 16 h-24Z" fill={alive ? '#D6E9D9' : '#F7E2B0'} {...S} />
      <path d="M12 10 Q20 -2 28 10" fill="none" {...S} /><path d="M12 14 l2 9 M20 14 v9 M28 14 l-2 9" fill="none" {...S} strokeWidth={1.2} />
    </svg>
  )
}

// ── Сцена ─────────────────────────────────────────────────────────────────────────────────────────

interface Toast { key: number; text: string; alive: boolean }

export default function HaveSort({ step, fraction, onExit, onDone, rng = Math.random, now = Date.now }: SceneProps<StepOf<'havesort'>>) {
  const mode: HaveMode = step.mode
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [run, setRun] = useState(0)
  const deck = useMemo(() => haveDeck(mode, rng), [mode, run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [hs, setHs] = useState<HaveState>(startState)
  const [startAt, setStartAt] = useState(0)
  const [cardAt, setCardAt] = useState(0)
  const [t, setT] = useState(0)
  const [hint, setHint] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [bounce, setBounce] = useState(0)
  const [flash, setFlash] = useState<Side | null>(null)
  const later = useLater()
  const cardEl = useRef<HTMLDivElement>(null)
  const swipe = useRef<number | null>(null)
  const c: Card | undefined = deck[hs.i]
  const elapsed = t - startAt
  const progress = c ? Math.min(1, Math.max(0, (t - cardAt) / fallMs(mode, hs.i))) : 0

  const start = () => {
    const n = now()
    setHs(startState()); setStartAt(n); setCardAt(n); setT(n); setHint(''); setToast(null); setPhase('play')
  }

  // Часы игры: только пока идёт игра; на размонтирование интервал снимается.
  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => setT(now()), 40)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Конец игры и карточки, упавшие мимо корзин.
  useEffect(() => {
    if (phase !== 'play') return
    if (isOver(hs, deck, elapsed)) { sound.win(); haptic('good'); setPhase('end'); return }
    if (c && progress >= 1) {
      haptic('soft'); sound.miss()
      setHint(`Улетела! ${hintFor(c)}`)
      setHs(fell(hs)); setCardAt(now())
    }
  }, [t, hs, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendTo = (side: Side) => {
    if (phase !== 'play' || !c) return
    const r = send(hs, c, side)
    setHs(r.state)
    setFlash(side); later(() => setFlash(null), 220)
    if (r.outcome === 'bounce') {
      haptic('bad'); sound.miss()
      setHint(hintFor(c))
      setBounce(b => b + 1)
      setCardAt(now())
      return
    }
    haptic(r.outcome === 'catch' ? 'good' : 'tap'); sound.snap(r.state.combo)
    if (r.points && cardEl.current) floater(`+${r.points}`, cardEl.current, r.state.combo >= 3 ? '#E01A3C' : '#1B5FB0')
    if (r.outcome === 'catch') setHint('')
    const key = Date.now() + Math.random()
    setToast({ key, text: sentence(c), alive: c.alive })
    later(() => setToast(x => (x?.key === key ? null : x)), 1100)
    setCardAt(now())
  }

  useEffect(() => {
    if (phase !== 'play') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') sendTo('alive'); if (e.key === 'ArrowRight') sendTo('thing') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const title = 'Живое или вещь'
  const ruleCard = (
    <RuleCard title="Два «у меня есть»">
      <b className="font-geo">მყავს</b> — кто-то живой: мама, брат, друг, ребёнок, собака, кошка. <b className="font-geo">მაქვს</b> — вещь: машина, книга, деньги, хачапури.
    </RuleCard>
  )

  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="havesort-scene">
          <GameIntro title={title}
            text={mode === 'people'
              ? 'Падают карточки. Живое (люди, звери) — в левую корзину მყავს, вещи — в правую მაქვს. Нажми корзину или смахни карточку.'
              : 'Теперь быстрее и хитрее: кто тут живой, а что — вещь? Слева მყავს, справа მაქვს. Верные подряд дают комбо.'}
            chips={[{ geo: 'მყავს', ru: 'кто-то живой' }, { geo: 'მაქვს', ru: 'вещь' }]}
            onStart={start} />
        </div>
      </GameFrame>
    )
  }

  if (phase === 'end') {
    const good = hs.right >= deck.length * 0.8
    return (
      <GameFrame title={title} eyebrow="итог" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="havesort-scene">
          <GameEnd title={good ? 'Ловко!' : 'Хорошая разминка'}
            text={`Очки: ${hs.score}. С первого раза: ${hs.right} из ${deck.length}. Лучшее комбо: ${hs.best}.`}
            rule={ruleCard} onNext={onDone} onAgain={() => { setRun(n => n + 1); setPhase('intro') }} />
        </div>
      </GameFrame>
    )
  }

  const hints = mode === 'people'
  return (
    <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="havesort-scene">
        <div className="flex items-center gap-2">
          <Pill testId="have-score">{hs.score}</Pill>
          <Meter value={1 - elapsed / GAME_MS} tone={elapsed > GAME_MS * 0.75 ? 'ruby' : 'gold'} label="время" />
          <Pill testId="have-count">{Math.min(hs.i + 1, deck.length)}/{DECK_SIZE}</Pill>
          {hs.combo >= 2 && <Pill testId="have-combo"><span key={hs.combo} className="inline-block zn-pop text-ruby">×{hs.combo}</span></Pill>}
        </div>

        <div className="relative flex-1 min-h-[160px] rounded-2xl border-[1.5px] border-dashed border-jewelInk-faint bg-cream-deep/50 overflow-hidden touch-none select-none"
          data-testid="have-track"
          onPointerDown={e => { swipe.current = e.clientX }}
          onPointerUp={e => {
            const x0 = swipe.current; swipe.current = null
            if (x0 === null) return
            const dx = e.clientX - x0
            if (dx < -40) sendTo('alive'); else if (dx > 40) sendTo('thing')
          }}>
          {c && (
            <div className="absolute left-1/2" style={{ top: `calc((100% - 112px) * ${progress})`, transform: 'translateX(-50%)' }}>
            <div key={`${hs.i}-${bounce}`} ref={cardEl} data-testid="have-card" data-alive={c.alive ? 'yes' : 'no'}
              className={`w-[132px] ab-short:w-[116px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-2 py-2 flex flex-col items-center ${bounce && hs.bounced ? 'zn-jump' : 'zn-pop'}`}
              style={{ boxShadow: '3px 3px 0 #15100A' }}>
              <WordPicture ru={c.ru} size={46} />
              <div className="font-geo font-extrabold text-[19px] leading-tight mt-1">{c.geo}</div>
              <div className="text-[11px] font-semibold text-jewelInk-hint">{cyr(c.geo)}</div>
            </div>
            </div>
          )}
          {toast && (
            <div key={toast.key} className={`zn-pop absolute bottom-2 left-2 right-2 rounded-xl border-[1.5px] border-jewelInk px-2 py-1 text-center ${toast.alive ? 'bg-[#D6E9D9]' : 'bg-gold-wash'}`} data-testid="have-toast">
              <div className="font-geo font-bold text-[16px] leading-tight">{toast.text}</div>
              <div className="text-[11px] font-semibold text-jewelInk-hint">{cyr(toast.text)}</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(['alive', 'thing'] as Side[]).map(side => (
            <button key={side} onClick={() => sendTo(side)} data-testid={`basket-${side}`}
              className={`min-h-[72px] ab-short:min-h-[60px] rounded-2xl border-[1.5px] border-jewelInk flex flex-col items-center justify-center px-2 py-1 transition-transform active:translate-x-[2px] active:translate-y-[2px]
                ${side === 'alive' ? 'bg-[#E4F0E6]' : 'bg-gold-wash'} ${flash === side ? 'scale-105' : ''}`}
              style={{ boxShadow: '3px 3px 0 #15100A' }}>
              <BasketIcon alive={side === 'alive'} />
              <span className="font-geo font-extrabold text-[17px] leading-tight">{verbOf(side)}</span>
              <span className="text-[11px] font-semibold text-jewelInk-hint">{hints ? (side === 'alive' ? 'живое: люди, звери' : 'вещи') : cyr(verbOf(side))}</span>
            </button>
          ))}
        </div>

        <Tip>{hint || (hints ? 'Живое — налево, вещи — направо. Можно смахнуть карточку.' : 'Осторожно, будут хитрые слова. Сначала подумай: оно живое?')}</Tip>
      </div>
    </GameFrame>
  )
}

