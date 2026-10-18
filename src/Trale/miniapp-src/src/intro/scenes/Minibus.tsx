import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { phrase } from '../story'
import { Banner, GameEnd, GameIntro, NewWord, RuleCard } from '../ui'
import { hush, speak } from '../voice'
import type { SceneProps, StepOf } from './types'
import { HINTS_OFF_AFTER, MY_STOP, STOPS, STOP_RU, heardBy, judge, replies, ride, type RideEvent, type Speaker, type Stop } from './Minibus.logic'
import type { Who } from './Walk.logic'
import Passerby, { type Face } from './walk/Passerby'
import { SpeechBubble } from './Walk'

/**
 * «Маршрутка» — едешь в университет. Скамейки друг напротив друга: перед тобой пассажиры, за ними
 * окно, в окне плывёт Батуми. Сдача, поворот, остановки, уроненная перчатка, торможение, выход — каждое
 * событие ждёт ответа. На поворотах салон кренит, на торможении бросает вперёд, вибрация в такт.
 * Новые слова — там, где они в жизни: გაჩერება на табличке, «აქ?» водителя, «გამიჩერეთ!» пассажира сзади.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

const NEIGHBOUR: Who = { ru: 'Сосед', kind: 'man', coat: '#4E8A5B', skin: '#E0AC7E', hair: '#2A1F18', extra: 'glasses', voice: 'm' }
const LADY: Who = { ru: 'Женщина', kind: 'woman', coat: '#7A4E9A', skin: '#F2C9A0', hair: '#5A3A22', extra: 'bag', voice: 'f' }
const DRIVER: Who = { ru: 'Водитель', kind: 'man', coat: '#2F3A4E', skin: '#C68A5E', hair: '#15100A', extra: 'cap', voice: 'm' }

export default function Minibus({ lesson, onExit, onDone, fraction }: SceneProps<StepOf<'minibus'>>) {
  const events = useMemo(() => ride(), [])
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [ei, setEi] = useState(0)
  const [ready, setReady] = useState(false)
  const [moving, setMoving] = useState(true)
  const [mine, setMine] = useState<string | undefined>()
  const [their, setTheir] = useState<string | undefined>()
  const [bad, setBad] = useState<string | undefined>()
  const [cue, setCue] = useState('')
  const [faces, setFaces] = useState<{ n: Face; l: Face; d: Face }>({ n: 'calm', l: 'calm', d: 'calm' })
  const [right, setRight] = useState(0)
  const [misses, setMisses] = useState(0)
  const [stopAt, setStopAt] = useState(-1)
  const [by, setBy] = useState<Speaker>('d')
  const [word, setWord] = useState<string | undefined>()
  const shown = useRef(new Set<string>())
  const cabin = useAnimationControls()
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

  const e: RideEvent = events[Math.min(ei, events.length - 1)]
  const hints = right < HINTS_OFF_AFTER
  // Перевод под кнопками пропадает — говорим об этом, а не меняем молча.
  const [noRu, setNoRu] = useState(false)
  useEffect(() => {
    if (phase !== 'play' || right !== HINTS_OFF_AFTER) return
    setNoRu(true)
    const id = window.setTimeout(() => { if (alive.current) setNoRu(false) }, 2800)
    return () => window.clearTimeout(id)
  }, [right, phase])
  const panel = replies(lesson.id, heardBy(events, ei))
  const fresh = (id: string) => { if (shown.current.has(id)) return false; shown.current.add(id); setWord(id); return true }
  const voiceOf = (who: Speaker) => (who === 'd' || who === 'n' ? 'm' : 'f')

  // Событие: маршрутка едет пару секунд — и что-то случается.
  useEffect(() => {
    if (phase !== 'play') return
    let off = false
    setReady(false); setMine(undefined); setTheir(undefined); setBad(undefined)
    setFaces({ n: 'calm', l: 'calm', d: 'calm' })
    ;(async () => {
      setMoving(true); setCue('Едешь…')
      await wait(ei === 0 ? 900 : 1600)
      if (off || !alive.current) return
      const ev = events[ei]
      if (ev.kind === 'stop' || ev.kind === 'exit') {
        setMoving(false); haptic('soft'); sound.pop(1)
        if (ev.stop) setStopAt(STOPS.indexOf(ev.stop))
        setFaces(f => ({ ...f, d: 'smile' }))
        // Первая остановка — знакомимся с табличкой.
        if (ev.stop && !shown.current.has('gachereba')) { fresh('gachereba'); await wait(1400); if (off || !alive.current) return }
      }
      if (ev.kind === 'call' && ev.stop) setStopAt(STOPS.indexOf(ev.stop) - 1)
      // Реплики до твоего ответа: водитель спрашивает, кто-то сзади кричит.
      for (const l of ev.lines ?? []) {
        setBy(l.by); setTheir(l.id)
        if (!shown.current.has(l.id)) fresh(l.id)
        if (l.id === 'gamicheret') { haptic('soft') }
        await speak(l.id, voiceOf(l.by))
        if (off || !alive.current) return
        if (l.id === 'gamicheret') { setMoving(false); haptic('snap'); void cabin.start({ x: [0, -14, 4, 0], transition: { duration: 0.6 } }); await wait(500) }
      }
      if (ev.kind === 'lurch') {
        haptic('snap')
        void cabin.start({ rotate: [0, -5, 2.5, -1, 0], x: [0, 14, -6, 2, 0], transition: { duration: 0.9 } })
        setFaces(f => ({ ...f, n: 'huh' }))
      }
      if (ev.kind === 'brake') {
        setMoving(false); haptic('snap')
        void cabin.start({ x: [0, -22, 6, 0], transition: { duration: 0.7 } })
        setFaces(f => ({ ...f, l: 'huh' }))
      }
      if (ev.kind === 'change') setFaces(f => ({ ...f, n: 'smile' }))
      if (ev.kind === 'glove') setFaces(f => ({ ...f, l: 'smile' }))
      setCue(ev.cue); setReady(true); busy.current = false
    })()
    return () => { off = true }
  }, [phase, ei]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (id: string) => {
    if (!ready || busy.current) return
    busy.current = true
    setReady(false); setMine(id); setBad(undefined); setWord(undefined)
    await speak(id, 'hero')
    if (!alive.current) return
    const v = judge(e, id)
    if (v.res === 'miss') {
      haptic('bad'); sound.miss(); setMisses(m => m + 1)
      setBad(id); setCue(v.hint); setMine(undefined); setReady(true); busy.current = false
      return
    }
    haptic('good'); sound.pop(3); setRight(r => r + 1)
    const who = e.kind === 'glove' || e.kind === 'brake' ? 'l' : e.kind === 'stop' || e.kind === 'exit' ? 'd' : 'n'
    setFaces(f => ({ ...f, [who]: 'smile' }))
    if (e.kind === 'call') {
      // Водитель услышал — тормозит у университета.
      setMoving(false); haptic('snap'); sound.pop(1)
      void cabin.start({ x: [0, -22, 6, 0], transition: { duration: 0.7 } })
      if (e.stop) setStopAt(STOPS.indexOf(e.stop))
    }
    if (e.react) { setBy('d'); setTheir(e.react); await speak(e.react, 'm') }
    await wait(500)
    if (!alive.current) return
    if (ei + 1 < events.length) setEi(x => x + 1)
    else { sound.win(); setPhase('end') }
  }

  const start = () => { setEi(0); setRight(0); setMisses(0); setStopAt(-1); shown.current.clear(); setWord(undefined); setPhase('play') }

  const title = 'Маршрутка'
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="minibus-scene">
          <GameIntro title="Маршрутка до университета" text={`Ты едешь на маршрутке в университет — по дороге ${events.length} ситуаций. Передать за проезд, налететь на соседа на повороте, ответить водителю, твоя ли остановка, — тут пригодятся спасибо, извините, да и нет. А на своей остановке не забудь крикнуть водителю.`} onStart={start} hero
            chips={['madloba', 'bodishi', 'ki', 'ara'].map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <GameEnd title="Доехал!" text={misses === 0 ? 'Вежливый пассажир: ни одной ошибки. Водитель тебя запомнит.' : 'Доехал — и уже знаешь, где «спасибо», а где «извините».'}
          rule={<RuleCard title="Ты заметил"><G>მადლობა</G> — спасибо, когда тебе помогли. <G>ბოდიში</G> — извините, когда задел. <G>კი</G> — да, <G>არა</G> — нет.</RuleCard>}
          onNext={onDone} onAgain={start} />
      </GameFrame>
    )
  }

  return (
    <GameFrame title={title} eyebrow={`едешь в университет · ${Math.min(ei + 1, events.length)} из ${events.length}`} fraction={fraction} onExit={onExit}>
      <div className="relative flex-1 min-h-0 flex flex-col gap-2.5" data-testid="minibus-scene">
        <Route at={stopAt} />
        <div className="relative flex-1 min-h-[250px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden bg-[#3A3550]" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="minibus-cabin">
          <motion.div className="absolute inset-[-14px]" animate={cabin}>
            <Outside moving={moving} stop={(e.kind === 'stop' && !moving) || (e.kind === 'call' && ready) ? e.stop : undefined} />
            <Cabin />
            {/* Пассажиры напротив и водитель впереди. */}
            <div className="absolute left-[3%] top-[30%] z-10">
              <svg width="80" height="128" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                <Passerby who={DRIVER} phase={0} stride={0} face={faces.d} talking={!!their && by === 'd'} wave={false} />
              </svg>
            </div>
            <div className="absolute left-[33%] top-[38%] z-10">
              <svg width="96" height="152" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                <Passerby who={LADY} phase={0} stride={0} face={faces.l} talking={false} wave={e.kind === 'glove' && ready} />
              </svg>
            </div>
            <div className="absolute left-[63%] top-[38%] z-10">
              <svg width="96" height="152" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                <Passerby who={NEIGHBOUR} phase={0} stride={0} face={faces.n} talking={false} wave={e.kind === 'change' && ready} />
              </svg>
            </div>
            <Bench />
          </motion.div>

          {/* Что происходит прямо перед тобой: сдача в ладони, перчатка, «?» водителя. */}
          <AnimatePresence>
            {ready && e.kind === 'change' && (
              <motion.div key="coins" className="absolute z-20 right-[16%] bottom-[16%] flex gap-1" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
                {[0, 1, 2].map(k => <span key={k} className="w-6 h-6 rounded-full border-[1.5px] border-jewelInk bg-gold flex items-center justify-center text-[10px] font-extrabold">₾</span>)}
              </motion.div>
            )}
            {ready && e.kind === 'glove' && (
              <motion.div key="glove" className="absolute z-20 left-[42%] bottom-[18%]" initial={{ y: -30, opacity: 0, rotate: -30 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden><path d="M10 40 V18 q0 -4 4 -4 V8 q0 -3 3 -3 q3 0 3 3 V14 V6 q0 -3 3 -3 q3 0 3 3 V14 V8 q0 -3 3 -3 q3 0 3 3 V24 q4 -4 6 -1 L30 40 Z" fill="#E01A3C" stroke="#15100A" strokeWidth="2" strokeLinejoin="round" /></svg>
              </motion.div>
            )}
            {ready && e.kind === 'stop' && (
              <motion.div key={`q${ei}`} className="absolute z-20 left-[13%] top-[6%] w-9 h-9 rounded-full border-[1.5px] border-jewelInk bg-cream flex items-center justify-center text-[20px] font-extrabold"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} data-testid="minibus-ask">?</motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {their && (
              <div key={`t-${ei}-${their}`} className={`absolute z-30 ${by === 'back' ? 'right-[4%] top-[4%]' : 'left-[4%] top-[4%]'}`} data-testid="minibus-their">
                {by === 'back' && <div className="text-[10px] font-extrabold uppercase tracking-wider text-cream text-right mb-0.5">сзади кричат</div>}
                <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
                  <SpeechBubble id={their} hint={hints} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {/* Новое слово — карточкой, пока не ответишь. */}
          <AnimatePresence mode="wait">
            {word && (
              <motion.div key={word} className="absolute z-30 right-[3%] top-[40%]" initial={{ opacity: 0, y: 16, rotate: 5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 360, damping: 20 }}>
                <NewWord word={phrase(word)} testId="minibus-new-word" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {mine && (
              <div key={`m-${ei}-${mine}`} className="absolute z-30 bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <motion.div data-testid="minibus-mine" initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                  <SpeechBubble id={mine} hint={hints} mine />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 min-h-[40px] text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite" data-testid="minibus-cue">{cue}</div>
        {noRu && <Banner text="Дальше без перевода — ты уже знаешь эти слова" testId="minibus-no-ru" />}

        <div className="shrink-0 grid grid-cols-3 gap-2" data-testid="minibus-replies" data-want={ready ? e.want : undefined}>
          {panel.map(id => (
            <motion.button key={id} data-testid={`minibus-reply-${id}`} disabled={!ready} onClick={() => { haptic('tap'); void answer(id) }}
              className="min-h-[52px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-1 py-1 text-center"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              animate={{ opacity: ready ? 1 : 0.45, x: bad === id ? [0, -6, 6, -4, 4, 0] : 0, backgroundColor: bad === id ? '#F7DCDD' : '#FDFAEF' }}
              whileTap={ready ? { scale: 0.93, y: 2 } : undefined}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              <span className="block font-geo font-bold leading-tight text-[15px]">{phrase(id).geo}</span>
              <span className="block text-[10px] font-semibold text-jewelInk-hint leading-tight">{hints ? phrase(id).ru : cyr(phrase(id).geo)}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}

/** Значки остановок — без надписей на улице, только картинки. */
function StopIcon({ stop, size = 22 }: { stop: Stop; size?: number }) {
  const INK = '#15100A'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {stop === 'sea' && <><path d="M2 14 q3 -3 5 0 t5 0 t5 0 t5 0" fill="none" stroke="#1B5FB0" strokeWidth="2.2" /><path d="M2 19 q3 -3 5 0 t5 0 t5 0 t5 0" fill="none" stroke="#1B5FB0" strokeWidth="2.2" /><circle cx="17" cy="6" r="3.2" fill="#F5B820" stroke={INK} strokeWidth="1.2" /></>}
      {stop === 'piazza' && <><rect x="8" y="4" width="8" height="17" fill="#E8C3A6" stroke={INK} strokeWidth="1.4" /><circle cx="12" cy="10" r="2.6" fill="#FDFAEF" stroke={INK} strokeWidth="1.2" /><path d="M6 4 L12 0.5 L18 4 Z" fill="#C2553A" stroke={INK} strokeWidth="1.2" /></>}
      {stop === 'tower' && <><rect x="10.6" y="4" width="2.8" height="18" fill="#3A2F5A" stroke={INK} strokeWidth="1" /><path d="M8 18 q4 -3 8 0 M8 13 q4 -3 8 0 M8 8 q4 -3 8 0" fill="none" stroke="#7A4E9A" strokeWidth="1.6" /><circle cx="12" cy="3" r="2.4" fill="#F5B820" stroke={INK} strokeWidth="1" /></>}
      {stop === 'uni' && <><path d="M2 9 L12 3 L22 9 Z" fill="#E8D2AE" stroke={INK} strokeWidth="1.4" /><path d="M5 10 V18 M9.5 10 V18 M14.5 10 V18 M19 10 V18" stroke={INK} strokeWidth="2" /><rect x="3" y="18" width="18" height="3" fill="#E8D2AE" stroke={INK} strokeWidth="1.2" /></>}
    </svg>
  )
}

/** Маршрут сверху: остановки значками, маршрутка — между ними; справа — твой билет. */
function Route({ at }: { at: number }) {
  return (
    <div className="shrink-0 flex items-center gap-2" data-testid="minibus-route">
      <div className="relative flex-1 flex items-center justify-between rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-2 py-1.5" style={{ boxShadow: '2px 2px 0 #15100A' }}>
        <div className="absolute left-4 right-4 top-1/2 h-[3px] -translate-y-1/2 bg-jewelInk/25 rounded-full" />
        {STOPS.map((s, i) => (
          <div key={s} className="relative z-10 flex flex-col items-center" aria-label={STOP_RU[s]}>
            <motion.div className="rounded-lg border-[1.5px] border-jewelInk bg-cream p-0.5" animate={{ scale: i === at ? 1.18 : 1, backgroundColor: i < at ? '#D6E9D9' : i === at ? '#FCE9A8' : '#FDFAEF' }}>
              <StopIcon stop={s} />
            </motion.div>
          </div>
        ))}
      </div>
      <div className="shrink-0 rounded-xl border-[1.5px] border-dashed border-jewelInk bg-gold-wash px-2 py-1 flex flex-col items-center" data-testid="minibus-ticket" style={{ boxShadow: '2px 2px 0 #15100A' }}>
        <StopIcon stop={MY_STOP} size={26} />
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-jewelInk-mid leading-none mt-0.5">тебе сюда</span>
      </div>
    </div>
  )
}

/** Город за окном: дома и пальмы едут, на остановке — табличка со значком. */
function Outside({ moving, stop }: { moving: boolean; stop?: Stop }) {
  return (
    <div className="absolute left-[24%] right-[4%] top-[10%] h-[34%] overflow-hidden bg-[#9CC6EE]">
      <motion.div className="absolute inset-y-0 left-0 flex items-end" style={{ width: '300%' }}
        animate={moving ? { x: ['0%', '-50%'] } : { x: undefined }} transition={moving ? { duration: 6, repeat: Infinity, ease: 'linear' } : { duration: 0 }}>
        {Array.from({ length: 2 }, (_, k) => (
          <svg key={k} viewBox="0 0 600 120" preserveAspectRatio="none" width="50%" height="100%" aria-hidden>
            {[[0, 50, '#F1D9B5'], [70, 30, '#CFE0CF'], [130, 60, '#E8C3A6'], [210, 40, '#D9CBE3'], [290, 55, '#F4E7C8'], [380, 35, '#F2C9B8'], [450, 62, '#CDE0EA'], [530, 44, '#E6D3A8']].map(([x, h, c], i) => (
              <g key={i}>
                <rect x={x as number} y={120 - 40 - (h as number)} width="64" height={40 + (h as number)} fill={c as string} stroke="#15100A" strokeWidth="1.4" />
                {[0, 1].map(r => [0, 1, 2].map(cc => <rect key={`${r}${cc}`} x={(x as number) + 8 + cc * 18} y={120 - 30 - (h as number) + r * 22} width="10" height="12" fill="#8FB3D4" stroke="#15100A" strokeWidth="1" />))}
              </g>
            ))}
            {[60, 260, 470].map(x => <g key={x}><path d={`M${x} 120 v-46`} stroke="#7A4E2D" strokeWidth="4" /><circle cx={x} cy="70" r="14" fill="#4E8A5B" stroke="#15100A" strokeWidth="1.4" /></g>)}
          </svg>
        ))}
      </motion.div>
      <AnimatePresence>
        {stop && (
          <motion.div key={stop} className="absolute right-[18%] bottom-1 flex flex-col items-center" initial={{ x: 80 }} animate={{ x: 0 }} exit={{ x: -120 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} data-testid="minibus-stop-sign">
            <div className="rounded-md border-[1.5px] border-jewelInk bg-cream px-1 pt-0.5 flex flex-col items-center">
              <span className="font-geo text-[9px] font-bold leading-none text-navy">{phrase('gachereba').geo}</span>
              <StopIcon stop={stop} size={26} />
            </div>
            <div className="w-1 h-6 bg-jewelInk" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Салон: потолок с поручнем и петлями, окна, лобовое стекло слева. */
function Cabin() {
  const INK = '#15100A'
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="none" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      {/* Стены вокруг окна (окно — вырез, за ним город). */}
      <path fillRule="evenodd" d="M0 0 H360 V300 H0 Z M86 30 H346 V132 H86 Z" fill="#E6D8C0" stroke={INK} strokeWidth="2" />
      <path d="M86 30 H346 V132 H86 Z" fill="none" stroke={INK} strokeWidth="3" />
      {[172, 258].map(x => <rect key={x} x={x - 3} y="30" width="6" height="102" fill="#B9AA90" stroke={INK} strokeWidth="1.2" />)}
      {/* Лобовое стекло и руль водителя. */}
      <path d="M0 20 L70 34 V150 L0 170 Z" fill="#9CC6EE" stroke={INK} strokeWidth="2" opacity="0.9" />
      <rect x="46" y="10" width="26" height="12" rx="3" fill="#2F3A4E" stroke={INK} strokeWidth="1.4" />
      {/* Поручень и петли. */}
      <path d="M80 16 H356" stroke="#9AA3B5" strokeWidth="5" />
      {[120, 180, 240, 300].map(x => <g key={x}><path d={`M${x} 16 v10`} stroke="#2F3A4E" strokeWidth="2.4" /><circle cx={x} cy="32" r="6" fill="none" stroke="#2F3A4E" strokeWidth="2.6" /></g>)}
      {/* Скамейка напротив. */}
      <rect x="80" y="196" width="280" height="22" rx="6" fill="#1B5FB0" stroke={INK} strokeWidth="2" />
      <rect x="80" y="150" width="280" height="48" rx="8" fill="#2D6FBF" stroke={INK} strokeWidth="2" />
      <rect x="80" y="218" width="280" height="82" fill="#3A3550" />
    </svg>
  )
}

/** Передний край сиденья напротив, приборная панель водителя и твоя скамейка — поверх людей: они сидят. */
function Bench() {
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="none" width="100%" height="100%" className="absolute inset-0 z-[15] pointer-events-none" aria-hidden>
      <rect x="80" y="192" width="280" height="26" rx="7" fill="#1B5FB0" stroke="#15100A" strokeWidth="2" />
      <rect x="80" y="218" width="280" height="82" fill="#3A3550" />
      <path d="M80 218 H360" stroke="#15100A" strokeWidth="2" />
      <path d="M0 150 L76 140 V300 H0 Z" fill="#2F3A4E" stroke="#15100A" strokeWidth="2" />
      <circle cx="54" cy="150" r="16" fill="none" stroke="#15100A" strokeWidth="5" />
      <path d="M0 262 Q180 248 360 262 V300 H0 Z" fill="#1B5FB0" stroke="#15100A" strokeWidth="2.4" />
      <path d="M0 274 Q180 262 360 274" stroke="#FDFAEF" strokeWidth="1.4" opacity="0.4" fill="none" />
    </svg>
  )
}
