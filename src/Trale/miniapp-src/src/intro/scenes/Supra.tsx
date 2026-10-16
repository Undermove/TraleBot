import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { firstMet, met, myName, phrase, type Phrase } from '../story'
import { GameEnd, GameIntro, NewWord } from '../ui'
import { hush, speakLine, speakUrl } from '../voice'
import type { Opt, Say } from './chatScripts'
import { BEATS, THEME_RU, TOASTS, dishUrl, guestWarmth, guests, toastOpts, type Guest } from './supra.logic'
import { voiceOf } from './Reception.logic'
import { type Voice } from './chat/voices'
import Passerby, { type Face } from './walk/Passerby'
import type { Who } from './Walk.logic'
import type { SceneProps, StepOf } from './types'

/**
 * «Супра» — финал «Знакомства». Беседка под виноградом, длинный стол: хачапури, хинкали, чурчхела, вино.
 * Шесть гостей и тамада. Гости по очереди заговаривают с тобой — каждый о своей теме модуля; никто не
 * торопит. Между гостями тамада поднимает тост: подними бокал пальцем — все чокаются — и ответь на тост.
 * В конце — общее фото стола.
 */

const INK = '#15100A'
const TAMADA: Who = { ru: 'Тамада', kind: 'old', coat: '#3A2B1F', skin: '#E0AC7E', hair: '#E8DEC5', extra: 'none', voice: 'm' }
const COATS = ['#E01A3C', '#1B5FB0', '#4E8A5B', '#7A4E9A', '#C68F10', '#2F7F86']
const SKIN = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D7BC', '#E0AC7E', '#F2C9A0']

/** Места за столом (центр, низ фигуры в % сцены) и масштаб: ближние — крупнее. */
const SEATS: { x: number; y: number; s: number }[] = [
  { x: 10, y: 100, s: 1 }, { x: 90, y: 100, s: 1 },
  { x: 22, y: 80, s: 0.8 }, { x: 78, y: 80, s: 0.8 },
  { x: 32, y: 64, s: 0.62 }, { x: 68, y: 64, s: 0.62 }
]
/** Кто где сидит: по очереди разговора — сначала ближние. */
const SEAT_OF = [0, 1, 2, 3, 4, 5]

function whoOf(g: Guest, i: number): Who {
  const f = voiceOf(g.name) === 'f'
  return {
    ru: g.ru, kind: g.theme === 'family' ? 'old' : f ? 'woman' : 'man', coat: COATS[i % COATS.length], skin: SKIN[i % SKIN.length],
    hair: g.theme === 'family' ? '#E8DEC5' : f ? '#2A1F18' : '#15100A', extra: (['none', 'glasses', 'bag', 'cap', 'none', 'none'] as const)[i % 6], voice: f ? 'f' : 'm'
  }
}

type Stage = 'talk' | 'answer' | 'raise' | 'toastAnswer' | 'cheer'

interface Bub { who: 'guest' | 'tamada' | 'you'; geo?: string; ru: string }

export default function Supra({ lesson, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'supra'>>) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [round, setRound] = useState(0)
  const me = useMemo(() => myName(), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(() => guests(me, rng), [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const people = useMemo(() => table.map(whoOf), [table])
  const toastLists = useMemo(() => TOASTS.map(t => toastOpts(!!t.georgia, rng)), [table]) // eslint-disable-line react-hooks/exhaustive-deps

  const [b, setB] = useState(0)
  const [e, setE] = useState(0)
  const [stage, setStage] = useState<Stage>('talk')
  const [bubble, setBubble] = useState<Bub | null>(null)
  const [tried, setTried] = useState<number[]>([])
  const [missed, setMissed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [warm, setWarm] = useState<(number | null)[]>(() => table.map(() => null))
  const [toasts, setToasts] = useState(0)
  const [clink, setClink] = useState(0)
  const [talking, setTalking] = useState<number | 'tamada' | null>(null)
  const [faces, setFaces] = useState<Record<number, Face>>({})
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

  const beat = BEATS[Math.min(b, BEATS.length - 1)]
  const voiceOfGuest = (g: number): Voice => (people[g]?.voice ?? 'f')

  /** Реплики собеседника по одной, каждая своим голосом; ремарки — строкой под столом. */
  const tell = async (lines: Say[], who: number | 'tamada') => {
    for (const l of lines) {
      if (!alive.current) return
      if (l.kind === 'note') { setNote(l.text); continue }
      if (l.kind !== 'her') continue
      setBubble({ who: who === 'tamada' ? 'tamada' : 'guest', geo: l.geo, ru: l.ru }); setTalking(who)
      introduce(l.ids)
      const v = who === 'tamada' ? 'm' : voiceOfGuest(who)
      { const d = dishUrl(l.geo, v); await (d ? speakUrl(d, l.geo) : speakLine(l.geo, v)) }
      if (alive.current) setTalking(null)
    }
  }

  // Слова сцены впервые (урок 33): тамада — на первом тосте, хинкали и чурчхела — когда угощают.
  const [fresh, setFresh] = useState<Phrase | null>(null)
  const shown = useRef(new Set<string>())
  const introduce = (ids: string[]) => {
    const id = ids.find(x => (lesson.scene ?? []).includes(x) && firstMet(lesson.id, x) && !shown.current.has(x))
    if (id) { shown.current.add(id); setFresh(phrase(id)) }
  }
  const tamadaWord = met(lesson.id, 'tamada') ? phrase('tamada') : null

  // Ход вечера: гость говорит — твой ответ; тамада — тост.
  useEffect(() => {
    if (phase !== 'play') return
    let off = false
    setTried([]); setNote(null); busy.current = false
    ;(async () => {
      await wait(500)
      if (off || !alive.current) return
      if (beat.kind === 'guest') {
        const g = table[beat.g]
        haptic('soft')
        await tell(g.talk[e].her, beat.g)
        if (!off && alive.current) setStage('answer')
      } else {
        setStage('talk')
        introduce(['tamada'])
        setBubble({ who: 'tamada', ru: `«${TOASTS[beat.t].ru}»` }); setTalking('tamada'); sound.pop(2)
        await wait(1500)
        if (off || !alive.current) return
        setTalking(null); setStage('raise')
        setNote('Подними бокал — потяни его вверх или нажми.')
      }
    })()
    return () => { off = true }
  }, [phase, b, e]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    setBubble(null); setNote(null); setMissed(0); setE(0); setStage('talk')
    if (b + 1 >= BEATS.length) {
      sound.win(); haptic('good')
      window.setTimeout(() => alive.current && setPhase('end'), 600)
      return
    }
    setB(x => x + 1)
  }

  const chooseGuest = async (o: Opt, k: number) => {
    if (beat.kind !== 'guest' || stage !== 'answer' || busy.current) return
    const gi = beat.g
    const g = table[gi]
    if (!o.good) {
      setTried(t => [...t, k]); setMissed(m => m + 1); setNote(o.miss ?? null)
      setFaces(f => ({ ...f, [gi]: 'huh' }))
      haptic('bad'); sound.miss()
      return
    }
    busy.current = true
    setStage('talk'); setNote(null); setFresh(null); setFaces(f => ({ ...f, [gi]: 'smile' }))
    setBubble({ who: 'you', geo: o.geo, ru: o.ru })
    haptic('pop'); sound.snap(b + e)
    await speakLine(o.geo, 'hero')
    if (!alive.current) return
    if (o.then?.length) await tell(o.then, gi)
    if (!alive.current) return
    if (e + 1 < g.talk.length) { setTried([]); setE(x => x + 1); return }
    setWarm(w => { const n = [...w]; n[gi] = guestWarmth(missed); return n })
    setFaces(f => ({ ...f, [gi]: 'wow' }))
    burst(document.querySelector(`[data-testid="supra-guest-${gi}"]`) as HTMLElement | null, 'small')
    await wait(500)
    next()
  }

  const raised = () => {
    if (beat.kind !== 'toast' || stage !== 'raise') return
    setStage('toastAnswer'); setClink(c => c + 1)
    haptic('good'); sound.win()
    burst(document.querySelector('[data-testid="supra-raise"]') as HTMLElement | null, 'small')
    setNote('Бокалы звенят! Ответь на тост.')
  }

  const chooseToast = async (o: Opt, k: number) => {
    if (beat.kind !== 'toast' || stage !== 'toastAnswer' || busy.current) return
    if (!o.good) { setTried(t => [...t, k]); setNote(o.miss ?? null); haptic('bad'); sound.miss(); return }
    busy.current = true
    setStage('cheer'); setNote(null); setFresh(null)
    setBubble({ who: 'you', geo: o.geo, ru: o.ru })
    haptic('pop')
    await speakLine(o.geo, 'hero')
    if (!alive.current) return
    // Весь стол подхватывает тост.
    setToasts(n => n + 1); setClink(c => c + 1)
    setBubble({ who: 'tamada', geo: o.geo, ru: o.ru }); setTalking('tamada')
    haptic('good'); sound.snap(6)
    burst(document.querySelector('[data-testid="supra-table"]') as HTMLElement | null, 'big')
    await speakLine(o.geo, 'm')
    if (!alive.current) return
    setTalking(null)
    await wait(400)
    next()
  }

  const start = () => {
    setB(0); setE(0); setWarm(table.map(() => null)); setToasts(0); setNote(null); setBubble(null); setFaces({}); setStage('talk'); setFresh(null); shown.current = new Set()
    setPhase('play')
  }

  const warmCount = warm.filter(w => (w ?? 0) > 0).length

  if (phase === 'intro') return (
    <GameFrame title="Супра" eyebrow={`финал · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <GameIntro title="Большой вечер у соседей" hero
        text="Беседка под виноградом, длинный стол, шесть гостей и тамада. Гости по очереди заговорят с тобой — отвечай, никто не торопит. Будут и угощать: попробуй и похвали. Тамада поднимет три тоста: подними бокал вместе со всеми и ответь."
        chips={[{ geo: 'გაუმარჯოს!', ru: 'за здоровье!' }, { geo: 'გაუმარჯოს საქართველოს!', ru: 'да здравствует Грузия!' }]}
        mood="cheer" onStart={start} />
    </GameFrame>
  )

  if (phase === 'end') return (
    <GameFrame title="Супра" eyebrow="финал «Знакомства»" fraction={fraction} onExit={onExit}>
      <GameEnd
        title="Супра удалась!"
        text="Ты прошёл всё «Знакомство»."
        rule={<GroupPhoto people={people} toasts={toasts} warm={warmCount} total={table.length} />}
        onNext={onDone}
        onAgain={() => { setRound(r => r + 1); setPhase('intro') }}
      />
    </GameFrame>
  )

  const g = beat.kind === 'guest' ? table[beat.g] : null
  const ex = g?.talk[e]
  const opts = beat.kind === 'guest' ? (stage === 'answer' ? ex?.opts ?? [] : []) : stage === 'toastAnswer' ? toastLists[beat.t] : []
  const hint = tried.length >= 2
  const activeSeat = beat.kind === 'guest' ? SEAT_OF[beat.g] : null
  const bubbleAt = bubble?.who === 'guest' && activeSeat !== null ? SEATS[activeSeat] : null

  return (
    <GameFrame title="Супра" eyebrow={beat.kind === 'guest' ? `гость ${beat.g + 1} из ${table.length} · ${THEME_RU[table[beat.g].theme]}` : `тост ${beat.t + 1} из ${TOASTS.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="supra-scene">
        <div className="relative flex-1 min-h-[290px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="supra-table">
          <Pergola />
          {/* Тамада во главе стола. */}
          <motion.div className="absolute left-1/2 z-[5]" style={{ top: '22%' }}
            animate={{ x: '-50%', y: beat.kind === 'toast' ? -8 : 0, scale: talking === 'tamada' ? 1.05 : 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
            <svg width="70" height="112" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
              <Passerby who={TAMADA} phase={0} stride={0} face={beat.kind === 'toast' ? 'wow' : 'smile'} talking={talking === 'tamada'} wave={false} />
              {/* Рог с вином. */}
              <motion.g animate={{ rotate: beat.kind === 'toast' ? -30 : 0 }} style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }}>
                <path d="M28 -112 q30 -10 34 -44 q-14 10 -26 14 q-8 4 -14 18 Z" fill="#C68F10" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M40 -150 q8 -3 18 -6" stroke="#A61026" strokeWidth="5" strokeLinecap="round" />
              </motion.g>
            </svg>
          </motion.div>
          {/* Гости по бокам стола. */}
          {table.map((gst, i) => {
            const seat = SEATS[SEAT_OF[i]]
            const active = activeSeat === SEAT_OF[i]
            return (
              <motion.div key={i} data-testid={`supra-guest-${i}`} data-warm={warm[i] ?? ''}
                className="absolute z-[6]" style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
                animate={{ x: '-50%', y: '-100%', scale: active ? 1.06 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                <div className={`rounded-full ${active ? 'drop-shadow-[0_0_10px_rgba(245,184,32,0.9)]' : ''}`}>
                  <svg width={120 * seat.s} height={190 * seat.s} viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                    <Passerby who={people[i]} phase={0} stride={0} face={faces[i] ?? 'smile'} talking={talking === i} wave={active && stage === 'talk' && e === 0 && !bubble?.geo} />
                  </svg>
                </div>
                <AnimatePresence>
                  {(warm[i] ?? 0) > 0 && (
                    <motion.span key="heart" className="absolute -top-2 left-1/2 -translate-x-1/2" initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
                      <Heart />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
          <TableTop clink={clink} />

          {/* Реплика — у того, кто говорит. */}
          <AnimatePresence>
            {bubble && (
              <div key={`${b}-${e}-${bubble.who}-${bubble.geo ?? bubble.ru}`}
                className={`absolute z-20 ${bubble.who === 'you' ? 'bottom-[30%] left-0 right-0 flex justify-center' : bubble.who === 'tamada' ? 'top-[11%] left-0 right-0 flex justify-center' : ''}`}
                style={bubbleAt && bubble.who === 'guest' ? { top: `${Math.max(2, bubbleAt.y - 52 * bubbleAt.s - 14)}%`, left: bubbleAt.x < 50 ? '3%' : undefined, right: bubbleAt.x >= 50 ? '3%' : undefined } : undefined}>
                <motion.div data-testid="supra-bubble" initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className={`max-w-[230px] rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 text-center ${bubble.who === 'you' ? 'bg-navy text-cream' : bubble.who === 'tamada' ? 'bg-gold-wash' : 'bg-cream-tile'}`}
                  style={{ boxShadow: '2px 3px 0 #15100A' }}>
                  {bubble.geo ? (
                    <>
                      <span className="block font-geo font-bold text-[16px] leading-tight">{bubble.geo}</span>
                      <span className={`block text-[11px] font-semibold leading-tight ${bubble.who === 'you' ? 'text-cream/80' : 'text-jewelInk-hint'}`}>{cyr(bubble.geo)} · {bubble.ru}</span>
                    </>
                  ) : <span className="block text-[14px] font-extrabold">{tamadaWord ? <span className="font-geo">{tamadaWord.geo}</span> : 'Тамада'}: {bubble.ru}</span>}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Твой бокал: тянешь вверх — поднимаешь. */}
          {beat.kind === 'toast' && (stage === 'raise' || stage === 'toastAnswer' || stage === 'cheer') && (
            <MyGlass up={stage !== 'raise'} onRaise={raised} />
          )}

          <div className="absolute top-2 left-2 z-30 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-0.5 text-[11px] font-extrabold" data-testid="supra-toast-count">тосты {toasts}/{TOASTS.length}</div>
          <div className="absolute top-2 right-2 z-30 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-0.5 text-[11px] font-extrabold">тёплые {warmCount}/{table.length}</div>
        </div>

        {/* Новое слово сцены — под столом, пока не ответишь. */}
        <AnimatePresence>
          {fresh && (
            <motion.div key={fresh.id} className="shrink-0 flex justify-center"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
              <NewWord word={fresh} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {note && (
            <motion.div key={note} className="shrink-0 rounded-xl border-[1.5px] border-dashed border-jewelInk-hint px-3 py-1 text-center text-[12px] font-semibold text-jewelInk-soft" data-testid="supra-note"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{note}</motion.div>
          )}
        </AnimatePresence>
        <div className="shrink-0 flex flex-col gap-1.5" data-testid="supra-options">
          {opts.map((o, k) => (
            <motion.button key={`${b}-${e}-${k}`} type="button" disabled={tried.includes(k)}
              data-testid={o.good ? 'supra-reply-ok' : 'supra-reply-miss'}
              onClick={() => { haptic('tap'); void (beat.kind === 'guest' ? chooseGuest(o, k) : chooseToast(o, k)) }}
              className={`min-h-[46px] w-full rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 text-center ${hint && o.good ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''}`}
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: tried.includes(k) ? 0.4 : 1, y: 0, backgroundColor: tried.includes(k) ? '#F7DCDD' : '#FDFAEF' }}
              whileTap={tried.includes(k) ? undefined : { scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26, delay: k * 0.05 }}>
              <span className="block font-geo font-bold text-[15px] leading-tight">{o.geo}</span>
              <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(o.geo)}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}

function Heart() {
  return <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden><path d="M10 17 C2 11 0 7 2.5 3.5 C5 0.5 9 2 10 5 C11 2 15 0.5 17.5 3.5 C20 7 18 11 10 17 Z" fill="#E01A3C" stroke={INK} strokeWidth="1.6" /></svg>
}

/** Бокал: тянешь вверх (или нажимаешь) — поднимается; вверху — чокается со всеми. */
function MyGlass({ up, onRaise }: { up: boolean; onRaise: () => void }) {
  const y = useMotionValue(0)
  useEffect(() => { if (up) void animate(y, -90, { type: 'spring', stiffness: 260, damping: 14 }) }, [up]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.button type="button" data-testid="supra-raise" aria-label="Поднять бокал"
      className="absolute right-[8%] bottom-[2%] z-30 touch-none" style={{ y }}
      drag={up ? false : 'y'} dragConstraints={{ top: -120, bottom: 0 }} dragElastic={0.1} dragMomentum={false}
      onDragEnd={() => { if (y.get() < -50) onRaise(); else void animate(y, 0, { type: 'spring', stiffness: 400, damping: 18 }) }}
      onClick={() => { if (!up) onRaise() }}
      whileTap={{ scale: 1.08 }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, rotate: up ? [0, -10, 6, 0] : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
      <svg width="58" height="84" viewBox="0 0 58 84" aria-hidden>
        <path d="M8 4 H50 L43 44 Q29 56 15 44 Z" fill="#FDFAEF" fillOpacity="0.85" stroke={INK} strokeWidth="2.6" />
        <path d="M11 16 H47 L41.5 42 Q29 51 16.5 42 Z" fill="#A61026" />
        <path d="M16 20 Q22 18 26 22" stroke="#FFFFFF" strokeWidth="2" opacity="0.6" fill="none" />
        <path d="M29 52 V74 M16 78 H42" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </svg>
      {!up && <motion.span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-extrabold text-cream bg-jewelInk/70 rounded-full px-2 whitespace-nowrap"
        animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.1 }}>вверх</motion.span>}
    </motion.button>
  )
}

/** Беседка: вечернее небо, виноград на перголе, гирлянда, сад. */
function Pergola() {
  return (
    <svg viewBox="0 0 360 320" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <defs>
        <linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B2F66" /><stop offset="0.7" stopColor="#C26C8E" /><stop offset="1" stopColor="#F2A27A" /></linearGradient>
      </defs>
      <rect width="360" height="320" fill="url(#sp-sky)" />
      {/* Сад и горы вдали. */}
      <path d="M0 150 Q60 118 120 140 Q180 112 240 136 Q300 116 360 140 V320 H0 Z" fill="#4E3F6E" />
      <path d="M0 170 Q90 150 180 166 Q270 150 360 168 V320 H0 Z" fill="#3E6B52" />
      {/* Деревянные столбы и балки перголы. */}
      {[14, 346].map(x => <rect key={x} x={x - 6} y="20" width="12" height="300" fill="#7A4E2D" stroke={INK} strokeWidth="2" />)}
      <rect x="0" y="16" width="360" height="12" fill="#8A5A33" stroke={INK} strokeWidth="2" />
      {[60, 120, 180, 240, 300].map(x => <rect key={x} x={x - 4} y="10" width="8" height="24" fill="#8A5A33" stroke={INK} strokeWidth="1.4" />)}
      {/* Виноградные листья и гроздья. */}
      {Array.from({ length: 16 }, (_, k) => {
        const x = 10 + k * 23, y = 26 + (k % 3) * 9
        return <g key={k}>
          <path d={`M${x} ${y} q-10 4 -8 14 q8 2 12 -4 q4 6 12 4 q2 -10 -8 -14 q-4 -6 -8 0 Z`} fill={k % 2 ? '#4E8A5B' : '#5E9C5F'} stroke={INK} strokeWidth="1.2" />
          {k % 4 === 1 && [0, 1, 2, 3, 4, 5].map(j => <circle key={j} cx={x + 2 + (j % 3) * 4 - 4} cy={y + 18 + Math.floor(j / 3) * 4} r="2.4" fill="#7A4E9A" stroke={INK} strokeWidth="0.8" />)}
        </g>
      })}
      {/* Гирлянда. */}
      <path d="M0 46 Q90 74 180 50 Q270 74 360 46" stroke={INK} strokeWidth="1.2" fill="none" />
      {Array.from({ length: 13 }, (_, k) => {
        const t = k / 12, x = t * 360, y = 46 + Math.sin(t * Math.PI * 2) * -2 + (t < 0.5 ? Math.sin(t * 2 * Math.PI) : Math.sin((t - 0.5) * 2 * Math.PI)) * 22
        return <g key={k}><circle cx={x} cy={y + 4} r="8" fill="#FFE08A" opacity="0.3" /><circle cx={x} cy={y + 4} r="3.6" fill={['#F5B820', '#E01A3C', '#4E8A5B', '#1B5FB0'][k % 4]} stroke={INK} strokeWidth="1" /></g>
      })}
    </svg>
  )
}

/** Стол в перспективе: скатерть с орнаментом, блюда, вино; бокалы гостей подпрыгивают на «чок». */
function TableTop({ clink }: { clink: number }) {
  const glasses: [number, number, number][] = [[96, 284, 1], [264, 284, 1], [126, 236, 0.8], [234, 236, 0.8], [150, 198, 0.66], [210, 198, 0.66]]
  return (
    <svg viewBox="0 0 360 320" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0 z-[8] pointer-events-none" aria-hidden>
      {/* Скатерть. */}
      <path d="M150 172 L210 172 L308 320 L52 320 Z" fill="#FDFAEF" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M150 178 L210 178 M140 192 L220 192" stroke="#E01A3C" strokeWidth="2" opacity="0.6" />
      {Array.from({ length: 7 }, (_, k) => <path key={k} d={`M${70 + k * 36} 312 l6 -6 l6 6 l-6 6 Z`} fill="#E01A3C" opacity="0.55" />)}
      {/* Хачапури по-аджарски с желтком. */}
      <g>
        <path d="M150 264 Q180 236 210 264 Q180 290 150 264 Z" fill="#E0A55A" stroke={INK} strokeWidth="2" />
        <ellipse cx="180" cy="264" rx="16" ry="9" fill="#FFF4B8" stroke={INK} strokeWidth="1.4" />
        <circle cx="180" cy="264" r="5" fill="#F5B820" stroke={INK} strokeWidth="1" />
      </g>
      {/* Хинкали на тарелке. */}
      <g>
        <ellipse cx="116" cy="298" rx="30" ry="11" fill="#E8DEC5" stroke={INK} strokeWidth="1.8" />
        {[102, 116, 130].map((x, k) => <g key={x}><path d={`M${x - 9} ${294 - (k % 2) * 3} q9 -14 18 0 q-9 6 -18 0 Z`} fill="#F6EEDC" stroke={INK} strokeWidth="1.4" /><circle cx={x} cy={281 - (k % 2) * 3} r="2" fill="#F6EEDC" stroke={INK} strokeWidth="1" /></g>)}
      </g>
      {/* Чурчхела и гранат. */}
      <g>
        {[0, 1].map(k => <path key={k} d={`M${262 + k * 10} 280 q-3 10 0 24 q3 -12 0 -24`} stroke="#7A2E1E" strokeWidth="6" strokeLinecap="round" fill="none" />)}
        <circle cx="164" cy="214" r="9" fill="#C2253A" stroke={INK} strokeWidth="1.6" />
        <path d="M161 205 l3 -4 l3 4" fill="#C2253A" stroke={INK} strokeWidth="1.2" />
      </g>
      {/* Кувшин вина. */}
      <g>
        <path d="M196 226 q-12 0 -12 -14 q0 -10 8 -14 v-6 h10 v6 q8 4 8 14 q0 14 -14 14 Z" fill="#C2553A" stroke={INK} strokeWidth="1.8" />
        <path d="M208 206 q8 2 6 10" stroke={INK} strokeWidth="1.8" fill="none" />
      </g>
      {/* Бокалы гостей: на «чок» подскакивают. */}
      {glasses.map(([x, y, s], k) => (
        <motion.g key={`${k}-${clink}`} initial={false} animate={clink ? { y: [0, -10 * s, 0] } : { y: 0 }} transition={{ duration: 0.5, delay: k * 0.04 }}>
          <path d={`M${x - 6 * s} ${y - 20 * s} H${x + 6 * s} L${x + 4 * s} ${y - 8 * s} Q${x} ${y - 5 * s} ${x - 4 * s} ${y - 8 * s} Z`} fill="#A61026" stroke={INK} strokeWidth="1.4" />
          <path d={`M${x} ${y - 6 * s} V${y} M${x - 4 * s} ${y} H${x + 4 * s}`} stroke={INK} strokeWidth="1.6" />
        </motion.g>
      ))}
    </svg>
  )
}

/** Общее фото стола: вспышка, все улыбаются, итоги вечера. */
function GroupPhoto({ people, toasts, warm, total }: { people: Who[]; toasts: number; warm: number; total: number }) {
  useEffect(() => { haptic('good'); sound.win(); burst(document.querySelector('[data-testid="supra-photo"]') as HTMLElement | null, 'big') }, [])
  const row = [people[4], people[2], people[0], TAMADA, people[1], people[3], people[5]].filter(Boolean)
  return (
    <motion.div className="relative w-full max-w-[330px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-2" style={{ boxShadow: '4px 4px 0 #15100A' }} data-testid="supra-photo"
      initial={{ rotate: 6, scale: 0.7, opacity: 0 }} animate={{ rotate: -2, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }}>
      <div className="relative overflow-hidden rounded-xl border-[1.5px] border-jewelInk h-[150px] flex items-end justify-center" style={{ background: 'linear-gradient(#3B2F66, #C26C8E 70%, #F2A27A)' }}>
        {/* Гирлянда над столом. */}
        <svg viewBox="0 0 300 40" className="absolute inset-x-0 top-0 w-full h-[34px]" aria-hidden>
          <path d="M0 6 Q75 30 150 10 Q225 30 300 6" stroke={INK} strokeWidth="1" fill="none" />
          {Array.from({ length: 11 }, (_, k) => { const x = 14 + k * 27; const y = 8 + Math.abs(Math.sin((k / 10) * Math.PI * 2)) * 12; return <circle key={k} cx={x} cy={y + 4} r="3.4" fill={['#F5B820', '#E01A3C', '#4E8A5B', '#1B5FB0'][k % 4]} stroke={INK} strokeWidth="0.8" /> })}
        </svg>
        {row.map((w, i) => (
          <svg key={i} width="66" height="132" viewBox="-60 -190 120 196" className="overflow-visible -mx-3 -mb-5" aria-hidden>
            <Passerby who={w} phase={0} stride={0} face="smile" talking={false} wave={i === 0 || i === row.length - 1 || i === 3} />
          </svg>
        ))}
        {/* Край стола со скатертью. */}
        <div className="absolute inset-x-0 bottom-0 h-[22px] border-t-[1.5px] border-jewelInk bg-cream" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 18px, rgba(224,26,60,.55) 18px 22px)' }} />
        <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />
      </div>
      <div className="mt-1.5 flex justify-center gap-3 text-[13px] font-bold tabular-nums">
        <span data-testid="supra-toasts">тостов: {toasts} из {TOASTS.length}</span>
        <span data-testid="supra-warm">тёплых гостей: {warm} из {total}</span>
      </div>
    </motion.div>
  )
}
