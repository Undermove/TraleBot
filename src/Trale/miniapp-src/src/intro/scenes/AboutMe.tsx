import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import { myName, phrase } from '../story'
import { GameEnd, GameIntro, RuleCard } from '../ui'
import { hush, speakLine } from '../voice'
import type { SceneProps, StepOf } from './types'
import { Transformed } from './Magnets'
import type { Item } from './Magnets.logic'
import { andYou } from './chatScripts'
import Passerby from './walk/Passerby'
import type { Who } from './Walk.logic'
import {
  choose, complete, emptyCard, filled, magnet, needsMagnet, optionsFor, saveStory, storyLines,
  type Card, type Line, type Mag, type Slot
} from './AboutMe.logic'

/**
 * «Обо мне» — урок 32. Интервью для студенческой газеты: журналистка во дворе университета спрашивает,
 * как тебя зовут, откуда ты, где живёшь, кем работаешь, что любишь. Ответ собираешь сам: слово — и
 * нужное окончание (-დან, -ში), ответ звучит твоим голосом. В конце — заметка о тебе в газете:
 * послушать и сдать в номер.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const INK = '#15100A'
const REPORTER: Who = { ru: 'Журналистка', kind: 'woman', coat: '#2F7F86', skin: '#F2C9A0', hair: '#9A6A3A', extra: 'glasses', voice: 'f' }
const ME: Who = { ru: 'Ты', kind: 'man', coat: '#1B5FB0', skin: '#F6D7BC', hair: '#5A3A22', extra: 'bag', voice: 'm' }

type Phase = 'intro' | 'interview' | 'story' | 'end'
/** Вопросы по порядку: имя, откуда, где живёшь, кем работаешь, что любишь. */
const STEPS: (Slot | 'name')[] = ['name', 'country', 'city', 'job', 'love']
const QUESTIONS: string[][] = [
  [phrase('ra_gkvia').geo],
  [phrase('saidan').geo],
  [phrase('tbilisshi').geo, andYou().geo],
  [phrase('ra_profesia').geo],
  [phrase('mogcons').geo]
]
const HEAD: Record<Slot | 'name', string> = { name: 'მე მქვია', country: 'მე ვარ', city: 'ვცხოვრობ', job: 'მე ვარ', love: 'მიყვარს' }
const LABEL: Record<Slot, string> = { country: 'Откуда ты?', city: 'Где живёшь?', job: 'Кто ты?', love: 'Что любишь?' }

export default function AboutMe({ fraction, onExit, onDone }: SceneProps<StepOf<'aboutme'>>) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [card, setCard] = useState<Card>(emptyCard)
  const me = useMemo(() => myName(), [])
  const lines = useMemo(() => storyLines(card, me), [card, me])
  useEffect(() => () => hush(), [])

  return (
    <GameFrame title={phase === 'story' ? 'Заметка о тебе' : 'Обо мне'} eyebrow="интервью для газеты" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="aboutme-scene">
        {phase === 'intro' && (
          <GameIntro
            title="Интервью для газеты"
            text="Студенческая газета пишет о новичках. Журналистка спросит, как тебя зовут, откуда ты, где живёшь, кем работаешь и что любишь. Ответ собери сам: слово — и нужное окончание."
            chips={[{ geo: '-დან', ru: 'из' }, { geo: '-ში', ru: 'в' }]}
            hero
            onStart={() => setPhase('interview')}
          />
        )}
        {phase === 'interview' && <Interview card={card} setCard={setCard} myGeo={me.geo} myLine={`მე მქვია ${me.geo}.`} onReady={() => setPhase('story')} />}
        {phase === 'story' && <Story lines={lines} name={me.ru} onNext={() => setPhase('end')} onRebuild={() => { setCard(emptyCard()); setPhase('interview') }} />}
        {phase === 'end' && (
          <GameEnd
            title="Заметка в номере!"
            text="Пять предложений о себе по-грузински. Теперь ты можешь представиться кому угодно."
            rule={<RuleCard title="Два окончания"><G>-დან</G> — «из», слово целиком: <G>ესპანეთი</G> → <G>ესპანეთიდან</G>.<br /><G>-ში</G> — «в», последняя <G>ი</G> уходит: <G>ბათუმი</G> → <G>ბათუმში</G>.</RuleCard>}
            onNext={onDone}
            onAgain={() => { setCard(emptyCard()); setPhase('interview') }}
          />
        )}
      </div>
    </GameFrame>
  )
}

// ── Интервью ──────────────────────────────────────────────────────────────────────────────────────

function SlotChip({ slot, card }: { slot: Slot; card: Card }) {
  let text = '', state: 'empty' | 'needs' | 'filled' = 'empty', item: Item | null = null
  if (slot === 'country' && card.country) {
    if (card.countryOk) { state = 'filled'; item = { key: card.country.base, ru: card.country.ru, base: card.country.base, result: card.country.from, tool: 'დან', order: '' } }
    else { state = 'needs'; text = card.country.base }
  } else if (slot === 'city' && card.city) {
    if (card.cityOk) { state = 'filled'; item = { key: card.city.base, ru: card.city.ru, base: card.city.base, result: card.city.in, tool: 'ში', order: '' } }
    else { state = 'needs'; text = card.city.base }
  } else if (slot === 'job' && card.job) { state = 'filled'; text = card.job.geo }
  else if (slot === 'love' && card.love) { state = 'filled'; text = card.love.geo }
  const cls = state === 'filled' ? 'border-solid border-jewelInk bg-gold-wash' : state === 'needs' ? 'border-solid border-ruby bg-ruby-wash' : 'border-dashed border-jewelInk-faint text-jewelInk-faint'
  return (
    <motion.span data-testid={`slot-${slot}`} data-state={state} layout
      className={`inline-flex items-center min-h-[38px] min-w-[86px] justify-center rounded-[10px] border-[1.5px] px-2 font-geo font-bold text-[18px] ${cls}`}
      animate={{ scale: state === 'needs' ? [1, 1.06, 1] : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
      {item ? <Transformed key={item.result} item={item} size={18} /> : text || '…'}
    </motion.span>
  )
}

function Interview({ card, setCard, myGeo, myLine, onReady }: { card: Card; setCard: (c: Card) => void; myGeo: string; myLine: string; onReady: () => void }) {
  const [at, setAt] = useState(0)
  const [asking, setAsking] = useState(true)
  const [said, setSaid] = useState<string | null>(null)
  const [question, setQuestion] = useState<string | null>(null)
  const [talking, setTalking] = useState<'her' | 'me' | null>(null)
  const [tip, setTip] = useState('')
  const [shake, setShake] = useState(false)
  const [notes, setNotes] = useState(0)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])
  const step = STEPS[at]

  // Журналистка задаёт вопрос — по фразе, своим голосом.
  useEffect(() => {
    let off = false
    setAsking(true); setSaid(null)
    ;(async () => {
      await new Promise(r => window.setTimeout(r, 450))
      for (const q of QUESTIONS[at]) {
        if (off || !alive.current) return
        setQuestion(q); setTalking('her')
        await speakLine(q, 'f')
      }
      if (off || !alive.current) return
      setTalking(null); setAsking(false)
      setTip(at === 0 ? 'Ответь — нажми на свой ответ.' : at === 1 ? 'Выбери страну — потом прилепи окончание.' : '')
    })()
    return () => { off = true }
  }, [at])

  /** Ответ готов: произнести его и идти к следующему вопросу. */
  const answered = async (c: Card) => {
    const line = step === 'name' ? myLine : storyPart(c, step as Slot)
    if (!line) return
    setSaid(line); setTalking('me'); setAsking(true)
    haptic('good'); sound.snap(at + 2)
    await speakLine(line, 'hero')
    if (!alive.current) return
    setTalking(null); setNotes(n => n + 1)
    await new Promise(r => window.setTimeout(r, 450))
    if (!alive.current) return
    if (at + 1 < STEPS.length) setAt(a => a + 1)
    else setTip('Интервью готово! Посмотрим заметку?')
  }

  const onPick = (slot: Slot, value: Parameters<typeof choose>[2], geo: string) => {
    if (asking) return
    haptic('tap'); sound.pop(filled(card))
    const n = choose(card, slot, value)
    setCard(n)
    if (slot === 'country') setTip(`«Я ${geo}»? Не хватает окончания. Какое — «из» или «в»?`)
    else if (slot === 'city') setTip(`«Живу ${geo}»? Не хватает окончания. Какое?`)
    else { setTip(''); void answered(n) }
  }
  const onMagnet = (m: Mag, el: HTMLElement) => {
    const r = magnet(card, m)
    setTip(r.tip)
    if (r.ok) {
      haptic('snap'); sound.snap(filled(r.card)); burst(el, 'small')
      setCard(r.card)
      void answered(r.card)
    } else {
      haptic('bad'); sound.miss(); setShake(true); window.setTimeout(() => setShake(false), 420)
    }
  }

  const done = complete(card) && at === STEPS.length - 1 && !talking && asking && !!said
  const ready = !asking
  const showOptions = ready && step !== 'name' && !(step === 'country' && card.country && !card.countryOk) && !(step === 'city' && card.city && !card.cityOk)
  const optSlot: Slot | null = showOptions ? (step as Slot) : null

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="aboutme-build">
      <div className="relative flex-1 min-h-[220px] max-h-[460px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }}>
        <Courtyard />
        <div className="absolute left-[4%] bottom-[-6%] z-10">
          <svg width="140" height="222" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
            <Passerby who={REPORTER} phase={0} stride={0} face="smile" talking={talking === 'her'} wave={false} />
            {/* Блокнот и ручка: на каждый ответ — запись. */}
            <g transform="translate(14 -104) rotate(-8)">
              <rect x="0" y="0" width="30" height="38" rx="3" fill="#FDFAEF" stroke={INK} strokeWidth="2.4" />
              {Array.from({ length: Math.min(5, notes) }, (_, k) => <path key={k} d={`M5 ${8 + k * 6} h${14 + (k % 2) * 6}`} stroke="#1B5FB0" strokeWidth="1.8" strokeLinecap="round" />)}
              <motion.path key={notes} d="M30 4 l10 -14" stroke="#E01A3C" strokeWidth="4" strokeLinecap="round" animate={{ rotate: [0, -14, 8, 0] }} transition={{ duration: 0.6 }} />
            </g>
          </svg>
        </div>
        <div className="absolute right-[2%] bottom-[-8%] z-10">
          <svg width="130" height="210" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
            <Passerby who={ME} phase={0} stride={0} face="smile" talking={talking === 'me'} wave={false} />
          </svg>
        </div>
        <AnimatePresence>
          {question && !said && (
            <div key={`q-${at}-${question}`} className="absolute z-20 left-[3%] top-[5%]">
              <motion.div initial={{ opacity: 0, scale: 0.6, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }} data-testid="aboutme-question"
                className="max-w-[230px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5" style={{ boxShadow: '2px 3px 0 #15100A' }}>
                <span className="block font-geo font-bold text-[16px] leading-tight">{question}</span>
                <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(question)}</span>
              </motion.div>
            </div>
          )}
          {said && (
            <div key={`a-${at}`} className="absolute z-20 right-[3%] top-[8%]">
              <motion.div initial={{ opacity: 0, scale: 0.6, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="max-w-[220px] rounded-2xl border-[1.5px] border-jewelInk bg-navy text-cream px-3 py-1.5" style={{ boxShadow: '2px 3px 0 #15100A' }}>
                <span className="block font-geo font-bold text-[16px] leading-tight">{said}</span>
                <span className="block text-[11px] font-semibold text-cream/80 leading-tight">{cyr(said)}</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-0.5 text-[11px] font-extrabold" data-testid="aboutme-filled">ответы: {notes} из {STEPS.length}</div>
      </div>

      {/* Твой ответ — на карточке: начало фразы и место для слова. */}
      <motion.div key={at} className={`shrink-0 rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2.5 flex flex-wrap items-center gap-2 font-geo font-bold text-[18px] ${shake ? 'zn-shake' : ''}`}
        style={{ boxShadow: '3px 3px 0 #15100A', backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 33px, rgba(27,95,176,.12) 33px 34px)' }}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} data-testid="aboutme-card">
        <span>{HEAD[step]}</span>
        {step === 'name'
          ? <motion.button type="button" data-testid="aboutme-name" disabled={!ready} onClick={() => { haptic('pop'); void answered(card) }}
              className="rounded-[10px] border-[1.5px] border-jewelInk bg-gold-wash px-2 py-0.5 text-[18px]" animate={{ scale: ready ? [1, 1.06, 1] : 1 }} transition={{ repeat: ready ? Infinity : 0, duration: 1.4 }}>{myGeo}</motion.button>
          : <SlotChip slot={step} card={card} />}
        <span>.</span>
      </motion.div>

      <AnimatePresence mode="wait">
        {optSlot && (
          <motion.div key={`o-${optSlot}`} className="shrink-0 flex flex-col gap-1.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy">{LABEL[optSlot]}</div>
            <div className="flex flex-wrap gap-1.5" data-testid="aboutme-options">
              {optionsFor(optSlot).map((o, k) => (
                <motion.button key={o.geo} type="button" data-testid={`opt-${o.geo}`} onClick={() => onPick(optSlot, o.value, o.geo)}
                  className="min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-1 leading-tight" style={{ boxShadow: '2px 2px 0 #15100A' }}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 22, delay: k * 0.04 }} whileTap={{ scale: 0.94 }}>
                  <span className="block font-geo font-bold text-[15px]">{o.geo}</span>
                  <span className="block text-[10px] font-semibold text-jewelInk-hint">{o.ru}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {needsMagnet(card) && !asking && (
          <motion.div className="shrink-0 flex justify-center gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {(['დან', 'ში'] as Mag[]).map((m, k) => (
              <motion.button key={m} type="button" data-testid={`magnet-${m}`} onClick={e => onMagnet(m, e.currentTarget)}
                className="min-h-[54px] min-w-[96px] rounded-2xl border-[1.5px] border-jewelInk px-4 py-1 text-cream" style={{ boxShadow: '3px 3px 0 #15100A', background: m === 'ში' ? '#1B5FB0' : '#E01A3C' }}
                initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: k * 0.06 }} whileTap={{ scale: 0.92, rotate: -4 }}>
                <span className="block font-geo font-extrabold text-[22px] leading-none">-{m}</span>
                <span className="block text-[11px] font-semibold text-cream/85">{m === 'ში' ? 'в' : 'из'}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0" />
      {tip && <div className="shrink-0 text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite">{tip}</div>}
      {done && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><Button onClick={() => { haptic('pop'); onReady() }}>Готово, прочитать рассказ</Button></motion.div>}
    </div>
  )
}

/** Строка ответа для шага — уже с окончанием, или null, если ещё не готова. */
function storyPart(c: Card, slot: Slot): string | null {
  if (slot === 'country') return c.country && c.countryOk ? `მე ვარ ${c.country.from}.` : null
  if (slot === 'city') return c.city && c.cityOk ? `ვცხოვრობ ${c.city.in}.` : null
  if (slot === 'job') return c.job ? `მე ვარ ${c.job.geo}.` : null
  return c.love ? `მიყვარს ${c.love.geo}.` : null
}

/** Двор университета: аркада, дерево, скамейка, вечернее небо. */
function Courtyard() {
  return (
    <svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <defs><linearGradient id="am-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9CC6EE" /><stop offset="1" stopColor="#F6E6D2" /></linearGradient></defs>
      <rect width="360" height="220" fill="url(#am-sky)" />
      {/* Здание университета с колоннами и аркадой. */}
      <rect x="60" y="40" width="240" height="140" fill="#F1DFC2" stroke={INK} strokeWidth="2" />
      <path d="M50 42 L180 6 L310 42 Z" fill="#E8C3A6" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="180" cy="28" r="7" fill="#FDFAEF" stroke={INK} strokeWidth="1.4" />
      {[90, 130, 170, 210, 250].map(x => (
        <g key={x}>
          <path d={`M${x} 180 V112 a16 16 0 0 1 32 0 V180`} fill="#C9B79A" stroke={INK} strokeWidth="1.6" />
          <rect x={x - 4} y="100" width="4" height="80" fill="#FDFAEF" stroke={INK} strokeWidth="1" />
        </g>
      ))}
      {[78, 118, 158, 198, 238, 278].map(x => <rect key={x} x={x} y="58" width="18" height="24" rx="2" fill="#8FB3D4" stroke={INK} strokeWidth="1.2" />)}
      {/* Дерево и брусчатка. */}
      <rect y="180" width="360" height="40" fill="#D9CDB8" />
      {Array.from({ length: 12 }, (_, k) => <path key={k} d={`M${k * 32} 180 l14 40`} stroke={INK} strokeWidth="0.7" opacity="0.2" />)}
      <path d="M332 182 v-50" stroke="#7A4E2D" strokeWidth="6" />
      <circle cx="320" cy="122" r="22" fill="#4E8A5B" stroke={INK} strokeWidth="1.6" />
      <circle cx="342" cy="112" r="18" fill="#5E9C5F" stroke={INK} strokeWidth="1.6" />
    </svg>
  )
}

// ── Заметка ───────────────────────────────────────────────────────────────────────────────────────

function Story({ lines, name, onNext, onRebuild }: { lines: Line[]; name: string; onNext: () => void; onRebuild: () => void }) {
  const [reading, setReading] = useState(-1)
  const [run, setRun] = useState(0)
  const [saved, setSaved] = useState(false)

  // Заметку читают твоим голосом, строку за строкой, — следующая после того, как договорили.
  useEffect(() => {
    let stop = false
    ;(async () => {
      await new Promise(r => window.setTimeout(r, 400))
      for (let k = 0; k < lines.length && !stop; k++) {
        setReading(k)
        await speakLine(lines[k].geo, 'hero')
      }
      if (!stop) setReading(-1)
    })()
    return () => { stop = true; hush() }
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = (el: HTMLElement) => {
    saveStory(lines)
    setSaved(true)
    haptic('good'); sound.win(); burst(el, 'big')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="aboutme-story">
      <motion.div className="relative min-h-0 overflow-hidden rounded-md border-[1.5px] border-jewelInk bg-[#FBF6EA] px-3 py-2" style={{ boxShadow: '4px 4px 0 #15100A' }} data-testid="story-card"
        initial={{ rotate: -4, y: 40, opacity: 0 }} animate={{ rotate: -1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }}>
        {/* Шапка газеты. */}
        <div className="border-b-[3px] border-double border-jewelInk pb-1 mb-1.5 flex items-end justify-between">
          <span className="font-serif text-[20px] font-black tracking-tight leading-none">Студенческий вестник</span>
          <span className="text-[10px] font-bold text-jewelInk-hint">Батуми</span>
        </div>
        <div className="flex gap-2.5">
          <div className="shrink-0 rounded-sm border-[1.5px] border-jewelInk bg-[#E6DCC6] overflow-hidden h-[96px] w-[72px] flex items-end justify-center">
            <svg width="70" height="112" viewBox="-60 -190 120 196" className="overflow-visible -mb-6" aria-hidden style={{ filter: 'grayscale(0.6) sepia(0.3)' }}>
              <Passerby who={ME} phase={0} stride={0} face="smile" talking={false} wave />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-black leading-tight">Новый студент: {name}</div>
            <div className="text-[11px] text-jewelInk-soft leading-snug">Мы спросили новичка о нём самом — вот что он рассказал.</div>
          </div>
        </div>
        <div className="mt-1.5 flex flex-col">
          {lines.map((l, k) => (
            <motion.div key={k} data-testid="story-line" data-reading={reading === k ? 'yes' : 'no'}
              className="rounded-md px-1.5 py-0.5"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, backgroundColor: reading === k ? '#FCE9A8' : '#FBF6EA00' }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, delay: k * 0.08 }}>
              <div className="font-geo font-bold text-[16px] ab-short:text-[14px] leading-tight">{l.geo}</div>
              <div className="text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(l.geo)} · <span className="text-navy">{l.ru}</span></div>
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {saved && (
            <motion.div className="absolute right-3 bottom-3 rounded-lg border-[3px] border-ruby px-2 py-0.5 text-[16px] font-extrabold uppercase tracking-[0.1em] text-ruby bg-cream-tile/80" data-testid="story-stamp"
              initial={{ scale: 2.4, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: -10, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }}>
              в номер
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="flex-1 min-h-0" />
      <div className="flex gap-2">
        <div className="flex-1"><Button variant="ghost" onClick={() => setRun(r => r + 1)}>Послушать</Button></div>
        <div className="flex-1"><Button variant="ghost" onClick={onRebuild}>Заново</Button></div>
      </div>
      {saved
        ? <Button onClick={onNext}>Дальше</Button>
        : <button type="button" data-testid="story-save" onClick={e => keep(e.currentTarget)} className="jewel-btn bg-ruby text-cream w-full"><span className="relative z-[1]">Сдать в номер</span></button>}
    </div>
  )
}
