import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform, useVelocity } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { phrase } from '../story'
import { GameEnd, GameIntro, RuleCard } from '../ui'
import { hush, speakUrl } from '../voice'
import type { SceneProps, StepOf } from './types'
import { haveDeck, hintFor, isOver, send, sentence, sentenceAudio, sideOf, startState, verbOf, type Card, type HaveState, type Side } from './HaveSort.logic'
import { Picture } from './have/Pictures'
import Passerby from './walk/Passerby'
import type { Who } from './Walk.logic'

/**
 * «Фото и чемодан». Нино по видеосвязи спрашивает, кто и что у тебя есть. Живых — родных, друга, собаку —
 * ставишь на семейное фото: про них говорят მყავს. Вещи — книгу, машину, хачапури — кладёшь в чемодан:
 * про них — მაქვს. Карточку тащишь пальцем: она едет за ним, наклоняется, её притягивает к фото или
 * к чемодану; можно и просто нажать на фото или чемодан. Фраза («მე მყავს ძაღლი») звучит твоим голосом.
 * Без таймера: карточка ждёт сколько нужно.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const NINO: Who = { ru: 'Нино', kind: 'woman', coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', extra: 'none', voice: 'f' }
const PULL = 90
const VERB_COLOR: Record<Side, string> = { alive: '#4E8A5B', thing: '#C68F10' }

export default function HaveSort({ step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'havesort'>>) {
  const mode = step.mode
  const [round, setRound] = useState(0)
  const deck = useMemo(() => haveDeck(mode, rng), [mode, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [hs, setHs] = useState<HaveState>(startState)
  const [placed, setPlaced] = useState<Card[]>([])
  const [tip, setTip] = useState('')
  const [said, setSaid] = useState<Card | null>(null)
  const [near, setNear] = useState<Side | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const photo = useRef<HTMLButtonElement>(null)
  const bag = useRef<HTMLButtonElement>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])

  const c: Card | undefined = deck[hs.i]

  const decide = async (side: Side): Promise<boolean> => {
    if (!c || busy) return false
    const res = send(hs, c, side)
    setHs(res.state)
    if (res.outcome === 'bounce') {
      haptic('bad'); sound.miss(); setShake(k => k + 1)
      setTip(hintFor(c))
      return false
    }
    setBusy(true)
    haptic('good'); sound.snap(Math.min(res.state.combo, 8))
    const target = side === 'alive' ? photo.current : bag.current
    if (res.points) floater(`+${res.points}`, target, VERB_COLOR[side])
    if (res.state.combo >= 3) burst(target, 'small')
    setPlaced(p => [...p, c]); setSaid(c); setTip('')
    await speakUrl(sentenceAudio(c), sentence(c))
    if (!alive.current) return true
    setSaid(null); setBusy(false)
    if (isOver(res.state, deck)) { sound.win(); setPhase('end') }
    return true
  }

  const start = () => { setRound(r => r + 1); setHs(startState()); setPlaced([]); setTip(''); setPhase('play') }

  const title = 'Фото и чемодан'
  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="havesort-scene">
          <GameIntro title={title} text="Нино по видеосвязи спрашивает, кто и что у тебя есть. Живых — родных, друзей, зверей — ставь на семейное фото: про них говорят მყავს. Вещи клади в чемодан: про них — მაქვს." onStart={start}
            chips={[{ geo: phrase('myavs_dzaghli').geo, ru: phrase('myavs_dzaghli').ru }, { geo: phrase('makvs_manqana').geo, ru: phrase('makvs_manqana').ru }]} />
        </div>
      </GameFrame>
    )
  }
  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="havesort-scene">
          <GameEnd title={hs.misses === 0 ? 'Всё по местам с первого раза!' : 'Фото и чемодан собраны!'}
            text={`Верно с первого раза: ${hs.right} из ${deck.length}. Лучшая серия: ${hs.best}.`}
            rule={<RuleCard title="Два «у меня есть»"><G>მყავს</G> — про живых: <G>მე მყავს ძაღლი</G>. <G>მაქვს</G> — про вещи: <G>მე მაქვს მანქანა</G>.</RuleCard>}
            onNext={onDone} onAgain={start} />
        </div>
      </GameFrame>
    )
  }

  const people = placed.filter(p => p.alive), things = placed.filter(p => !p.alive)

  return (
    <GameFrame title={title} eyebrow={`${Math.min(hs.i + 1, deck.length)} из ${deck.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="havesort-scene">
        {/* Нино на видеосвязи. */}
        <div className="shrink-0 flex items-center gap-2 rounded-2xl border-[1.5px] border-jewelInk bg-[#1D2747] px-2 py-1.5" style={{ boxShadow: '2px 2px 0 #15100A' }}>
          <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border-[1.5px] border-cream/60 bg-[#9CC6EE] flex items-start justify-center">
            <svg width="48" height="76" viewBox="-40 -190 80 110" aria-hidden><Passerby who={NINO} phase={0} stride={0} face="smile" talking={!!said} wave={false} /></svg>
          </div>
          <div className="min-w-0 text-cream text-[12.5px] leading-snug">
            <span className="font-extrabold">Нино:</span> кто и что у тебя есть? Покажи!
          </div>
          {hs.combo >= 2 && <motion.span key={hs.combo} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="ml-auto shrink-0 rounded-full bg-gold border-[1.5px] border-jewelInk px-2 py-0.5 text-[11px] font-extrabold" data-testid="have-combo">×{hs.combo}</motion.span>}
        </div>

        {/* Карточка — посередине; цели — внизу. */}
        <div className="relative flex-1 min-h-[300px]" data-testid="have-track">
          <div className="absolute inset-x-0 top-0 h-[46%] flex items-center justify-center z-20">
            <AnimatePresence mode="popLayout">
              {c && !said && (
                <DragCard key={`${round}-${hs.i}`} card={c} shake={shake} photo={photo} bag={bag} disabled={busy}
                  onNear={setNear} onDrop={decide} />
              )}
              {said && (
                <motion.div key={`said-${hs.i}`} data-testid="have-sentence" className="rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-4 py-2 text-center"
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                  initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                  <div className="font-geo font-extrabold text-[22px] leading-tight">
                    მე <span style={{ color: VERB_COLOR[sideOf(said)] }}>{verbOf(sideOf(said))}</span> {said.geo}
                  </div>
                  <div className="text-[12px] font-semibold text-jewelInk-hint">{cyr(sentence(said))} — у меня есть {said.ru}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[54%] grid grid-cols-2 gap-2.5">
            <Target side="alive" refEl={photo} near={near === 'alive'} onClick={() => { haptic('tap'); void decide('alive') }}>
              <FamilyPhoto people={people} />
            </Target>
            <Target side="thing" refEl={bag} near={near === 'thing'} onClick={() => { haptic('tap'); void decide('thing') }}>
              <Suitcase things={things} />
            </Target>
          </div>
        </div>

        <div className="shrink-0 min-h-[40px] text-center text-[13px] leading-snug text-jewelInk-soft px-2" aria-live="polite" data-testid="have-tip">
          {tip || (hs.i === 0 ? 'Тащи карточку на фото или в чемодан — или нажми, куда её отправить.' : '')}
        </div>
      </div>
    </GameFrame>
  )
}

/** Карточка слова: тянется пальцем с наклоном, притягивается к фото или чемодану, отскакивает на промах. */
function DragCard({ card, shake, photo, bag, disabled, onNear, onDrop }: {
  card: Card
  shake: number
  photo: React.RefObject<HTMLButtonElement>
  bag: React.RefObject<HTMLButtonElement>
  disabled: boolean
  onNear: (s: Side | null) => void
  onDrop: (s: Side) => Promise<boolean>
}) {
  const x = useMotionValue(0), y = useMotionValue(0)
  const rotate = useTransform(useVelocity(x), [-900, 0, 900], [-18, 0, 18])
  const el = useRef<HTMLDivElement>(null)
  const [lift, setLift] = useState(false)
  const last = useRef<Side | null>(null)
  const ticks = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // На промах (shake сменился) карточка подпрыгивает и качается.
    if (!shake) return
    void animate(x, [0, -12, 12, -7, 7, 0], { duration: 0.42 })
  }, [shake]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onNear(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Смещение от исходного места до центра цели. */
  const to = (t: HTMLElement | null) => {
    const r = t?.getBoundingClientRect(), me = el.current?.getBoundingClientRect()
    if (!r || !me) return null
    const ox = me.left + me.width / 2 - x.get(), oy = me.top + me.height / 2 - y.get()
    return { dx: r.left + r.width / 2 - ox, dy: r.top + r.height / 2 - oy }
  }
  const closest = (): Side | null => {
    let best: Side | null = null, dist = Infinity
    for (const [side, t] of [['alive', photo.current], ['thing', bag.current]] as const) {
      const d = to(t)
      if (!d) continue
      const k = Math.hypot(d.dx - x.get(), d.dy - y.get())
      if (k < dist) { dist = k; best = side }
    }
    return dist < PULL * 1.6 ? best : null
  }
  const home = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 18 })
    animate(y, 0, { type: 'spring', stiffness: 420, damping: 18 })
  }

  return (
    <motion.div
      ref={el}
      data-testid="have-card" data-alive={card.alive ? 'yes' : 'no'}
      className="relative touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!disabled}
      dragMomentum={false}
      dragElastic={0.2}
      initial={{ opacity: 0, y: -40, scale: 0.7, rotate: -8 }}
      animate={{ opacity: 1, scale: lift ? 1.08 : 1 }}
      exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      onDragStart={() => { setLift(true); ticks.current = { x: 0, y: 0 }; haptic('pop'); sound.pop(1) }}
      onDrag={() => {
        const d = Math.hypot(x.get() - ticks.current.x, y.get() - ticks.current.y)
        if (d > 55) { ticks.current = { x: x.get(), y: y.get() }; haptic('soft') }
        const n = closest()
        if (n !== last.current) { last.current = n; onNear(n); if (n) haptic('snap') }
      }}
      onDragEnd={() => {
        setLift(false)
        const side = last.current
        last.current = null; onNear(null)
        if (!side) { haptic('soft'); home(); return }
        const t = to(side === 'alive' ? photo.current : bag.current)
        if (t) {
          animate(x, t.dx, { type: 'spring', stiffness: 520, damping: 30 })
          animate(y, t.dy, { type: 'spring', stiffness: 520, damping: 30 })
        }
        void onDrop(side).then(ok => { if (!ok) home() })
      }}
    >
      <div className="rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-2 pb-2.5 flex flex-col items-center min-w-[132px]"
        style={{ boxShadow: lift ? '8px 12px 0 rgba(21,16,10,0.3)' : '3px 3px 0 #15100A', transition: 'box-shadow 160ms' }}>
        <div className="w-[112px] h-[92px] rounded-xl bg-gold-wash border-[1.5px] border-jewelInk/40 flex items-end justify-center overflow-hidden">
          <Picture geo={card.geo} size={88} />
        </div>
        <span className="mt-1.5 font-geo font-extrabold text-[22px] leading-none">{card.geo}</span>
        <span className="text-[11.5px] font-semibold text-jewelInk-hint leading-tight">{cyr(card.geo)} · {card.ru}</span>
      </div>
    </motion.div>
  )
}

function Target({ side, refEl, near, onClick, children }: { side: Side; refEl: React.RefObject<HTMLButtonElement>; near: boolean; onClick: () => void; children: React.ReactNode }) {
  // Абсолютная раскладка: картинка над подписью занимает всё место кнопки, какой бы высоты она ни была.
  return (
    <motion.button ref={refEl} data-testid={`basket-${side}`} onClick={onClick}
      className="relative h-full rounded-2xl border-[1.5px] border-jewelInk overflow-hidden"
      style={{ boxShadow: '3px 3px 0 #15100A', background: side === 'alive' ? '#E8F1E6' : '#F6EEDC' }}
      animate={{ scale: near ? 1.05 : 1, borderColor: near ? VERB_COLOR[side] : '#15100A' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
      <span className="absolute left-1.5 right-1.5 top-1.5 bottom-[48px] block">{children}</span>
      <span className="absolute inset-x-0 bottom-0 h-[44px] border-t-[1.5px] border-jewelInk flex flex-col items-center justify-center" style={{ background: VERB_COLOR[side] }}>
        <span className="font-geo font-extrabold text-[17px] text-cream leading-none">მე {verbOf(side)}</span>
        <span className="block text-[10.5px] font-bold text-cream/85 leading-tight">{side === 'alive' ? 'живые — на фото' : 'вещи — в чемодан'}</span>
      </span>
    </motion.button>
  )
}

/** Семейное фото в рамке: кого поставил — те и на снимке, рядком, с подписью сзади. */
function FamilyPhoto({ people }: { people: Card[] }) {
  return (
    <div className="relative w-full h-full rounded-xl border-[1.5px] border-jewelInk bg-[#FDFAEF] p-1.5 rotate-[-2deg]" style={{ boxShadow: '2px 3px 0 rgba(21,16,10,0.35)' }}>
      <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: 'linear-gradient(#9CC6EE, #D7EAF7 60%, #CFE0CF 60%)' }}>
        {people.length === 0 && <svg viewBox="0 0 40 40" className="absolute inset-0 m-auto w-10 h-10 opacity-40" aria-hidden><path d="M20 34 S4 24 4 14 a8 8 0 0 1 16 -3 a8 8 0 0 1 16 3 c0 10 -16 20 -16 20 Z" fill="#E01A3C" stroke="#15100A" strokeWidth="2" /></svg>}
        <div className="absolute inset-x-1 bottom-0 flex items-end justify-center -space-x-3">
          <AnimatePresence>
            {people.slice(-5).map((p, k) => (
              <motion.div key={`${p.geo}-${k}`} initial={{ y: 40, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                <Picture geo={p.geo} size={66} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** Открытый чемодан: что положил — то и внутри, вперемешку. */
function Suitcase({ things }: { things: Card[] }) {
  return (
    <div className="relative w-full h-full">
      <svg viewBox="0 0 160 120" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <path d="M14 34 L30 8 H130 L146 34 Z" fill="#B5793F" stroke="#15100A" strokeWidth="2.4" strokeLinejoin="round" />
        <rect x="8" y="34" width="144" height="80" rx="10" fill="#C2553A" stroke="#15100A" strokeWidth="2.4" />
        <rect x="16" y="42" width="128" height="64" rx="7" fill="#8A3A28" stroke="#15100A" strokeWidth="1.6" />
        <path d="M60 34 v-6 h40 v6" fill="none" stroke="#15100A" strokeWidth="2.4" />
      </svg>
      <div className="absolute left-[12%] right-[12%] top-[40%] bottom-[14%] flex flex-wrap items-center justify-center content-center gap-0.5">
        <AnimatePresence>
          {things.slice(-6).map((t, k) => (
            <motion.div key={`${t.geo}-${k}`} initial={{ y: -40, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: (k % 3 - 1) * 10 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <Picture geo={t.geo} size={46} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
