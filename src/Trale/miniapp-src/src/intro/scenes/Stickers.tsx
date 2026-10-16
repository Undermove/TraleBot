import React, { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform, useVelocity } from 'framer-motion'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { phrase, type Rng } from '../story'
import { Bubble, Face, Pill, Tip, say } from '../ui'
import { Transformed } from './Magnets'
import { MAGNET_RU, type MagnetSet, type Tool } from './Magnets.logic'
import { advance, choose, current, startGame, toolsFor, why, type EndingsResult, type Game, type Round } from './Endings.logic'

/**
 * Окончания — наклейки. Нино спрашивает, твой ответ написан на вещи из этой ситуации: «откуда» — на бирке
 * чемодана, «где живёшь» — на адресе открытки, имя — на бейдже. Отклей наклейку с листа и тащи пальцем:
 * она едет за пальцем, наклоняется по ходу, у слова её притягивает — и она прилипает. Неверная отлетает
 * обратно на лист. Можно и просто нажать на наклейку — она сама полетит к слову.
 * Вибрация на каждом шаге: отклеил, притянуло, прилипло, отскочило.
 */

const NINO = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }
/** На каком расстоянии от слова наклейку начинает тянуть. */
const PULL = 70

function label(t: Tool) { return t === 'none' ? 'как есть' : t === 'ი' ? 'ი' : `-${t}` }
function sub(t: Tool) { return t === 'none' ? 'без ი' : t === 'ი' ? 'гласная' : MAGNET_RU[t] }
const COLOR: Record<Tool, string> = { 'ში': '#1B5FB0', 'დან': '#E01A3C', 'ი': '#4E8A5B', none: '#C68F10' }

/** На какой вещи написан ответ этого раунда. */
type Thing = 'tag' | 'card' | 'badge'
const thingOf = (r: Round): Thing => (r.item.tool === 'დან' ? 'tag' : r.item.tool === 'ში' ? 'card' : 'badge')

export default function Stickers({ set, rng = Math.random, onEnd }: { set: MagnetSet; rng?: Rng; onEnd: (r: EndingsResult) => void }) {
  const [g, setG] = useState<Game>(() => startGame(set, rng))
  const [solved, setSolved] = useState(false)
  const [near, setNear] = useState(false)
  const [shake, setShake] = useState(false)
  const [tip, setTip] = useState('')
  const [sheet, setSheet] = useState(0) // новый лист наклеек — новые экземпляры
  const slot = useRef<HTMLSpanElement>(null)
  const wordEl = useRef<HTMLSpanElement>(null)
  const later = useLater()
  const busy = useRef(false)
  const r = current(g)
  if (!r) return null
  const tools = toolsFor(set)

  /** Наклейка решила, куда ей: на слово (true) или обратно на лист. */
  const land = (tool: Tool): boolean => {
    if (busy.current) return false
    const res = choose(g, tool)
    setG(res.game)
    if (res.verdict === 'miss') {
      haptic('bad'); sound.miss()
      setShake(true); later(() => setShake(false), 420)
      setTip(why(r, tool))
      return false
    }
    busy.current = true
    haptic('good'); sound.snap(3)
    setTip(''); setSolved(true)
    floater(`+${res.points}`, wordEl.current, '#4E8A5B')
    if (res.game.combo >= 3) burst(wordEl.current, 'small')
    later(() => say(r.item.result), 600)
    later(() => {
      const next = advance(res.game)
      if (next.at >= next.rounds.length) { onEnd({ done: next.rounds.length, total: next.rounds.length, score: next.score, best: next.best }); return }
      setG(next); setSolved(false); setSheet(s => s + 1); busy.current = false
    }, 1900)
    return true
  }

  const firstTip = set === 'name'
    ? 'Нужна ли имени ი? Оторви наклейку и прилепи к имени.'
    : 'Оторви наклейку с окончанием и прилепи к концу слова.'

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="endings">
      <div className="shrink-0 flex items-center justify-between gap-2">
        <Pill testId="endings-round">{g.at + 1} / {g.rounds.length}</Pill>
        {g.combo >= 2 && <Pill testId="endings-combo">серия ×{g.combo}</Pill>}
        <Pill testId="endings-score">{g.score} очков</Pill>
      </div>

      <div className="shrink-0 flex items-end gap-2">
        <Face look={NINO} size={36} />
        <Bubble className="text-left">
          {r.ask.phrase
            ? <><span className="font-geo font-bold text-[15px]">{phrase(r.ask.phrase).geo}</span><span className="block text-[11px] text-jewelInk-hint">{r.ask.ru}</span></>
            : <span className="text-[14px] font-bold">{r.ask.ru}</span>}
        </Bubble>
      </div>
      <div className="shrink-0 text-center text-[12px] font-bold text-navy">ты хочешь сказать: «{r.goal}»</div>

      {/* Вещь с ответом — бирка, открытка или бейдж; в конце слова — место для наклейки. */}
      <div className="relative flex-1 min-h-[150px] flex items-center justify-center" data-testid="endings-answer" data-tool={r.item.tool}>
        <motion.div key={g.at} initial={{ y: 30, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: thingOf(r) === 'card' ? -2 : 0, x: shake ? [0, -8, 8, -5, 5, 0] : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
          <Thing thing={thingOf(r)}>
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 font-geo font-extrabold text-[22px] leading-tight">
              <span>{r.lead}</span>
              <span ref={wordEl} data-testid="endings-word" className="inline-flex items-baseline">
                {solved
                  ? <Transformed key={g.at} item={r.item} size={22} />
                  : <>{r.item.base}<motion.span ref={slot} data-testid="sticker-slot"
                      className="inline-block ml-0.5 rounded-md border-[1.5px] border-dashed align-middle"
                      style={{ width: 30, height: 24 }}
                      animate={{ scale: near ? 1.25 : 1, borderColor: near ? '#4E8A5B' : '#15100A66', backgroundColor: near ? '#D6E9D9' : '#FFFFFF00' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 26 }} /></>}
              </span>
            </div>
            <div className="text-center text-[11px] font-semibold text-jewelInk-hint">{cyr(`${r.lead} ${solved ? r.item.result : r.item.base}`)}</div>
          </Thing>
        </motion.div>
      </div>

      <Tip>{tip || (g.at === 0 ? firstTip : '')}</Tip>

      {/* Лист наклеек: каждую можно оторвать и тащить. */}
      <div className="shrink-0 relative rounded-2xl border-[1.5px] border-jewelInk px-3 py-3 flex justify-center gap-5" data-testid="sticker-sheet"
        style={{ background: 'repeating-linear-gradient(45deg, #FDFAEF 0 10px, #F6EEDC 10px 20px)', boxShadow: '3px 3px 0 #15100A' }}>
        {tools.map(t => (
          <Sticker key={`${sheet}-${t}`} tool={t} slot={slot} disabled={solved}
            onNear={setNear} onLand={land} />
        ))}
      </div>
    </div>
  )
}

/** Одна наклейка: тянется пальцем с инерцией и наклоном, притягивается к слову, прилипает или отлетает. */
function Sticker({ tool, slot, disabled, onNear, onLand }: {
  tool: Tool
  slot: React.RefObject<HTMLSpanElement>
  disabled: boolean
  onNear: (near: boolean) => void
  onLand: (tool: Tool) => boolean
}) {
  const x = useMotionValue(0), y = useMotionValue(0)
  const vx = useVelocity(x)
  // Наклон по ходу движения — как настоящая наклейка в пальцах.
  const rotate = useTransform(vx, [-900, 0, 900], [-16, 0, 16])
  const el = useRef<HTMLDivElement>(null)
  const [lift, setLift] = useState(false)
  const [stuck, setStuck] = useState(false)
  const wasNear = useRef(false)
  const moved = useRef(0)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => () => onNear(false), []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Где центр места для наклейки относительно того, где наклейка лежала. */
  const target = () => {
    const s = slot.current?.getBoundingClientRect(), me = el.current?.getBoundingClientRect()
    if (!s || !me) return null
    const ox = me.left + me.width / 2 - x.get(), oy = me.top + me.height / 2 - y.get()
    return { dx: s.left + s.width / 2 - ox, dy: s.top + s.height / 2 - oy }
  }
  const distance = () => {
    const t = target()
    return t ? Math.hypot(t.dx - x.get(), t.dy - y.get()) : Infinity
  }

  const home = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 18 })
    animate(y, 0, { type: 'spring', stiffness: 420, damping: 18 })
  }

  const release = () => {
    setLift(false)
    onNear(false); wasNear.current = false
    const t = target()
    if (!t) return home()
    // Отпустил у слова — наклейка сама долетает до места, а там решается, прилипнет ли.
    const close = distance() < PULL * 1.4
    if (!close) { haptic('soft'); return home() }
    void Promise.all([
      animate(x, t.dx, { type: 'spring', stiffness: 520, damping: 30 }),
      animate(y, t.dy, { type: 'spring', stiffness: 520, damping: 30 })
    ]).then(() => {
      if (onLand(tool)) setStuck(true)
      else { haptic('bad'); home() }
    })
  }

  // Нажал, не потащив, — наклейка летит к слову сама.
  const tapFly = () => {
    if (disabled || moved.current > 6) return
    const t = target()
    if (!t) return
    haptic('pop'); sound.pop(2)
    setLift(true)
    void Promise.all([
      animate(x, t.dx, { type: 'spring', stiffness: 260, damping: 22 }),
      animate(y, t.dy, { type: 'spring', stiffness: 260, damping: 22 })
    ]).then(() => {
      setLift(false)
      if (onLand(tool)) setStuck(true)
      else home()
    })
  }

  return (
    <motion.div
      ref={el}
      data-testid={`capsule-${tool === 'none' ? 'none' : tool}`}
      className="relative z-30 touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!disabled && !stuck}
      dragMomentum={false}
      dragElastic={0.18}
      onDragStart={() => { moved.current = 0; last.current = { x: 0, y: 0 }; setLift(true); haptic('pop'); sound.pop(1) }}
      onDrag={() => {
        // Лёгкий тик каждые ~50 px — палец чувствует, что ведёт наклейку.
        const d = Math.hypot(x.get() - last.current.x, y.get() - last.current.y)
        moved.current += d
        if (d > 50) { last.current = { x: x.get(), y: y.get() }; haptic('soft') }
        const close = distance() < PULL
        if (close !== wasNear.current) { wasNear.current = close; onNear(close); if (close) haptic('snap') }
      }}
      onDragEnd={release}
      onClick={tapFly}
      animate={{ scale: stuck ? 0 : lift ? 1.14 : 1, opacity: stuck ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 24 }}
    >
      <div className="relative rounded-xl border-[1.5px] border-jewelInk px-3 pt-1.5 pb-1 text-center min-w-[72px]"
        style={{ background: COLOR[tool], boxShadow: lift ? '6px 10px 0 rgba(21,16,10,0.35)' : '2px 2px 0 #15100A', transition: 'box-shadow 160ms' }}>
        <span className="block font-geo font-extrabold text-[22px] leading-none text-cream">{label(tool)}</span>
        <span className="block text-[11px] font-bold leading-tight text-cream/85">{sub(tool)}</span>
        {/* Отогнутый уголок — видно, что это наклейка и её можно оторвать. */}
        <span className="absolute -right-[1.5px] -top-[1.5px] w-3.5 h-3.5 rounded-bl-md border-l-[1.5px] border-b-[1.5px] border-jewelInk"
          style={{ background: 'linear-gradient(225deg, #F6EEDC 50%, #FFFFFF 50%)' }} />
      </div>
    </motion.div>
  )
}

/** Вещь, на которой написан ответ. */
function Thing({ thing, children }: { thing: Thing; children: React.ReactNode }) {
  if (thing === 'tag') {
    // Чемодан с биркой: «откуда ты» — бирка прилетевшего багажа.
    return (
      <div className="relative flex flex-col items-center" data-testid="thing-tag">
        <svg width="190" height="92" viewBox="0 0 190 92" aria-hidden className="-mb-3">
          <rect x="30" y="20" width="130" height="70" rx="12" fill="#C2553A" stroke="#15100A" strokeWidth="2.4" />
          <path d="M75 20 v-12 h40 v12" fill="none" stroke="#15100A" strokeWidth="3" />
          <path d="M30 44 h130 M30 66 h130" stroke="#15100A" strokeWidth="1.6" opacity="0.35" />
          <circle cx="58" cy="38" r="9" fill="#F5B820" stroke="#15100A" strokeWidth="1.6" />
          <rect x="120" y="54" width="26" height="16" rx="3" fill="#1B5FB0" stroke="#15100A" strokeWidth="1.6" />
          <path d="M95 8 q-6 30 -2 52" fill="none" stroke="#15100A" strokeWidth="1.4" strokeDasharray="3 3" />
        </svg>
        <div className="relative rounded-xl border-[1.5px] border-jewelInk bg-[#F6E7C3] px-4 py-2" style={{ boxShadow: '3px 3px 0 #15100A' }}>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-[1.5px] border-jewelInk bg-cream" />
          <div className="pl-3">{children}</div>
        </div>
      </div>
    )
  }
  if (thing === 'card') {
    // Открытка: «где живёшь» — адрес, куда она идёт.
    return (
      <div className="relative rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-4 py-3 w-[300px] max-w-[88vw]" style={{ boxShadow: '4px 4px 0 #15100A' }} data-testid="thing-card">
        <div className="flex gap-3 mb-2">
          <svg width="96" height="58" viewBox="0 0 96 58" aria-hidden className="shrink-0 rounded-md border-[1.5px] border-jewelInk">
            <rect width="96" height="34" fill="#9CC6EE" /><rect y="34" width="96" height="24" fill="#2F7F86" />
            <circle cx="74" cy="16" r="8" fill="#F5B820" stroke="#15100A" strokeWidth="1.2" />
            <path d="M14 58 Q18 36 26 28" stroke="#7A4E2D" strokeWidth="3" fill="none" />
            <path d="M26 28 q-10 -4 -16 2 M26 28 q10 -6 16 0 M26 28 q-2 -10 6 -14" stroke="#4E8A5B" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <div className="flex-1 flex flex-col justify-between">
            <div className="self-end w-10 h-12 rounded-sm border-[1.5px] border-jewelInk bg-[#F6E7C3] flex items-center justify-center" style={{ boxShadow: 'inset 0 0 0 3px #FDFAEF' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="7" fill="#E01A3C" /><path d="M10 5 v10 M5 10 h10" stroke="#FDFAEF" strokeWidth="2" /></svg>
            </div>
            <div className="h-px bg-jewelInk/30" /><div className="h-px bg-jewelInk/30" />
          </div>
        </div>
        <div className="border-t-[1.5px] border-dashed border-jewelInk/40 pt-2">{children}</div>
      </div>
    )
  }
  // Бейдж с именем на вечеринке.
  return (
    <div className="relative rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile overflow-hidden w-[260px] max-w-[84vw]" style={{ boxShadow: '4px 4px 0 #15100A' }} data-testid="thing-badge">
      <div className="bg-ruby px-3 py-1.5 text-center font-geo font-extrabold text-[16px] text-cream">{phrase('gamarjoba').geo}!</div>
      <div className="px-3 py-3">{children}</div>
    </div>
  )
}
