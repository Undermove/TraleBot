import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { met as metWord, phrase } from '../story'
import { GameEnd, GameIntro, NewWord, RuleCard, TimeBanner, TimeIcon, TimeLine } from '../ui'
import { hush, speak } from '../voice'
import type { SceneProps, StepOf } from './types'
import {
  HINTS_OFF_AFTER, MEET_GAP, PART_RU, addScore, dayClock, emptyScore, judge, partAt, railAt, replies, route, routeLength, verdictText,
  type Beat, type Meeting, type Score, type WalkMode
} from './Walk.logic'
import Street, { type StreetPerson } from './walk/Street'
import type { Face } from './walk/Passerby'
import { buildStreet, project, type View } from './walk/geometry'

/**
 * «Прогулка» — от первого лица. Держишь палец на улице — идёшь, отпустил — останавливаешься. Навстречу
 * идут знакомые: остановились перед тобой — поговори. Каждый шаг разговора ждёт, пока договорят
 * предыдущий: никто не уходит, не дождавшись ответа, и голоса не накладываются. Время суток — это
 * место на улице: идёшь от утра к вечеру. Логика — Walk.logic.ts, улица — walk/.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

const INTRO: Record<WalkMode, { title: string; text: string; ids: string[] }> = {
  hello: {
    title: 'Прогулка',
    text: 'Ты идёшь по улице к морю. Навстречу — знакомые: при встрече поздоровайся, а когда расходитесь — попрощайся. Держи палец на улице — идёшь, отпусти — стоишь.',
    ids: ['gamarjoba', 'nakhvamdis']
  },
  day: {
    title: 'Прогулка: целый день',
    text: 'Ты гуляешь к морю целый день, с утра до вечера, — по дороге 6 встреч. Время меняется на ходу: смотри на небо и на плашку слева сверху. Утром, днём и вечером здороваются по-разному. Расходитесь — попрощайся.',
    ids: ['dila', 'gamarjoba', 'saghamo', 'nakhvamdis']
  },
  full: {
    title: 'Прогулка: соседи разговорились',
    text: 'Снова целый день до моря, 6 встреч. Теперь знакомые и сами здороваются первыми и спрашивают, как дела. Отвечай, здоровайся по времени суток, прощайся.',
    ids: ['dila', 'saghamo', 'gagimarjos', 'kargad_shen']
  }
}

function recap(mode: WalkMode) {
  if (mode === 'hello') return <RuleCard title="Ты заметил"><G>გამარჯობა</G> — при встрече. <G>ნახვამდის</G> — когда расходитесь.</RuleCard>
  if (mode === 'day') return <RuleCard title="Ты заметил"><G>დილა</G> — утро, <G>საღამო</G> — вечер, вторая половина <G>მშვიდობისა</G> одна и та же. <G>გამარჯობა</G> годится в любое время.</RuleCard>
  return <RuleCard title="Ты заметил">На <G>გამარჯობა</G> отвечают <G>გაგიმარჯოს</G>. На <G>როგორ ხარ?</G> — <G>კარგად, მადლობა</G>, а ещё лучше <G>კარგად, შენ?</G></RuleCard>
}

// Движение: разгон и торможение — как у человека, а не рывком.
const WALK_SPEED = 3.1 // м/с: бодрый шаг
const ACCEL = 3.2
const BRAKE = 2.6
const STEP_M = 0.75
/** Знакомые стоят чуть сбоку, по очереди слева и справа. */
const sideOf = (i: number) => (i % 2 ? -0.55 : 0.6)

type Stage = 'walk' | 'talk' | 'pass' | 'arrive'
type Turn = 'them' | 'you' | 'speaking' | 'react' | 'idle'

interface Talk {
  meeting: number
  beat: number
  turn: Turn
  their?: string
  mine?: string
  face: Face
  talking: boolean
  wave: boolean
  bad?: string
}

export default function Walk({ lesson, step, fraction, onExit, onDone, rng = Math.random, now = () => performance.now() }: SceneProps<StepOf<'walk'>>) {
  const mode = step.mode
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const meetings = useMemo(() => route(lesson.id, mode, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const length = routeLength(mode)
  const rail = railAt(mode)
  const buildings = useMemo(() => buildStreet(length, 11 + lesson.id), [lesson.id, length])
  const panel = useMemo(() => replies(lesson.id, mode), [lesson.id, mode])

  // Камера и люди — в ref: кадр 60 раз в секунду, React только перерисовывает.
  const cam = useRef({ z: 0, v: 0, step: 0, holding: false, passAt: 0, passFrom: 0 })
  const [, setFrame] = useState(0)
  const [stage, setStageState] = useState<Stage>('walk')
  const stageRef = useRef<Stage>('walk')
  const setStage = (s: Stage) => { stageRef.current = s; setStageState(s) }
  const [met, setMet] = useState(0)
  const metRef = useRef(0)
  const [talk, setTalk] = useState<Talk | null>(null)
  const [cue, setCue] = useState('Держи палец на улице — пойдёшь вперёд.')
  const [score, setScore] = useState<Score>(emptyScore)
  const [moved, setMoved] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 320 })
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])

  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 360, h: e.contentRect.height || 320 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [phase])
  const view: View = { w: 360, h: (360 * size.h) / Math.max(1, size.w), horizon: 0.5 }

  // ── Кадр: камера идёт, тормозит перед знакомым, люди шагают ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    let last = now()
    let raf = 0
    const raf_ = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => window.setTimeout(() => f(now()), 16) as unknown as number
    const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id: number) => window.clearTimeout(id)
    const tick = () => {
      const t = now()
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000))
      last = t
      const c = cam.current
      const st = stageRef.current
      const next = meetings[metRef.current]
      const stopAt = next ? next.at - MEET_GAP : rail - 11
      const left = Math.max(0, stopAt - c.z)
      let target = st === 'walk' && c.holding ? WALK_SPEED : 0
      // Мягко тормозим так, чтобы встать ровно перед знакомым.
      target = Math.min(target, Math.sqrt(2 * BRAKE * left))
      c.v += (target - c.v) * Math.min(1, dt * ACCEL)
      if (c.v < 0.01 && target === 0) c.v = 0
      const was = Math.floor(c.step / Math.PI)
      c.z = Math.min(stopAt, c.z + c.v * dt)
      c.step += (c.v * dt / STEP_M) * Math.PI
      if (Math.floor(c.step / Math.PI) !== was && c.v > 0.6) haptic('soft')
      if (st === 'walk' && left < 0.03 && c.v < 0.05) {
        if (next) startMeeting(metRef.current)
        else arrive()
      }
      setFrame(f => (f + 1) % 1_000_000)
      raf = raf_(tick)
    }
    raf = raf_(tick)
    return () => caf(raf)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Разговор ────────────────────────────────────────────────────────────────────────────────────
  const say = useCallback(async (id: string, who: 'them' | 'you', voice: 'f' | 'm' = 'f') => {
    setTalk(tk => tk && (who === 'them' ? { ...tk, their: id, talking: true } : { ...tk, mine: id }))
    await speak(id, who === 'you' ? 'hero' : voice)
    if (!alive.current) return
    setTalk(tk => tk && (who === 'them' ? { ...tk, talking: false } : tk))
  }, [])

  const openBeat = useCallback(async (mi: number, bi: number) => {
    const m = meetings[mi], b = m.beats[bi]
    setCue(bi === 0 && !b.line ? `${m.who.ru}. Поздоровайся.` : b.cue)
    setTalk(tk => tk && { ...tk, beat: bi, turn: b.line ? 'them' : 'you', mine: undefined, their: undefined, wave: !b.line && bi === 0, face: 'smile' })
    if (b.line) {
      await say(b.line, 'them', m.who.voice)
      if (!alive.current) return
      setTalk(tk => tk && { ...tk, turn: 'you' })
    }
  }, [meetings, say])

  function startMeeting(mi: number) {
    setStage('talk')
    haptic('pop')
    setTalk({ meeting: mi, beat: 0, turn: 'idle', face: 'smile', talking: false, wave: true })
    void openBeat(mi, 0)
  }

  function arrive() {
    setStage('arrive')
    sound.win(); haptic('good')
    setCue('')
    // Постоять у перил и посмотреть на море — потом итог. На набережной (урок 6) — слово ზღვა: море.
    window.setTimeout(() => alive.current && setPhase('end'), metWord(lesson.id, 'zghva') ? 4200 : 2600)
  }

  const answer = async (id: string) => {
    if (!talk || talk.turn !== 'you') return
    const m = meetings[talk.meeting]
    const b: Beat = m.beats[talk.beat]
    setTalk({ ...talk, turn: 'speaking', mine: id, bad: undefined })
    await say(id, 'you')
    if (!alive.current) return
    const v = judge(lesson.id, m, b, id)
    setScore(s => addScore(s, v.res))
    if (v.res === 'miss') {
      haptic('bad'); sound.miss()
      setCue(v.hint)
      setTalk(tk => tk && { ...tk, turn: 'you', face: 'huh', bad: id, mine: undefined })
      return
    }
    haptic('good'); sound.pop(3)
    if (v.hint) setCue(v.hint)
    const head = document.querySelector('[data-testid="walk-their-bubble"]') as HTMLElement | null
    if (head && v.res === 'bonus') burst(head, 'small')
    setTalk(tk => tk && { ...tk, turn: 'react', face: v.res === 'bonus' ? 'wow' : 'smile', wave: !!b.parting })
    const react = v.res === 'bonus' ? 'kargad_madloba' : b.react
    if (react) await say(react, 'them', m.who.voice)
    if (!alive.current) return
    if (talk.beat + 1 < m.beats.length) { void openBeat(talk.meeting, talk.beat + 1); return }
    // Попрощались: знакомый проходит мимо, ты идёшь дальше.
    const c = cam.current
    c.passAt = now(); c.passFrom = m.at
    setTalk(null)
    setStage('pass')
    metRef.current = talk.meeting + 1
    setMet(metRef.current)
    setCue(metRef.current < meetings.length ? 'Иди дальше — держи палец на улице.' : 'Впереди море. Держи палец — дойди до набережной.')
    window.setTimeout(() => { if (alive.current && stageRef.current === 'pass') setStage('walk') }, 650)
  }

  const start = () => {
    cam.current = { z: 0, v: 0, step: 0, holding: false, passAt: 0, passFrom: 0 }
    metRef.current = 0; setMet(0); setScore(emptyScore()); setTalk(null); setStage('walk'); setMoved(false)
    setCue('Держи палец на улице — пойдёшь вперёд.')
    setPhase('play')
  }

  const hold = (on: boolean) => {
    cam.current.holding = on
    if (on && !moved) setMoved(true)
  }

  // ── Кадр: кто на улице ──────────────────────────────────────────────────────────────────────────
  const c = cam.current
  const bob = Math.sin(c.step * 2) * 0.025 * Math.min(1, c.v / WALK_SPEED)
  const people: StreetPerson[] = []
  meetings.forEach((m, i) => {
    const x = sideOf(i)
    if (i === met && (stage === 'walk' || stage === 'talk')) {
      // Идёт навстречу: пока ты далеко, он тоже шагает к тебе; встал — разговариваете.
      const gap = Math.max(0, m.at - MEET_GAP - c.z)
      // Идёт навстречу бодро: сходитесь быстрее, чем идёшь один.
      const z = m.at + gap * 1.2
      const walking = stage === 'walk' && gap > 0.05
      people.push({
        id: i, who: m.who, x, z, phase: c.step * 0.9 + (walking ? (now() / 300) : 0), stride: walking ? 1 : 0,
        face: talk?.face ?? 'calm', talking: !!talk?.talking, wave: stage === 'talk' && !!talk?.wave
      })
    } else if (i === met - 1 && (stage === 'pass' || stage === 'walk')) {
      // Попрощались: делает шаг в сторону и проходит мимо.
      const p = Math.min(1, (now() - c.passAt) / 2300)
      if (p < 1) {
        const e = p * p * (3 - 2 * p)
        // Проходит мимо плеча: шаг в сторону и вперёд, к краю кадра, — и уходит за него, а не исчезает.
        people.push({ id: i, who: m.who, x: x + Math.sign(x) * 2.8 * e, z: m.at - (m.at - (c.z + 1.1)) * e, phase: now() / 260, stride: 1, face: 'smile', talking: false, wave: p < 0.35 })
      }
    }
  })

  const clock = dayClock(mode, c.z)
  const part = partAt(mode, c.z)
  // Время сменилось — на пару секунд плашка «наступил вечер», игра не останавливается.
  const [turned, setTurned] = useState<typeof part | undefined>()
  const lastPart = useRef(part)
  useEffect(() => {
    if (phase !== 'play') { lastPart.current = part; return }
    if (part === lastPart.current) return
    lastPart.current = part
    setTurned(part); haptic('soft')
    const id = window.setTimeout(() => setTurned(undefined), 2600)
    return () => window.clearTimeout(id)
  }, [part, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const current: Meeting | undefined = talk ? meetings[talk.meeting] : undefined
  const head = current ? project(view, c.z, sideOf(talk!.meeting), current.who.kind === 'kid' ? 1.28 : 1.92, current.at, bob) : null
  const hints = score.right + score.soft < HINTS_OFF_AFTER

  const title = INTRO[mode].title
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="walk-scene">
          <GameIntro title={title} text={INTRO[mode].text} onStart={start} hero
            plan={mode === 'hello' ? undefined : <TimeLine steps={(['morning', 'day', 'evening'] as const).map(p => ({ part: p, label: PART_RU[p] }))} />}
            chips={INTRO[mode].ids.map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
         <GameEnd title="Ты у моря!" text={verdictText(score, mode)} rule={recap(mode)} onNext={onDone} onAgain={start} />
      </GameFrame>
    )
  }

  return (
    <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="walk-scene">
        <div
          ref={box}
          data-testid="walk-street"
          className="relative flex-1 min-h-[220px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden select-none touch-none"
          style={{ boxShadow: '3px 3px 0 #15100A' }}
          onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); hold(true) }}
          onPointerUp={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onPointerLeave={() => hold(false)}
          onContextMenu={e => e.preventDefault()}
        >
          <Street view={view} camZ={c.z} clock={clock} bob={bob} buildings={buildings} people={people} end={length} rail={rail} time={now()} />

          {/* Время суток и сколько встреч позади. */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2.5 py-0.5 text-[12px] font-extrabold" data-testid="walk-part">
            <TimeIcon part={part} /> {PART_RU[part]}
          </div>
          {turned && <TimeBanner key={turned} part={turned} text={turned === 'day' ? 'Наступил день' : turned === 'evening' ? 'Наступил вечер' : 'Утро'} />}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-cream/90 border-[1.5px] border-jewelInk px-2 py-1" aria-label={`Встреч: ${met} из ${meetings.length}`} data-testid="walk-met">
            <span className="text-[11px] font-extrabold mr-0.5">встречи {met}/{meetings.length}</span>
            {meetings.map((_, i) => (
              <motion.span key={i} className="block w-2.5 h-2.5 rounded-full border-[1.5px] border-jewelInk"
                animate={{ backgroundColor: i < met ? '#4E8A5B' : '#FDFAEF', scale: i === met - 1 ? [1, 1.5, 1] : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }} />
            ))}
          </div>

          {/* Реплика знакомого — над головой, держится, пока не ответишь. */}
          <AnimatePresence>
            {talk?.their && head && (
              // Снаружи — где стоит (центр над головой), внутри — пружина: transform анимации не трогает позицию.
              <div key={`${talk.meeting}-${talk.their}`} className="absolute z-10 -translate-x-1/2 -translate-y-full pb-2"
                style={{ left: `${(head.x / view.w) * 100}%`, top: `${(head.y / view.h) * 100}%` }}>
                <motion.div
                  data-testid="walk-their-bubble"
                  style={{ transformOrigin: '50% 100%' }}
                  initial={{ opacity: 0, scale: 0.55, y: 12, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.85, y: -6, filter: 'blur(3px)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                >
                  <SpeechBubble id={talk.their} hint={hints} tail="down" />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Твоя реплика — снизу, от тебя. */}
          <AnimatePresence>
            {talk?.mine && (
              <div key={`mine-${talk.meeting}-${talk.beat}-${talk.mine}`} className="absolute z-10 bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <motion.div
                  data-testid="walk-my-bubble"
                  style={{ transformOrigin: '50% 100%' }}
                  initial={{ opacity: 0, y: 34, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 14, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                >
                  <SpeechBubble id={talk.mine} hint={hints} mine />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {stage === 'arrive' && (
              <div className="absolute inset-x-0 top-[18%] flex justify-center pointer-events-none">
                <motion.div data-testid="walk-arrived" className="rounded-2xl border-[1.5px] border-jewelInk bg-cream/95 px-4 py-2 text-[18px] font-extrabold"
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                  initial={{ opacity: 0, y: -16, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 }}>
                  Ты у моря
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stage === 'arrive' && metWord(lesson.id, 'zghva') && (
              <div className="absolute inset-x-0 top-[34%] flex justify-center">
                <motion.div initial={{ opacity: 0, y: 20, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.9 }}>
                  <NewWord word={phrase('zghva')} testId="walk-new-word" />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Подсказка «держи палец», пока человек ни разу не пошёл. */}
          <AnimatePresence>
            {stage === 'walk' && !moved && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <motion.div className="flex items-center gap-2 rounded-full bg-cream/95 border-[1.5px] border-jewelInk px-3 py-1.5 text-[13px] font-bold whitespace-nowrap"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} data-testid="walk-hold-hint">
                  <motion.span animate={{ scale: [1, 0.82, 1] }} transition={{ duration: 1.1, repeat: Infinity }} className="inline-flex"><FingerIcon /></motion.span>
                  Держи палец на улице
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 min-h-[40px] text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite" data-testid="walk-cue">{cue}</div>

        <div className={`shrink-0 grid gap-2 ${panel.length > 4 ? 'grid-cols-3' : 'grid-cols-2'}`} data-testid="walk-replies"
          data-want={talk?.turn === 'you' ? meetings[talk.meeting].beats[talk.beat].want : undefined}>
          {panel.map(id => {
            const ready = stage === 'talk' && talk?.turn === 'you'
            const bad = talk?.bad === id
            return (
              <motion.button
                key={id}
                data-testid={`walk-reply-${id}`}
                disabled={!ready}
                onClick={() => { haptic('tap'); void answer(id) }}
                className="min-h-[52px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-2 py-1.5 text-center disabled:cursor-default"
                style={{ boxShadow: '3px 3px 0 #15100A' }}
                animate={{ opacity: ready ? 1 : 0.45, y: ready ? 0 : 3, x: bad ? [0, -6, 6, -4, 4, 0] : 0, backgroundColor: bad ? '#F7DCDD' : '#FDFAEF' }}
                whileTap={ready ? { scale: 0.95, y: 2 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <span className="block font-geo font-bold leading-tight text-[16px] break-words">{phrase(id).geo}</span>
                <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{hints ? phrase(id).ru : cyr(phrase(id).geo)}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </GameFrame>
  )
}

export function SpeechBubble({ id, hint, mine, tail }: { id: string; hint: boolean; mine?: boolean; tail?: 'down' }) {
  const p = phrase(id)
  return (
    <div className={`relative rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 text-center whitespace-nowrap ${mine ? 'bg-navy text-cream' : 'bg-cream-tile'}`} style={{ boxShadow: '2px 3px 0 #15100A' }}>
      <span className="block font-geo font-bold text-[17px] leading-tight">{p.geo}</span>
      <span className={`block text-[11px] font-semibold leading-tight ${mine ? 'text-cream/80' : 'text-jewelInk-hint'}`}>{hint ? p.ru : cyr(p.geo)}</span>
      {tail === 'down' && (
        <span className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-cream-tile border-r-[1.5px] border-b-[1.5px] border-jewelInk" />
      )}
    </div>
  )
}

function FingerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <path d="M8 2.5a1.6 1.6 0 0 1 3.2 0V9l3.6 0.9a2 2 0 0 1 1.5 2.3l-0.8 4.2A2.4 2.4 0 0 1 13.1 18.5H9.4a2.4 2.4 0 0 1-2-1.1L4.2 12.6a1.4 1.4 0 0 1 2.2-1.7L8 12.4Z"
        fill="#FDFAEF" stroke="#15100A" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
