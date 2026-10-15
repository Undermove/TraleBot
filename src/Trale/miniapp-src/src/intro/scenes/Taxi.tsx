import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { CITIES, myName, type City } from '../story'
import { Bubble, Face, GameEnd, GameIntro, Meter, Pill, Reply, RuleCard, say, type Look } from '../ui'
import type { Exchange, Say } from './chatScripts'
import { answerRide, discountFor, fareAt, lari, newRide, pointAt, route, rideOver, segOf, taxiTurns, tickRide, type Pt, type Ride, type TaxiMode } from './taxi.logic'
import type { SceneProps, StepOf } from './types'

/**
 * «Таксист спрашивает». Едешь по Батуми: на карте маршрут и машинка. Между поворотами болтливый таксист
 * задаёт вопрос; ответишь — доедете до поворота быстрее, и растёт «скидка за разговор». Промах —
 * смешная реакция, можно ответить ещё раз. Не успел — таксист пожимает плечами. В конце — чек.
 */

const DRIVER: Look = { coat: '#4E8A5B', skin: '#E0AC7E', hair: '#15100A', age: 'adult' }
const TICK_MS = 100
const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

function TaxiMap({ pts, pos, dest }: { pts: Pt[]; pos: number; dest: City }) {
  const car = pointAt(pts, pos)
  const k = Math.floor(Math.min(pos, pts.length - 1))
  const done = [...pts.slice(0, k + 1), [car.x, car.y] as Pt]
  const end = pts[pts.length - 1]
  return (
    <svg viewBox="0 0 300 170" className="w-full h-[140px] ab-short:h-[108px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-deep" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="taxi-map" role="img" aria-label="карта поездки">
      <rect x="0" y="0" width="24" height="170" fill="#C9DBF0" />
      {[20, 60, 100, 140].map(y => <path key={y} d={`M4 ${y} q4 -4 8 0 t8 0`} stroke="#1B5FB0" strokeWidth="1.2" fill="none" />)}
      {[30, 70, 110, 145].map(y => <line key={`h${y}`} x1="24" y1={y} x2="300" y2={y} stroke="#FDFAEF" strokeWidth="9" />)}
      {[40, 80, 120, 160, 200, 240, 270].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="170" stroke="#FDFAEF" strokeWidth="9" />)}
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#F5B820" strokeWidth="3" strokeDasharray="5 4" strokeLinejoin="round" />
      <polyline points={done.map(p => p.join(',')).join(' ')} fill="none" stroke="#1B5FB0" strokeWidth="3.5" strokeLinejoin="round" />
      {pts.slice(1, -1).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={i < k ? '#1B5FB0' : '#FDFAEF'} stroke="#15100A" strokeWidth="1.2" />)}
      <g transform={`translate(${end[0]} ${end[1]})`}>
        <path d="M0 0 C-7 -9 -7 -17 0 -19 C7 -17 7 -9 0 0Z" fill="#E01A3C" stroke="#15100A" strokeWidth="1.4" />
        <circle cy="-13" r="3" fill="#FDFAEF" />
      </g>
      <text x={Math.min(end[0], 250)} y={end[1] < 40 ? end[1] + 16 : end[1] - 23} textAnchor="middle" fontSize="10" fontWeight="800" fill="#15100A">{dest.ru}</text>
      <g transform={`translate(${car.x} ${car.y}) rotate(${car.angle})`} data-testid="taxi-car">
        <rect x="-9" y="-5.5" width="18" height="11" rx="3" fill="#F5B820" stroke="#15100A" strokeWidth="1.4" />
        <rect x="1" y="-4" width="5" height="8" rx="1.5" fill="#C9DBF0" stroke="#15100A" strokeWidth="1" />
        <rect x="-3" y="-2" width="3" height="4" fill="#15100A" />
      </g>
    </svg>
  )
}

function DriverSays({ lines }: { lines: Say[] }) {
  return (
    <div className="flex items-end gap-2 min-h-[64px]" data-testid="taxi-driver">
      <Face look={DRIVER} size={44} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {lines.map((l, i) => l.kind === 'her' ? (
          <Bubble key={`${l.geo}${i}`} className="self-start text-left">
            <button type="button" onClick={() => l.ids.length === 1 && say(l.ids[0])} className="text-left">
              <span className="block font-geo font-bold text-[16px] leading-tight">{l.geo}</span>
              <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(l.geo)} · {l.ru}</span>
            </button>
          </Bubble>
        ) : l.kind === 'note' ? (
          <div key={`${l.text}${i}`} className="zn-pop self-start rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-2.5 py-1 text-[13px] font-bold" data-testid="taxi-ask">{l.text}</div>
        ) : null)}
      </div>
    </div>
  )
}

export default function Taxi({ lesson, step, fraction, onExit, onDone, rng = Math.random, now = Date.now }: SceneProps<StepOf<'taxi'>>) {
  const mode: TaxiMode = step.mode
  const [phase, setPhase] = useState<'intro' | 'dest' | 'ride' | 'end'>('intro')
  const [dest, setDest] = useState<City>(CITIES[0])
  const [round, setRound] = useState(0)
  const me = useMemo(() => myName(), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const turns: Exchange[] = useMemo(() => taxiTurns(mode, dest, me, lesson.id, rng), [mode, dest, me, lesson.id, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const pts = useMemo(() => route(turns.length, rng), [turns]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = turns.length
  const [ride, setRide] = useState<Ride>(() => newRide(n))
  const [tried, setTried] = useState<number[]>([])
  const [extra, setExtra] = useState<Say[] | null>(null)
  const seg = segOf(ride, n)
  const lastSeg = useRef(seg)
  const meterRef = useRef<HTMLSpanElement>(null)

  // Тик поездки. Интервал живёт только пока едем.
  useEffect(() => {
    if (phase !== 'ride') return
    let last = now()
    const id = setInterval(() => {
      const t = now(); const dt = Math.min(500, t - last); last = t
      setRide(r => tickRide(r, dt, n))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [phase, n]) // eslint-disable-line react-hooks/exhaustive-deps

  // Новый отрезок — новый вопрос.
  useEffect(() => {
    if (seg !== lastSeg.current) {
      lastSeg.current = seg
      setTried([]); setExtra(null)
      sound.tick(seg)
      const first = turns[seg]?.her.find(h => h.kind === 'her')
      if (first && first.kind === 'her' && first.ids.length === 1) say(first.ids[0])
    }
  }, [seg, turns])

  useEffect(() => {
    if (phase === 'ride' && rideOver(ride, n)) { sound.win(); haptic('good'); setPhase('end') }
  }, [phase, ride, n])

  const begin = (c: City) => {
    haptic('pop'); sound.pop()
    setDest(c)
    setRound(r => r + 1)
    setPhase('ride')
  }
  // Новый маршрут — новая поездка с начала.
  useEffect(() => { setRide(newRide(n)); setTried([]); setExtra(null); lastSeg.current = 0 }, [turns, n])

  const choose = (k: number) => {
    const ex = turns[seg]
    const o = ex.opts[k]
    if (ride.answered[seg]) return
    setRide(r => answerRide(r, n, o.good, o.miss))
    if (!o.good) { setTried(t => [...t, k]); haptic('bad'); sound.miss(); return }
    if (o.ids.length === 1) say(o.ids[0])
    haptic('good'); sound.snap(seg)
    burst(meterRef.current, 'small')
    floater(`+${lari(discountFor(ride.missed[seg]))}`, meterRef.current, '#4E8A5B')
    setExtra(o.then ?? null)
  }

  const fare = fareAt(Math.min(ride.pos, n))
  const pay = Math.max(1, fare - ride.discount)

  if (phase === 'intro') return (
    <GameFrame title="Таксист спрашивает" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <GameIntro title="Такси по Батуми" hero
        text={mode === 'where'
          ? 'Таксист попался болтливый. Отвечай, пока едете до поворота: за хороший разговор — скидка. Он обязательно спросит, где ты живёшь.'
          : 'Опять болтливый таксист. Теперь он спросит, кем ты работаешь. Отвечай до поворота — скидка растёт.'}
        chips={mode === 'where' ? [{ geo: 'ბათუმში', ru: 'в Батуми' }, { geo: 'ქუთაისში', ru: 'в Кутаиси' }] : [{ geo: 'მე ვარ სტუდენტი', ru: 'я студент' }, { geo: 'ვმუშაობ', ru: 'я работаю' }]}
        onStart={() => setPhase('dest')} />
    </GameFrame>
  )

  if (phase === 'dest') return (
    <GameFrame title="Куда едем?" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-3" data-testid="taxi-scene">
        <p className="text-center text-[14px] text-jewelInk-soft">Ты садишься в такси у моря. Нажми, куда ехать, — таксист переспросит по-грузински.</p>
        {CITIES.map(c => (
          <button key={c.base} onClick={() => begin(c)} data-testid="taxi-dest"
            className="min-h-[56px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-4 py-2 flex items-center justify-between active:translate-x-[2px] active:translate-y-[2px]" style={{ boxShadow: '3px 3px 0 #15100A' }}>
            <span className="text-[17px] font-extrabold">{c.ru}</span>
            <span className="text-right leading-tight"><span className="block font-geo font-bold text-[16px]">{c.in}</span><span className="block text-[11px] text-jewelInk-hint">{cyr(c.in)} · в {c.ru}</span></span>
          </button>
        ))}
      </div>
    </GameFrame>
  )

  if (phase === 'end') {
    const good = ride.answered.filter(Boolean).length
    return (
      <GameFrame title="Приехали!" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
        <GameEnd
          title={`Чек: ${lari(pay)}`}
          text={`Поговорили на ${good} из ${n} вопросов${ride.silent ? `, ${ride.silent} проехали молча` : ''}.`}
          rule={<div className="flex flex-col gap-2 w-full max-w-[320px]">
            <div className="rounded-xl border-[1.5px] border-dashed border-jewelInk bg-cream-tile px-4 py-2 text-[13px] tabular-nums" data-testid="taxi-receipt">
              <div className="flex justify-between"><span>По счётчику</span><b>{lari(fare)}</b></div>
              <div className="flex justify-between text-ruby"><span>Скидка за разговор</span><b>−{lari(Math.min(ride.discount, fare - 1))}</b></div>
              <div className="flex justify-between border-t-[1.5px] border-dashed border-jewelInk-faint mt-1 pt-1"><span>К оплате</span><b>{lari(pay)}</b></div>
            </div>
            {mode === 'where'
              ? <RuleCard title="Где живёшь">«Живу в …» — <G>ვცხოვრობ</G> и город с <G>-ში</G>: <G>ბათუმი</G> → <G>ბათუმში</G>. Без <G>-ში</G> выходит «живу Батуми».</RuleCard>
              : <RuleCard title="Кем работаешь">На <G>შენ რა პროფესია გაქვს?</G> отвечают <G>მე ვარ</G> + профессия: <G>მე ვარ სტუდენტი</G>. <G>ვმუშაობ</G> — просто «я работаю».</RuleCard>}
          </div>}
          onNext={onDone}
          onAgain={() => setPhase('dest')}
        />
      </GameFrame>
    )
  }

  const ex = turns[seg]
  const answered = ride.answered[seg]
  const segFrac = Math.min(1, ride.pos - seg)
  const lines = extra ?? ex.her
  return (
    <GameFrame title="Таксист спрашивает" eyebrow={`поворот ${Math.min(seg + 1, n)} из ${n}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="taxi-scene">
        <div className="shrink-0 flex items-center justify-between gap-2">
          <Pill testId="taxi-fare">счётчик {lari(fare)}</Pill>
          <span ref={meterRef}><Pill testId="taxi-discount">скидка {lari(ride.discount)}</Pill></span>
        </div>
        <div className="shrink-0"><TaxiMap pts={pts} pos={ride.pos} dest={dest} /></div>
        <div className="shrink-0 flex items-center gap-2 text-[11px] font-bold text-jewelInk-hint">
          <span className="whitespace-nowrap">до поворота</span>
          <Meter value={answered ? 0 : 1 - segFrac} tone={answered ? 'sage' : segFrac > 0.7 ? 'ruby' : 'gold'} label="до поворота" />
        </div>
        <div className="shrink-0"><DriverSays lines={lines} /></div>
        {ride.note && <div className="shrink-0 zn-pop rounded-xl border-[1.5px] border-dashed border-jewelInk-hint px-3 py-1 text-center text-[12px] font-semibold text-jewelInk-soft" data-testid="taxi-note">{ride.note}</div>}
        <div className="flex-1 min-h-0" />
        <div className="shrink-0 flex flex-col gap-2" data-testid="taxi-options">
          {answered ? (
            <div className="text-center text-[13px] font-bold text-navy py-3 zn-pop">Едем к повороту…</div>
          ) : ex.opts.map((o, k) => (
            <div key={`${seg}-${k}`} className={`rounded-2xl ${tried.length >= 2 && o.good ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''}`}>
              <Reply geo={o.geo} compact disabled={tried.includes(k)} state={tried.includes(k) ? 'dim' : 'idle'}
                testId={o.good ? 'taxi-reply-ok' : 'taxi-reply-miss'} onClick={() => choose(k)} />
            </div>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
