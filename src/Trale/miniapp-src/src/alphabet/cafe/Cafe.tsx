import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import GameFrame from '../games/GameFrame'
import { burst, flyGhost, haptic, sound } from '../games/fx'
import { type Rng } from '../games/logic'
import { cyr } from '../../verbs/types'
import { useLater } from '../../verbs/games/useLater'
import { CheckMark, GuestArt, ProductArt, WindowArt } from './art'
import { SHIFT_MS, cafePlan, isFast, orderAt, type CafePlan } from './engine'
import { saveRecord } from './record'
import { isRealWord, orderText, type Product } from './products'

/**
 * «Кафе Бомборы» — последняя игра урока алфавита, перед праздником. Гости заказывают словами из выученных
 * букв («воდა», к десятому уроку — «წყალი»), ученик читает заказ и тапает нужное на витрине без подписей.
 * Первый гость — с подсказкой и без спешки: одна строка, что делать, и стрелка у верного блюда. Потом —
 * смена на время (полоска сверху): гости идут один за другим, счётчик «Обслужено», за скорость — «Быстро!»; смена кончилась —
 * короткий итог: сколько обслужил, рекорд этого урока на устройстве и что прочитал.
 */

/** Сколько показываем значение заказа, прежде чем зайдёт следующий гость. */
const MEANING_MS = 1000

type Stage = 'guided' | 'shift' | 'summary'

export default function Cafe({ lesson, fraction, onExit, onDone, rng = Math.random, plan: given, now: clock = () => performance.now() }: {
  lesson: number
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  /** Для тестов: витрина и заказы. */
  plan?: CafePlan
  /** Для тестов: часы. */
  now?: () => number
}) {
  const plan = useMemo(() => given ?? cafePlan(lesson, rng), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps
  const [stage, setStage] = useState<Stage>('guided')
  const [n, setN] = useState(0)
  const [order, setOrder] = useState<Product>(() => orderAt(plan, 0, null, rng))
  const [arrivedAt, setArrivedAt] = useState(0)
  const [served, setServed] = useState(false)
  const [fast, setFast] = useState(false)
  const [misses, setMisses] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [servedCount, setServedCount] = useState(0)
  const [record, setRecord] = useState<{ best: number; isNew: boolean } | null>(null)
  const [read, setRead] = useState<Product[]>([])
  const [mood, setMood] = useState<'happy' | 'cheer' | 'think'>('happy')
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const stageRef = useRef<Stage>('guided')
  const servedRef = useRef(false)
  /** Сколько гостей обслужено — для итога смены (таймер читает его вне рендера). */
  const servedRef2 = useRef(0)
  const productEls = useRef<Record<string, HTMLButtonElement | null>>({})
  const guestEl = useRef<HTMLDivElement>(null)
  const later = useLater()
  stageRef.current = stage
  servedRef.current = served

  // Часы смены: идут только во время смены и только пока экран виден (свернул Telegram — пауза).
  useEffect(() => {
    if (stage !== 'shift') return
    let last = clock()
    const id = setInterval(() => {
      const t = clock()
      if (document.visibilityState !== 'hidden') elapsedRef.current += Math.min(250, Math.max(0, t - last))
      last = t
      setElapsed(elapsedRef.current)
      // Время вышло, а гость ещё ждёт — смена закрыта, он уходит. Если только что подали — итог после значения.
      if (elapsedRef.current >= SHIFT_MS && !servedRef.current) finish()
    }, 100)
    return () => clearInterval(id)
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const text = (p: Product) => orderText(p, lesson) ?? p.ru
  const guided = stage === 'guided'
  const point = !served && (guided || misses >= 2)

  function finish() {
    if (stageRef.current === 'summary') return
    stageRef.current = 'summary'
    setStage('summary')
    const r = saveRecord(lesson, servedRef2.current)
    setRecord(r)
    if (r.isNew) { haptic('good'); sound.win() } else haptic('soft')
  }

  function nextGuest() {
    const k = n + 1
    setN(k)
    setOrder(orderAt(plan, k, order, rng))
    setArrivedAt(elapsedRef.current)
    setServed(false); setFast(false); setMisses(0); setMood('happy')
    haptic('soft')
  }

  function give(p: Product) {
    if (served || stage === 'summary') return
    if (p.id !== order.id) {
      haptic('bad'); sound.miss()
      setMisses(m => m + 1); setShake(p.id); setMood('think')
      later(() => { setShake(null); setMood('happy') }, 450)
      return
    }
    const quick = !guided && isFast(elapsedRef.current - arrivedAt)
    haptic('good'); sound.pop(Math.min(n, 12))
    setServed(true); setMood('cheer'); setFast(quick)
    servedRef2.current += 1; setServedCount(servedRef2.current)
    setRead(r => (r.some(x => x.id === order.id) ? r : [...r, order]))
    void flyGhost(productEls.current[p.id], guestEl.current, productEls.current[p.id]?.innerHTML ?? '', 300, 'ab-product-ghost').then(() => {
      burst(guestEl.current, quick ? 'big' : 'small')
    })
    // Значение заказа видно секунду, потом заходит следующий гость (или смена закрывается).
    later(() => {
      if (stageRef.current === 'guided') { setStage('shift'); stageRef.current = 'shift'; elapsedRef.current = 0; setElapsed(0) }
      else if (elapsedRef.current >= SHIFT_MS) { finish(); return }
      nextGuest()
    }, MEANING_MS)
  }

  const timeLeft = Math.max(0, 1 - elapsed / SHIFT_MS)

  if (stage === 'summary') {
    return (
      <GameFrame title="Кафе Бомборы" eyebrow="смена закрыта" fraction={fraction} onExit={onExit}>
        <div className="flex-1 flex flex-col items-center gap-4 text-center" data-testid="cafe-summary">
          <div className="ab-jump"><Mascot mood="cheer" size={110} /></div>
          <div className="text-[22px] font-extrabold" data-testid="cafe-served-total">Обслужено: <span className="tabular-nums">{servedCount}</span></div>
          {record?.isNew
            ? <div className="px-3 py-1 rounded-full bg-ruby text-cream text-[15px] font-extrabold border-[1.5px] border-jewelInk ab-snap" data-testid="cafe-record-new">Новый рекорд!</div>
            : <div className="text-[15px] font-bold text-jewelInk-mid" data-testid="cafe-record">Твой рекорд в этом уроке: <span className="tabular-nums">{record?.best ?? servedCount}</span></div>}
          <div className="w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3 text-left" style={{ boxShadow: '3px 3px 0 #15100A' }}>
            <div className="text-[14px] font-extrabold mb-2">Ты прочитал</div>
            <div className="flex flex-col gap-1.5">
              {read.map(p => (
                <div key={p.id} className="text-[15px]" data-testid="cafe-read">
                  <span className="font-geo font-extrabold">{text(p)}</span>
                  {isRealWord(p, lesson) && <span className="text-jewelInk-hint"> «{cyr(text(p))}»</span>}
                  <span className="text-jewelInk-mid"> — {p.ru}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto w-full max-w-[340px]"><Button onClick={() => { haptic('tap'); onDone() }}>дальше →</Button></div>
        </div>
      </GameFrame>
    )
  }

  return (
    <GameFrame title="Кафе Бомборы" eyebrow={guided ? 'первый гость' : `гость ${n + 1}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3 ab-short:gap-2" data-testid="cafe">
        <div className={`text-center text-[15px] font-bold leading-snug ${guided ? 'rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-3 py-2' : 'text-jewelInk-mid'}`} data-testid="cafe-howto">
          {guided ? 'Гость заказывает по-грузински. Прочитай заказ и подай нужное' : 'Смена началась: успей обслужить побольше гостей'}
        </div>
        {!guided && (
          <div className="h-3 rounded-full bg-cream-deep border-[1.5px] border-jewelInk overflow-hidden" data-testid="cafe-timer">
            <div className={`h-full transition-[width] duration-100 ease-linear ${timeLeft > 0.25 ? 'bg-gold' : 'bg-ruby'}`} style={{ width: `${timeLeft * 100}%` }} />
          </div>
        )}

        {/* Зал: навес, вывеска, окна, гость с заказом, стойка с Бомборой. */}
        <div className="relative rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ background: 'repeating-linear-gradient(90deg, #F5EFE0 0 28px, #EFE6D2 28px 30px)', boxShadow: '3px 3px 0 #15100A' }}>
          <div className="h-5 flex">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex-1 ${i % 2 ? 'bg-cream' : 'bg-ruby'} border-b-[1.5px] border-jewelInk`} style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }} />)}
          </div>
          <div className="absolute top-7 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-lg border-[1.5px] border-jewelInk bg-navy text-cream font-sans text-[14px] font-extrabold whitespace-nowrap" style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="cafe-sign">Бомбора</div>
          <div key={servedCount} className="absolute top-7 right-2 px-2 py-0.5 rounded-lg bg-cream-tile border border-jewelInk/40 text-[13px] font-extrabold tabular-nums ab-count" data-testid="cafe-served">Обслужено: {servedCount}</div>
          <div className="absolute top-[64px] inset-x-0 flex justify-between px-3 pointer-events-none opacity-90 ab-short:hidden">
            <WindowArt width={84} /><WindowArt width={84} />
          </div>

          <div className="relative pt-[60px] ab-short:pt-[44px] flex items-end justify-center gap-2 px-3" style={{ minHeight: 'clamp(150px, 28vh, 236px)' }}>
            <div key={n} ref={guestEl} className="relative flex flex-col items-center ab-in" data-testid="cafe-guest" data-order={text(order)}>
              <div className="relative min-w-[132px] max-w-[220px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2 text-center" style={{ boxShadow: '2px 2px 0 #15100A' }}>
                <div className={`font-geo font-extrabold leading-tight break-words ${text(order).length > 8 ? 'text-[24px]' : 'text-[30px]'} ${served ? 'text-navy' : ''}`} data-testid="cafe-order">
                  {text(order)}{served && <span className="ml-1"><CheckMark size={16} /></span>}
                </div>
                {served && (
                  <div className="text-[13px] font-bold text-jewelInk-mid ab-drip" data-testid="cafe-meaning">
                    {isRealWord(order, lesson) ? `«${cyr(text(order))}» — ` : ''}{order.ru}
          
                  </div>
                )}
                <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-cream-tile border-r-[1.5px] border-b-[1.5px] border-jewelInk" />
              </div>
              {served && fast && <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gold border-[1.5px] border-jewelInk text-[14px] font-extrabold ab-snap" data-testid="cafe-fast">Быстро!</div>}
              <div className="mt-2"><GuestArt look={n} mood={served ? 'happy' : 'wait'} size={56} /></div>
            </div>
          </div>
          <div className="relative h-[70px] ab-short:h-[52px] flex items-end justify-end pr-4">
            <div className="absolute bottom-0 inset-x-0 h-6 bg-[#D99844] border-t-[1.5px] border-jewelInk" />
            <div className={`relative ${mood === 'cheer' ? 'ab-jump' : mood === 'think' ? 'ab-wobble' : ''}`} key={mood + n}>
              <Mascot mood={mood} size={64} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-1" data-testid="cafe-shelf">
          {plan.shelf.map(p => {
            const here = point && p.id === order.id
            return (
              <div key={p.id} className="relative">
                <button
                  ref={el => { productEls.current[p.id] = el }}
                  onClick={() => give(p)}
                  aria-label={p.ru}
                  data-testid={`shelf-${p.id}`}
                  data-hint={here ? 'yes' : 'no'}
                  className={`relative w-full h-[74px] ab-short:h-[56px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex items-center justify-center active:scale-95 transition-transform ${shake === p.id ? 'ab-shake bg-ruby-wash' : ''} ${here ? 'ring-4 ring-gold ab-pulse' : ''}`}
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                ><ProductArt id={p.id} size={48} />{here && <Pointer />}</button>
              </div>
            )
          })}
        </div>

      </div>
    </GameFrame>
  )
}

/** Стрелка у верного товара у первого гостя (и после двух промахов) — внутри плитки, чтобы не задевать соседей. */
function Pointer() {
  return (
    <div className="absolute right-1.5 top-1/2 -mt-[15px] z-10 pointer-events-none ab-bob" data-testid="cafe-pointer" aria-hidden>
      <svg width="28" height="30" viewBox="0 0 30 30" fill="none" stroke="#15100A" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M2 15L15 3v7h13v10H15v7z" fill="#FCD76D" />
      </svg>
    </div>
  )
}
