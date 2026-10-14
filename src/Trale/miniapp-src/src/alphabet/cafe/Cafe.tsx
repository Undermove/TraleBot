import React, { useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import GameFrame from '../games/GameFrame'
import { burst, flyGhost, haptic, reducedMotion, sound } from '../games/fx'
import { mixed, type Rng } from '../games/logic'
import { cyr } from '../../verbs/types'
import { useLater } from '../../verbs/games/useLater'
import { CheckMark, CoinIcon, GuestArt, ProductArt, WindowArt } from './art'
import { cafePlan, priceOf, type CafePlan } from './engine'
import { isRealWord, orderText, type Product } from './products'

/**
 * «Кафе Бомборы» — последняя игра урока алфавита, перед праздником. Гости приходят по одному и заказывают
 * словами из выученных букв («воდა», к десятому уроку — «წყალი»). Ученик читает заказ и тапает нужное
 * на витрине без подписей. Первый заказ — с подсказкой: одна строка, что делать, и палец над верным товаром.
 * Таймера нет; монетки — просто для удовольствия.
 */
export default function Cafe({ lesson, fraction, onExit, onDone, rng = Math.random, plan: given }: {
  lesson: number
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  /** Для тестов: витрина и заказы. */
  plan?: CafePlan
}) {
  const plan = useMemo(() => given ?? cafePlan(lesson, rng), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps
  const [oi, setOi] = useState(0)
  const [served, setServed] = useState(false)
  const [misses, setMisses] = useState(0)
  const [shake, setShake] = useState<string | null>(null)
  const [coins, setCoins] = useState(0)
  const [mood, setMood] = useState<'happy' | 'cheer' | 'think'>('happy')
  const [summary, setSummary] = useState(false)
  const productEls = useRef<Record<string, HTMLButtonElement | null>>({})
  const guestEl = useRef<HTMLDivElement>(null)
  const coinsEl = useRef<HTMLDivElement>(null)
  const later = useLater()

  const order = plan.orders[oi]
  if (!order) { later(onDone, 0); return null }
  const text = (p: Product) => orderText(p, lesson) ?? p.ru
  const guided = oi === 0
  const point = !served && (guided || misses >= 2)
  const last = oi + 1 >= plan.orders.length

  function give(p: Product) {
    if (served) return
    if (p.id !== order.id) {
      haptic('bad'); sound.miss()
      setMisses(m => m + 1); setShake(p.id); setMood('think')
      later(() => { setShake(null); setMood('happy') }, 450)
      return
    }
    haptic('good'); sound.pop(oi * 2)
    setServed(true); setMood('cheer')
    void flyGhost(productEls.current[p.id], guestEl.current, productEls.current[p.id]?.innerHTML ?? '', 340, 'ab-product-ghost').then(() => {
      burst(guestEl.current, last ? 'big' : 'small')
      setCoins(c => c + priceOf(text(order)))
      flyCoins(guestEl.current, coinsEl.current, 3)
    })
  }

  function next() {
    haptic('tap')
    if (last) { sound.win(); setSummary(true); return }
    setOi(oi + 1); setServed(false); setMisses(0); setMood('happy')
  }

  if (summary) {
    return (
      <GameFrame title="Кафе Бомборы" eyebrow="все гости довольны" fraction={fraction} onExit={onExit}>
        <div className="flex-1 flex flex-col items-center gap-4 text-center" data-testid="cafe-summary">
          <div className="ab-jump"><Mascot mood="cheer" size={110} /></div>
          <div className="text-[30px] font-extrabold tabular-nums flex items-center gap-2"><CoinIcon size={28} />{coins}</div>
          <div className="w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3 text-left" style={{ boxShadow: '3px 3px 0 #15100A' }}>
            <div className="text-[14px] font-extrabold mb-2">Ты прочитал</div>
            <div className="flex flex-col gap-1.5">
              {plan.orders.map(p => (
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
    <GameFrame title="Кафе Бомборы" eyebrow={`гость ${oi + 1} из ${plan.orders.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 flex flex-col gap-3" data-testid="cafe">
        <div className={`text-center text-[15px] font-bold leading-snug ${guided ? 'rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-3 py-2' : 'text-jewelInk-mid'}`} data-testid="cafe-howto">
          {guided ? 'Гость заказывает по-грузински. Прочитай заказ и подай нужное' : 'Прочитай заказ и подай нужное'}
        </div>

        {/* Зал: навес, вывеска, окна, гость с заказом, стойка с Бомборой. */}
        <div className="relative rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ background: 'repeating-linear-gradient(90deg, #F5EFE0 0 28px, #EFE6D2 28px 30px)', boxShadow: '3px 3px 0 #15100A' }}>
          <div className="h-5 flex">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex-1 ${i % 2 ? 'bg-cream' : 'bg-ruby'} border-b-[1.5px] border-jewelInk`} style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }} />)}
          </div>
          <div className="absolute top-7 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-lg border-[1.5px] border-jewelInk bg-navy text-cream font-geo text-[14px] font-extrabold whitespace-nowrap" style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="cafe-sign">{mixed('бомбора', lesson)}</div>
          <div ref={coinsEl} key={coins} className="absolute top-7 right-2 px-2 py-0.5 rounded-lg bg-cream-tile border border-jewelInk/40 text-[15px] font-extrabold tabular-nums flex items-center gap-1 ab-count" data-testid="cafe-coins"><CoinIcon size={16} />{coins}</div>
          <div className="absolute top-[64px] inset-x-0 flex justify-between px-3 pointer-events-none opacity-90">
            <WindowArt width={84} /><WindowArt width={84} />
          </div>

          <div className="relative pt-[60px] flex items-end justify-center gap-2 px-3" style={{ minHeight: 236 }}>
            <div key={oi} ref={guestEl} className="flex flex-col items-center ab-in" data-testid="cafe-guest" data-order={text(order)}>
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
              <div className="mt-2"><GuestArt look={oi} mood={served ? 'happy' : 'wait'} size={66} /></div>
            </div>
          </div>
          <div className="relative h-[70px] flex items-end justify-end pr-4">
            <div className="absolute bottom-0 inset-x-0 h-6 bg-[#D99844] border-t-[1.5px] border-jewelInk" />
            <div className={`relative ${mood === 'cheer' ? 'ab-jump' : mood === 'think' ? 'ab-wobble' : ''}`} key={mood + oi}>
              <Mascot mood={mood} size={74} />
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
                  className={`relative w-full h-[74px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex items-center justify-center active:scale-95 transition-transform ${shake === p.id ? 'ab-shake bg-ruby-wash' : ''} ${here ? 'ring-4 ring-gold ab-pulse' : ''}`}
                  style={{ boxShadow: '3px 3px 0 #15100A' }}
                ><ProductArt id={p.id} size={48} />{here && <Pointer />}</button>
              </div>
            )
          })}
        </div>

        <div className="mt-auto pt-2 w-full max-w-[340px] mx-auto">
          {served
            ? <Button onClick={next}>{last ? 'дальше →' : 'следующий гость →'}</Button>
            : <div className="h-[52px]" />}
        </div>
      </div>
    </GameFrame>
  )
}

/** Стрелка у верного товара в первом заказе (и после двух промахов) — внутри плитки, чтобы не задевать соседей. */
function Pointer() {
  return (
    <div className="absolute right-1.5 top-1/2 -mt-[15px] z-10 pointer-events-none ab-bob" data-testid="cafe-pointer" aria-hidden>
      <svg width="28" height="30" viewBox="0 0 30 30" fill="none" stroke="#15100A" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M2 15L15 3v7h13v10H15v7z" fill="#FCD76D" />
      </svg>
    </div>
  )
}

/** Монетки летят от гостя к счётчику. */
function flyCoins(from: Element | null, to: Element | null, n: number) {
  if (!from || !to || reducedMotion()) return
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'ab-coin-fly'
    el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#F5B820" stroke="#15100A" stroke-width="1.6"/><circle cx="12" cy="12" r="5.6" fill="#FCD76D" stroke="#C68F10" stroke-width="1.6"/></svg>'
    const x = a.left + a.width / 2 + (Math.random() - 0.5) * 30, y = a.top + a.height / 3
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, animationDelay: `${i * 60}ms` })
    el.style.setProperty('--dx', `${b.left + b.width / 2 - x}px`)
    el.style.setProperty('--dy', `${b.top + b.height / 2 - y}px`)
    document.body.appendChild(el)
    setTimeout(() => { el.remove(); if (i === n - 1) { haptic('tap'); sound.tick(i) } }, 760 + i * 60)
  }
}
