import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { phrase } from '../story'
import { GameEnd, GameIntro, NewWord, RuleCard, TimeIcon, TimeLine, TimeSkip } from '../ui'
import { hush, speak } from '../voice'
import type { SceneProps, StepOf } from './types'
import { HINTS_OFF_AFTER, ITEMS, PLAN_LABELS, judge, plan, replies, skipText, type Item, type Step } from './Bakery.logic'
import { PART_RU, type Part, type Who } from './Walk.logic'
import Passerby, { type Face } from './walk/Passerby'
import { SpeechBubble } from './Walk'

/**
 * «Пекарня» — пекарня у дома, за шоти каждый день. Пекарша здоровается или ждёт, что начнёшь ты,
 * спрашивает, как дела (или ты спрашиваешь её); ты показываешь на витрине, что берёшь (პური или
 * ხაჭაპური), и добавляешь გთხოვთ; пекарша достаёт из тоне — ты забираешь и прощаешься.
 * Три визита: утро, день, вечер — время видно в окне. Перед каждым — карточка «визит N из 3»: какой день
 * и что ты уходил домой. Всё по шагам, голоса не накладываются.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

const BAKER: Who = { ru: 'Пекарша', kind: 'woman', coat: '#C2553A', skin: '#E0AC7E', hair: '#5A3A22', extra: 'baker', voice: 'f' }

const WINDOW_SKY: Record<Part, [string, string]> = {
  morning: ['#F4A99A', '#FDE0BE'], day: ['#6FA8DE', '#D7EAF7'], evening: ['#3B2F66', '#C26C8E']
}

type Turn = 'them' | 'you' | 'speaking' | 'react' | 'bread' | 'idle'

export default function Bakery({ lesson, onExit, onDone, fraction, rng = Math.random }: SceneProps<StepOf<'bakery'>>) {
  const visits = useMemo(() => plan(lesson.id, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const panel = replies(lesson.id)
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [vi, setVi] = useState(0)
  const [si, setSi] = useState(0)
  const [turn, setTurn] = useState<Turn>('idle')
  const [their, setTheir] = useState<string | undefined>()
  const [mine, setMine] = useState<string | undefined>()
  const [talking, setTalking] = useState(false)
  const [face, setFace] = useState<Face>('smile')
  const [bad, setBad] = useState<string | undefined>()
  const [cue, setCue] = useState('')
  const [bread, setBread] = useState<'oven' | 'counter' | 'bag'>('oven')
  const [right, setRight] = useState(0)
  const [misses, setMisses] = useState(0)
  const [word, setWord] = useState<string | undefined>()
  // Карточка перед визитом: пока она открыта, пекарша ждёт.
  const [door, setDoor] = useState(true)
  const shown = useRef(new Set<string>())
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])

  const v = visits[Math.min(vi, visits.length - 1)]
  const hints = right < HINTS_OFF_AFTER
  const timeline = visits.map((x, i) => ({ part: x.part, label: PLAN_LABELS[i] }))

  const theySay = async (id: string) => {
    setTheir(id); setTalking(true)
    await speak(id, 'f')
    if (alive.current) setTalking(false)
  }

  const open = async (vIdx: number, sIdx: number) => {
    const s: Step = visits[vIdx].steps[sIdx]
    setSi(sIdx); setMine(undefined); setBad(undefined); setFace('smile'); setCue(s.cue)
    // Слово витрины или «пожалуйста» нужно впервые — карточка «новое слово».
    const fresh = (s.order || s.want === 'gtkhovt') && !shown.current.has(s.want)
    if (fresh) shown.current.add(s.want)
    setWord(fresh ? s.want : undefined)
    if (s.line) {
      setTurn('them')
      await theySay(s.line)
      if (!alive.current) return
    } else setTheir(undefined)
    setTurn('you')
  }

  // Новый визит: дверь звенит, пекарша поднимает голову.
  useEffect(() => {
    if (phase !== 'play') return
    setBread('oven'); setTheir(undefined); setMine(undefined); setTurn('idle'); setCue('')
    if (door) return
    sound.pop(2); haptic('soft')
    const id = window.setTimeout(() => { if (alive.current) void open(vi, 0) }, 700)
    return () => window.clearTimeout(id)
  }, [phase, vi, door]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (id: string) => {
    if (turn !== 'you') return
    const s = v.steps[si]
    setTurn('speaking'); setMine(id); setBad(undefined); setWord(undefined)
    await speak(id, 'hero')
    if (!alive.current) return
    const res = judge(lesson.id, v, s, id)
    if (res.res === 'miss') {
      haptic('bad'); sound.miss(); setMisses(m => m + 1)
      setFace('huh'); setBad(id); setCue(res.hint); setMine(undefined); setTurn('you')
      return
    }
    haptic('good'); sound.pop(3); setRight(r => r + 1)
    if (res.hint) setCue(res.hint)
    setFace('smile'); setTurn('react')
    if (s.react) await theySay(s.react)
    if (!alive.current) return
    if (s.bread) {
      // Шоти из тоне — на прилавок; забери его.
      setTurn('bread'); setBread('counter'); sound.pop(5)
      setCue(v.item === 'khachapuri' ? 'Пекарша достала из тоне горячий хачапури. Забери его.' : 'Пекарша достала из тоне горячий шоти. Забери его.')
      return
    }
    next()
  }

  // Один шаг — один переход дальше, сколько бы раз ни позвали.
  const passed = useRef('')
  const next = () => {
    const key = `${vi}-${si}`
    if (passed.current === key) return
    passed.current = key
    if (si + 1 < v.steps.length) { void open(vi, si + 1); return }
    if (vi + 1 < visits.length) { setTurn('idle'); window.setTimeout(() => { if (alive.current) { setDoor(true); setVi(x => x + 1) } }, 900); return }
    sound.win(); window.setTimeout(() => alive.current && setPhase('end'), 900)
  }

  const taking = useRef(false)
  const takeBread = (el: HTMLElement) => {
    // Двойное касание не должно забрать хлеб дважды и перескочить визит.
    if (turn !== 'bread' || taking.current) return
    taking.current = true
    haptic('good'); sound.snap(4); burst(el, 'small')
    setBread('bag')
    window.setTimeout(() => { taking.current = false; if (alive.current) next() }, 650)
  }

  const start = () => { setVi(0); setRight(0); setMisses(0); shown.current.clear(); setDoor(true); setPhase('play') }

  const title = 'Пекарня у дома'
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="bakery-scene">
          <GameIntro title={title} text="Ты зайдёшь в пекарню у дома три раза — в разные дни и в разное время. Смотри в окно: здороваться утром, днём и вечером нужно по-разному. Каждый раз поговори с пекаршей, закажи на витрине, забери хлеб и попрощайся." onStart={start} hero
            plan={<TimeLine steps={timeline} />}
            chips={['rogor', 'kargad_madloba'].map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <GameEnd title="Три визита — хлеба на неделю!" text={misses === 0 ? 'Ни одной запинки — пекарша оставит тебе самый румяный шоти.' : 'Пекарша к тебе привыкла — и ты к ней тоже.'}
          rule={<RuleCard title="Ты заметил"><G>როგორ ხარ?</G> — как дела? В ответ: <G>კარგად, მადლობა</G> — хорошо, спасибо. Спросить можно и самому.</RuleCard>}
          onNext={onDone} onAgain={start} />
      </GameFrame>
    )
  }

  return (
    <GameFrame title={title} eyebrow={`${v.day} · ${PART_RU[v.part]}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="bakery-scene">
        <div className="relative flex-1 min-h-[260px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="bakery-room">
          <Room part={v.part} />
          {/* Пекарша за прилавком. */}
          <motion.div className="absolute left-[50%] bottom-[30%] -translate-x-1/2 z-10" key={vi}
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
            <svg width="120" height="190" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
              <Passerby who={BAKER} phase={0} stride={0} face={face} talking={talking} wave={turn === 'them' && si === 0 && !!v.steps[0].line} />
            </svg>
          </motion.div>
          <Counter />
          <Showcase active={turn === 'you' && !!v.steps[si].order} bad={bad} onPick={(id, el) => { haptic('tap'); void answer(id); if (id === v.steps[si].want) burst(el, 'small') }} />
          {/* Новое слово — над витриной. */}
          <AnimatePresence mode="wait">
            {word && (
              <motion.div key={word} className="absolute z-30 left-[3%] top-[30%]" initial={{ opacity: 0, y: 16, rotate: -5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 360, damping: 20 }}>
                <NewWord word={phrase(word)} testId="bakery-new-word" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Шоти: в тоне → на прилавке → в сумке. */}
          <AnimatePresence>
            {bread !== 'bag' && (
              <motion.button
                key={`bread-${vi}`}
                data-testid="bakery-bread"
                disabled={bread !== 'counter'}
                onClick={e => takeBread(e.currentTarget)}
                className="absolute z-20 -translate-x-1/2"
                initial={false}
                animate={bread === 'oven' ? { left: '17%', bottom: '52%', scale: 0.55, rotate: -20, opacity: 0.0 } : { left: '50%', bottom: '24%', scale: 1, rotate: -4, opacity: 1 }}
                exit={{ left: '86%', bottom: '4%', scale: 0.5, rotate: 30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 140, damping: 16 }}
                whileTap={{ scale: 0.92 }}
                aria-label="Забрать хлеб"
              >
                {v.item === 'khachapuri' ? <Khachapuri /> : <Shoti />}
                {bread === 'counter' && <motion.span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-extrabold text-cream bg-jewelInk/70 rounded-full px-2 whitespace-nowrap"
                  animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>нажми</motion.span>}
              </motion.button>
            )}
          </AnimatePresence>
          <Bag full={bread === 'bag'} />

          <AnimatePresence>
            {their && (
              <div key={`${vi}-${si}-${their}`} className="absolute z-30 left-1/2 top-[6%] -translate-x-1/2">
                <motion.div data-testid="bakery-their" style={{ transformOrigin: '50% 100%' }}
                  initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
                  <SpeechBubble id={their} hint={hints} tail="down" />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {mine && (
              <div key={`m-${vi}-${si}-${mine}`} className="absolute z-30 bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <motion.div data-testid="bakery-mine" initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                  <SpeechBubble id={mine} hint={hints} mine />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {/* Какой визит и когда. */}
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2.5 py-0.5 text-[12px] font-extrabold" data-testid="bakery-visit">
            <TimeIcon part={v.part} /> визит {vi + 1} из {visits.length}
          </div>
          {door && (() => {
            const t = skipText(vi, v)
            return <TimeSkip {...t} steps={timeline} current={vi} go="Зайти в пекарню" onGo={() => setDoor(false)} />
          })()}
        </div>

        <div className="shrink-0 min-h-[40px] text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite" data-testid="bakery-cue">{cue}</div>

        <div className="shrink-0 grid grid-cols-3 gap-2" data-testid="bakery-replies" data-want={turn === 'you' ? v.steps[si].want : undefined}>
          {panel.map(id => {
            const ready = turn === 'you'
            return (
              <motion.button key={id} data-testid={`bakery-reply-${id}`} disabled={!ready} onClick={() => { haptic('tap'); void answer(id) }}
                className="min-h-[54px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-1.5 py-1 text-center"
                style={{ boxShadow: '3px 3px 0 #15100A' }}
                animate={{ opacity: ready ? 1 : 0.45, x: bad === id ? [0, -6, 6, -4, 4, 0] : 0, backgroundColor: bad === id ? '#F7DCDD' : '#FDFAEF' }}
                whileTap={ready ? { scale: 0.95, y: 2 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                <span className="block font-geo font-bold leading-tight" style={{ fontSize: phrase(id).geo.length > 12 ? 12.5 : 14.5 }}>{phrase(id).geo}</span>
                <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{hints ? phrase(id).ru : cyr(phrase(id).geo)}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </GameFrame>
  )
}

/** Витрина на прилавке: хлеб и хачапури, под каждым — подпись по-грузински. Нажми — закажешь. */
function Showcase({ active, bad, onPick }: { active: boolean; bad?: string; onPick: (id: Item, el: HTMLElement) => void }) {
  return (
    <div className="absolute z-[18] left-[6%] bottom-[3%] flex gap-2" data-testid="bakery-showcase">
      {ITEMS.map(id => {
        const p = phrase(id)
        return (
          <motion.button key={id} type="button" data-testid={`bakery-reply-${id}`} disabled={!active}
            onClick={e => onPick(id, e.currentTarget)}
            className="flex flex-col items-center rounded-xl border-[1.5px] border-jewelInk bg-cream-tile/95 px-1.5 pt-1 pb-0.5"
            style={{ boxShadow: active ? '3px 3px 0 #15100A' : '1px 1px 0 #15100A' }}
            animate={{ y: active ? [0, -4, 0] : 0, x: bad === id ? [0, -5, 5, -3, 3, 0] : 0 }}
            transition={active && bad !== id ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : { duration: 0.35 }}
            whileTap={active ? { scale: 0.92 } : undefined}>
            <span className="block" style={{ transform: 'scale(0.5)', margin: '-12px -26px -10px' }}>{id === 'khachapuri' ? <Khachapuri /> : <Shoti />}</span>
            <span className="font-geo text-[12px] font-bold leading-tight">{p.geo}</span>
            <span className="text-[9px] font-semibold text-jewelInk-hint leading-none mb-0.5">{cyr(p.geo)}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

/** Хачапури по-аджарски: лодочка с сыром и желтком. */
function Khachapuri() {
  return (
    <svg width="110" height="46" viewBox="0 0 110 46" aria-hidden>
      <path d="M2 24 Q26 2 55 10 Q84 2 108 24 Q84 44 55 38 Q26 44 2 24 Z" fill="#D9963F" stroke="#15100A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M20 24 Q55 8 90 24 Q55 36 20 24 Z" fill="#FBE7A6" stroke="#15100A" strokeWidth="1.6" />
      <ellipse cx="55" cy="23" rx="8" ry="6" fill="#F5B820" stroke="#15100A" strokeWidth="1.4" />
      <ellipse cx="53" cy="21" rx="2.5" ry="1.6" fill="#FFF4D6" />
    </svg>
  )
}

function Shoti() {
  // Шоти — грузинский хлеб-лодочка из тоне.
  return (
    <svg width="110" height="46" viewBox="0 0 110 46" aria-hidden>
      <path d="M4 26 Q30 4 55 6 Q80 4 106 26 Q80 42 55 40 Q30 42 4 26 Z" fill="#E0A55A" stroke="#15100A" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M18 24 Q55 10 92 24" fill="none" stroke="#B5793F" strokeWidth="2.4" strokeLinecap="round" />
      {[30, 45, 60, 75].map(x => <path key={x} d={`M${x} 18 l4 10`} stroke="#B5793F" strokeWidth="1.6" strokeLinecap="round" />)}
      <path d="M22 30 Q55 36 88 30" fill="none" stroke="#F3C98A" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

function Bag({ full }: { full: boolean }) {
  return (
    <motion.div className="absolute right-[4%] bottom-[3%] z-20" data-testid="bakery-bag" animate={{ scale: full ? [1, 1.12, 1] : 1, rotate: full ? [0, -4, 0] : 0 }} transition={{ duration: 0.4 }}>
      <svg width="58" height="62" viewBox="0 0 58 62" aria-hidden>
        <path d="M18 18 Q18 4 29 4 Q40 4 40 18" fill="none" stroke="#15100A" strokeWidth="2.4" />
        {full && <path d="M10 22 Q22 2 36 6 Q50 10 50 22" fill="#E0A55A" stroke="#15100A" strokeWidth="2" />}
        <path d="M6 18 H52 L48 58 H10 Z" fill="#E8D2AE" stroke="#15100A" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M14 30 H44" stroke="#15100A" strokeWidth="1.4" opacity="0.4" />
      </svg>
    </motion.div>
  )
}

/** Пекарня: кирпичная стена, тоне с огнём, стеллаж с шоти, мешки муки, окно с небом по времени суток. */
function Room({ part }: { part: Part }) {
  const INK = '#15100A'
  const [top, low] = WINDOW_SKY[part]
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <defs>
        <linearGradient id="bk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={low} /></linearGradient>
        <radialGradient id="bk-fire"><stop offset="0" stopColor="#FFE08A" /><stop offset="0.6" stopColor="#F28C38" /><stop offset="1" stopColor="#7A2E1E" /></radialGradient>
      </defs>
      {/* Стена: штукатурка, снизу кирпич. */}
      <rect width="360" height="300" fill="#F1DFC2" />
      <rect y="150" width="360" height="150" fill="#D99A6C" />
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 10 }, (_, c) => (
        <rect key={`${r}-${c}`} x={c * 38 - (r % 2) * 19} y={152 + r * 16} width="36" height="14" rx="2" fill="#CF8A5C" stroke={INK} strokeWidth="0.6" opacity="0.7" />
      )))}
      {/* Окно с улицей. */}
      <g>
        <rect x="262" y="24" width="80" height="96" rx="6" fill="url(#bk-sky)" stroke={INK} strokeWidth="2.2" />
        <path d="M302 24 V120 M262 72 H342" stroke="#FDFAEF" strokeWidth="4" />
        <path d="M268 120 v-30 h16 v30 M310 120 v-40 h22 v40" fill="#D9CBE3" stroke={INK} strokeWidth="1" opacity="0.7" />
        {part === 'evening' && <circle cx="330" cy="40" r="5" fill="#FFF4D6" />}
        {part !== 'evening' && <circle cx={part === 'morning' ? 276 : 320} cy={part === 'morning' ? 64 : 40} r="7" fill="#F5B820" stroke={INK} strokeWidth="1" />}
      </g>
      {/* Тоне — глиняная печь с огнём; на стенках внутри — шоти. */}
      <g>
        <path d="M8 176 Q8 96 66 96 Q124 96 124 176 Z" fill="#C2553A" stroke={INK} strokeWidth="2.4" />
        <path d="M22 176 Q22 112 66 112 Q110 112 110 176" fill="none" stroke={INK} strokeWidth="1" opacity="0.3" />
        <ellipse cx="66" cy="148" rx="30" ry="22" fill="url(#bk-fire)" stroke={INK} strokeWidth="2" className="zn-bob" />
        <path d="M46 140 q10 -10 18 2 M70 136 q10 -8 16 4" stroke="#E0A55A" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Пар над печью. */}
        {[0, 1, 2].map(k => (
          <circle key={k} cx={56 + k * 10} cy={88 - k * 4} r={4 + k} fill="#FDFAEF" opacity="0.6" className="zn-bob" style={{ animationDelay: `${k * 0.4}s` }} />
        ))}
      </g>
      {/* Стеллаж с хлебом. */}
      <g>
        <rect x="140" y="26" width="104" height="92" fill="#B5793F" stroke={INK} strokeWidth="2" />
        {[54, 84].map(y => <rect key={y} x="140" y={y} width="104" height="4" fill="#8A5A33" stroke={INK} strokeWidth="1" />)}
        {[[0, 32], [1, 32], [2, 32], [0, 62], [1, 62], [2, 62], [0, 92], [1, 92]].map(([c, y], k) => (
          <path key={k} d={`M${150 + c * 32} ${y + 14} q14 -16 28 0 q-14 8 -28 0 Z`} fill="#E0A55A" stroke={INK} strokeWidth="1.4" />
        ))}
      </g>
      {/* Мешки муки и ценник. */}
      <g>
        <path d="M300 172 q-8 -26 8 -32 h20 q16 6 8 32 Z" fill="#F6EEDC" stroke={INK} strokeWidth="1.8" />
        <path d="M312 140 q6 -6 12 0" stroke={INK} strokeWidth="1.6" fill="none" />
      </g>
    </svg>
  )
}

/** Прилавок — поверх пекарши. */
function Counter() {
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0 z-[15] pointer-events-none" aria-hidden>
      <rect x="40" y="206" width="280" height="94" fill="#8A5A33" stroke="#15100A" strokeWidth="2.4" />
      <rect x="32" y="198" width="296" height="12" rx="3" fill="#B5793F" stroke="#15100A" strokeWidth="2.2" />
      {[0, 1, 2, 3, 4].map(k => <rect key={k} x={58 + k * 52} y="222" width="40" height="64" rx="4" fill="none" stroke="#15100A" strokeWidth="1.2" opacity="0.35" />)}
    </svg>
  )
}
