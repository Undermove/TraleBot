import React, { useMemo, useRef, useState } from 'react'
import { burst, flyGhost, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import { phrase, type Rng } from '../story'
import { Bubble, Face, Pill, Tip, say } from '../ui'
import { Transformed } from './Magnets'
import { MAGNET_RU, type MagnetSet, type Tool } from './Magnets.logic'
import { advance, choose, clampClaw, current, freeSpot, grab, pile, startGame, why, type Capsule, type Game } from './Endings.logic'

/**
 * «Магниты» как автомат с игрушками. Нино спрашивает, твой ответ — фраза без окончания у последнего
 * слова («ვცხოვრობ ბათუმი…»), сверху — что ты хочешь сказать («живу в Батуми»). Под стеклом капсулы
 * с окончаниями (-ში «в», -დან «из»; для имён — ი и «без ი»). Ведёшь пальцем — кран едет следом,
 * отпускаешь — опускается и хватает капсулу под собой (можно просто ткнуть в капсулу). Кран несёт её
 * к трубе, капсула падает в твой ответ: верная прилипает (у -ში отваливается ი), фраза звучит; неверная
 * со звоном отскакивает обратно в стекло, Бомбора объясняет. Мимо капсул — кран возвращается пустым.
 */

export interface EndingsResult { done: number; total: number; score: number; best: number }

type Phase = 'aim' | 'drop' | 'lift' | 'carry' | 'fall' | 'solved'

const NINO = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }
const CAP = 46
const CHUTE_X = 0.9
const T = { drop: 520, lift: 460, carry: 560, fall: 480 }

function label(t: Tool) { return t === 'none' ? 'без ი' : t === 'ი' ? 'ი' : `-${t}` }
function sub(t: Tool) { return t === 'none' ? 'как есть' : t === 'ი' ? 'гласная' : MAGNET_RU[t] }
function color(t: Tool) { return t === 'ში' ? '#1B5FB0' : t === 'დან' ? '#E01A3C' : t === 'ი' ? '#4E8A5B' : '#C68F10' }

function CapsuleBall({ tool, innerRef, style, testId, onClick }: { tool: Tool; innerRef?: React.Ref<HTMLDivElement>; style?: React.CSSProperties; testId?: string; onClick?: () => void }) {
  return (
    <div ref={innerRef} data-testid={testId} data-tool={tool} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={onClick ? `Капсула ${label(tool)}` : undefined}
      className="absolute flex flex-col items-center justify-center rounded-full border-[1.5px] border-jewelInk text-cream select-none"
      style={{ width: CAP, height: CAP, background: `radial-gradient(circle at 35% 30%, #FFFFFF66 0 18%, transparent 19%), ${color(tool)}`, boxShadow: 'inset 0 -6px 0 #00000022, 2px 2px 0 #15100A', ...style }}>
      <span className="font-geo font-extrabold leading-none" style={{ fontSize: tool === 'none' ? 11 : 15 }}>{label(tool)}</span>
      <span className="text-[9px] font-bold leading-none opacity-90">{sub(tool)}</span>
    </div>
  )
}

export default function Endings({ set, rng = Math.random, onEnd }: { set: MagnetSet; rng?: Rng; onEnd: (r: EndingsResult) => void }) {
  const [g, setG] = useState<Game>(() => startGame(set, rng))
  const [caps, setCaps] = useState<Capsule[]>(() => pile(set, rng, 0))
  const [x, setX] = useState(0.4)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>('aim')
  const [held, setHeld] = useState<Capsule | null>(null)
  const [shake, setShake] = useState(false)
  const [tip, setTip] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const heldEl = useRef<HTMLDivElement>(null)
  const wordEl = useRef<HTMLSpanElement>(null)
  const later = useLater()
  // Один захват за раз: pointerup стекла и click капсулы приходят в одном касании.
  const busy = useRef(false)
  const r = current(g)
  const firstTip = useMemo(() => (set === 'name'
    ? 'Веди пальцем по стеклу — кран поедет. Отпусти над капсулой: нужна ли имени ი?'
    : 'Веди пальцем по стеклу — кран поедет за ним. Отпусти над нужной капсулой.'), [set])
  if (!r) return null

  const fx = (clientX: number) => {
    const b = box.current?.getBoundingClientRect()
    if (!b) return x
    return clampClaw((clientX - b.left) / b.width)
  }

  const release = (at: number, pickId?: number) => {
    if (phase !== 'aim' || busy.current) return
    busy.current = true
    setDragging(false)
    setX(at)
    setPhase('drop'); sound.pop(1)
    haptic('tap')
    later(() => {
      const c = (pickId !== undefined ? caps.find(k => k.id === pickId) : undefined) ?? grab(caps, at)
      if (c) { setCaps(cs => cs.filter(k => k.id !== c.id)); setHeld(c); haptic('snap'); sound.snap(2) }
      setPhase('lift')
      later(() => {
        if (!c) { busy.current = false; setPhase('aim'); setTip('Мимо! Отпусти кран прямо над капсулой.'); sound.miss(); return }
        setPhase('carry'); setX(CHUTE_X)
        later(() => drop(c), T.carry)
      }, T.lift)
    }, T.drop)
  }

  const drop = async (c: Capsule) => {
    setPhase('fall')
    await flyGhost(heldEl.current, wordEl.current, label(c.tool), T.fall, 'zn-ghost-cap')
    setHeld(null)
    const res = choose(g, c.tool)
    setG(res.game)
    if (res.verdict === 'miss') {
      haptic('bad'); sound.miss()
      setShake(true); later(() => setShake(false), 420)
      setTip(why(r, c.tool))
      // Капсула со звоном отскакивает обратно в стекло.
      setCaps(cs => [...cs, { ...c, x: freeSpot(cs, rng), row: 0 }])
      setX(0.4); setPhase('aim'); busy.current = false
      return
    }
    haptic('good'); setTip(''); setPhase('solved')
    floater(`+${res.points}`, wordEl.current, '#4E8A5B')
    if (res.game.combo >= 3) burst(wordEl.current, 'small')
    later(() => say(r.item.result), 650)
    later(() => {
      const next = advance(res.game)
      if (next.at >= next.rounds.length) { onEnd({ done: next.rounds.length, total: next.rounds.length, score: next.score, best: next.best }); return }
      setG(next); setCaps(pile(set, rng, next.at)); setX(0.4); setPhase('aim'); busy.current = false
    }, 1800)
  }

  const nudge = (d: number) => { if (phase === 'aim') { haptic('tap'); setX(v => clampClaw(v + d)) } }
  const clawDown = phase === 'drop'
  const clawTop = clawDown ? 'calc(100% - 44px)' : '36px'
  const speed = dragging ? 60 : phase === 'carry' ? T.carry : 260

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

      <div className={`shrink-0 self-end max-w-full rounded-2xl rounded-br-md border-[1.5px] border-jewelInk bg-gold-wash px-3 py-1.5 ${shake ? 'zn-shake' : ''}`}
        style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="endings-answer" data-tool={r.item.tool}>
        <div className="text-right text-[11px] font-bold text-navy">ты хочешь сказать: «{r.goal}»</div>
        <div className="flex flex-wrap items-baseline justify-end gap-x-2 font-geo font-extrabold text-[21px] leading-tight">
          <span>{r.lead}</span>
          <span ref={wordEl} data-testid="endings-word">
            {phase === 'solved'
              ? <Transformed key={g.at} item={r.item} size={21} />
              : <>{r.item.base}<span className="text-jewelInk-faint">…</span></>}
          </span>
        </div>
        <div className="text-right text-[11px] font-semibold text-jewelInk-hint">{cyr(`${r.lead} ${phase === 'solved' ? r.item.result : r.item.base}`)}</div>
      </div>

      {/* Автомат: стекло с капсулами, кран сверху, справа — труба к ответу. */}
      <div ref={box} data-testid="claw-machine"
        className="relative flex-1 min-h-[170px] max-h-[240px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden touch-none select-none"
        style={{ background: 'linear-gradient(#C9DBF0cc, #FDFAEF 85%)', boxShadow: '3px 3px 0 #15100A' }}
        onPointerDown={e => { if (phase !== 'aim') return; (e.target as Element).setPointerCapture?.(e.pointerId); setDragging(true); setTip(''); setX(fx(e.clientX)) }}
        onPointerMove={e => { if (dragging && phase === 'aim') setX(fx(e.clientX)) }}
        onPointerUp={e => { if (dragging) release(fx(e.clientX)) }}
        onPointerCancel={() => setDragging(false)}>
        {/* рельс */}
        <div className="absolute left-2 right-2 top-1 h-1.5 rounded-full bg-jewelInk/70" />
        {/* труба */}
        <div className="absolute right-0 top-0 bottom-0 w-[16%] border-l-[1.5px] border-dashed border-jewelInk/50 flex items-end justify-center pb-2">
          <div className="w-9 h-12 rounded-b-xl border-[1.5px] border-t-0 border-jewelInk bg-cream-deep flex items-end justify-center text-[9px] font-bold text-jewelInk-hint pb-1">в ответ</div>
        </div>
        {/* кран */}
        <div className="absolute z-10 flex flex-col items-center pointer-events-none" data-testid="claw"
          style={{ left: `${x * 100}%`, top: 0, height: clawTop, transform: 'translateX(-50%)', transition: `left ${speed}ms ease-out, height ${clawDown ? T.drop : T.lift}ms ease-in-out` }}>
          <div className="w-[2px] flex-1 bg-jewelInk" />
          <svg width="44" height="24" viewBox="0 0 44 24" aria-hidden>
            <rect x="14" y="0" width="16" height="8" rx="2" fill="#F5B820" stroke="#15100A" strokeWidth="1.5" />
            <path d={held || clawDown ? 'M16 8 L10 22 M28 8 L34 22' : 'M16 8 L4 20 M28 8 L40 20'} stroke="#15100A" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {held && <div className="relative" style={{ width: CAP, height: CAP, marginTop: -6 }}><CapsuleBall tool={held.tool} innerRef={heldEl} style={{ left: 0, top: 0 }} testId="held-capsule" /></div>}
        </div>
        {/* капсулы */}
        {caps.map(c => (
          <CapsuleBall key={c.id} tool={c.tool} testId={`capsule-${c.tool === 'none' ? 'none' : c.tool}`} onClick={() => release(c.x, c.id)}
            style={{ left: `calc(${c.x * 100}% - ${CAP / 2}px)`, bottom: 6 + c.row * 30, transition: 'left 300ms' }} />
        ))}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <button type="button" aria-label="Кран влево" onClick={() => nudge(-0.08)} className="w-11 h-11 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile font-extrabold" style={{ boxShadow: '2px 2px 0 #15100A' }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mx-auto"><path d="M10 3 L4 8 L10 13" stroke="#15100A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <div className="flex-1"><Tip>{tip || (g.at === 0 ? firstTip : '')}</Tip></div>
        <button type="button" aria-label="Кран вправо" onClick={() => nudge(0.08)} className="w-11 h-11 rounded-xl border-[1.5px] border-jewelInk bg-cream-tile font-extrabold" style={{ boxShadow: '2px 2px 0 #15100A' }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mx-auto"><path d="M6 3 L12 8 L6 13" stroke="#15100A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <button type="button" data-testid="claw-drop" aria-label="Опустить кран" onClick={() => release(x)} className="h-11 px-3 rounded-xl border-[1.5px] border-jewelInk bg-gold font-extrabold text-[13px]" style={{ boxShadow: '2px 2px 0 #15100A' }}>вниз</button>
      </div>
    </div>
  )
}
