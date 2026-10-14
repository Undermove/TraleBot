import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import '../games/alphabet.css'
import { BackIcon, SoundToggle } from '../games/GameFrame'
import { burst, flyGhost, haptic, reducedMotion, sound } from '../games/fx'
import { mixed } from '../games/logic'
import { cyr } from '../../verbs/types'
import { CheckMark, CoinIcon, GuestArt, ProductArt, SunIcon, UpgradeArt, WindowArt } from './art'
import { UPGRADES, isOver, newDay, orderLine, serve, textOf, tick, waiting, type Day, type Guest, type UpgradeId } from './engine'
import { PRODUCTS, isRealWord, nextLessonNews, orderText, shelfFor, type Product } from './products'
import { buy, closeDay, loadSave, writeSave, type CafeSave } from './save'

// «Кафе Бомборы»: маленький тайкун на чтение. Гости заказывают словами из выученных букв,
// ты читаешь заказ и подаёшь нужное с витрины. Монеты — на апгрейды лавки, рекорд дня — повод вернуться.

type Phase = { kind: 'lobby' } | { kind: 'day' } | { kind: 'summary'; earned: number; record: boolean; day: Day }

export default function CafeScreen({ level, onExit, now: clock = () => performance.now(), rng = Math.random }: {
  /** Сколько уроков алфавита пройдено подряд. */
  level: number
  onExit: () => void
  /** Для тестов: часы и случайность. */
  now?: () => number
  rng?: () => number
}) {
  const [save, setSave] = useState<CafeSave>(() => loadSave())
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' })
  const owned = useMemo(() => new Set(save.owned), [save.owned])
  const persist = (s: CafeSave) => { setSave(s); writeSave(s) }

  function finish(day: Day) {
    const { save: s, record } = closeDay(save, day.coins)
    persist(s)
    if (record) { haptic('good'); sound.win() }
    setPhase({ kind: 'summary', earned: day.coins, record, day })
  }

  return (
    <div className="flex flex-col bg-cream" style={{ minHeight: '100dvh' }} data-testid="cafe">
      {phase.kind === 'lobby' && (
        <Lobby level={level} save={save} owned={owned} onExit={onExit}
          onBuy={id => { const s = buy(save, id); if (s) { haptic('good'); sound.win(); persist(s) } else haptic('bad') }}
          onOpen={shelf => { haptic('pop'); persist({ ...save, seen: [...new Set([...save.seen, ...shelf.map(p => p.id)])] }); setPhase({ kind: 'day' }) }}
        />
      )}
      {phase.kind === 'day' && <DayView level={level} owned={owned} onFinish={finish} clock={clock} rng={rng} />}
      {phase.kind === 'summary' && (
        <Summary {...phase} level={level} total={save.coins}
          onAgain={() => { haptic('pop'); setPhase({ kind: 'day' }) }}
          onLobby={() => { haptic('tap'); setPhase({ kind: 'lobby' }) }}
        />
      )}
    </div>
  )
}

function TopBar({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm" style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="mn-kilim" />
      <div className="px-4 py-2.5 flex items-center gap-3">
        <button onClick={onBack} aria-label="Назад" className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center" style={{ boxShadow: '2px 2px 0 #15100A' }}><BackIcon /></button>
        <div className="flex-1 min-w-0">{children}</div>
        <SoundToggle />
      </div>
    </div>
  )
}

/** Фасад лавки: навес, вывеска с именем Бомборы выученными буквами, апгрейды видны на картинке. */
function Storefront({ level, owned, mood = 'happy' }: { level: number; owned: ReadonlySet<UpgradeId>; mood?: 'happy' | 'cheer' | 'think' }) {
  const name = mixed('бомбора', level)
  return (
    <div className="relative rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile overflow-hidden" style={{ boxShadow: '4px 4px 0 #15100A' }}>
      <div className="h-6 flex">
        {Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex-1 ${i % 2 ? 'bg-cream' : 'bg-ruby'} border-b-[1.5px] border-jewelInk`} style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }} />)}
      </div>
      {owned.has('garland') && (
        <div className="absolute top-6 inset-x-0 flex justify-around px-3">
          {Array.from({ length: 9 }, (_, i) => <span key={i} className="w-2.5 h-2.5 rounded-full border border-jewelInk ab-pulse" style={{ background: ['#E01A3C', '#F5B820', '#3A7FCC'][i % 3], animationDelay: `${i * 0.15}s` }} />)}
        </div>
      )}
      <div className="flex justify-center mt-3">
        <div className={`px-4 py-1 rounded-lg border-[1.5px] border-jewelInk ${owned.has('sign') ? 'bg-navy text-cream ring-2 ring-gold' : 'bg-cream-deep text-jewelInk'}`} style={{ boxShadow: '2px 2px 0 #15100A' }}>
          <span className="text-[11px] font-bold opacity-80 mr-1.5">кафе</span>
          <span className="font-geo text-[20px] font-extrabold" data-testid="cafe-sign">{name}</span>
        </div>
      </div>
      <div className="flex items-end justify-center gap-4 pt-1">
        {owned.has('tables') && <UpgradeArt id="tables" size={46} />}
        <Mascot mood={mood} size={104} />
        {owned.has('bell') && <UpgradeArt id="bell" size={38} />}
      </div>
      <div className="h-4 bg-[#D99844] border-t-[1.5px] border-jewelInk" />
    </div>
  )
}

function Lobby({ level, save, owned, onBuy, onOpen, onExit }: {
  level: number; save: CafeSave; owned: ReadonlySet<UpgradeId>
  onBuy: (id: UpgradeId) => void; onOpen: (shelf: Product[]) => void; onExit: () => void
}) {
  const shelf = useMemo(() => shelfFor(level, 6), [level])
  const news = nextLessonNews(level)
  const firstTime = save.days === 0
  return (
    <>
      <TopBar onBack={() => { haptic('tap'); onExit() }}>
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-extrabold">Кафе Бомборы</div>
          <div className="text-[15px] font-extrabold tabular-nums flex items-center gap-1" data-testid="cafe-coins"><CoinIcon /> {save.coins}</div>
        </div>
      </TopBar>
      <div className="px-4 pt-3 flex flex-col gap-4" style={{ paddingBottom: 'calc(var(--safe-b) + 28px)' }}>
        <Storefront level={level} owned={owned} />
        <div className="flex justify-between text-[13px] font-bold text-jewelInk-mid">
          <span>рекорд дня: <span className="text-jewelInk tabular-nums">{save.best}</span></span>
          <span>дней открыто: <span className="text-jewelInk tabular-nums">{save.days}</span></span>
        </div>
        {firstTime && (
          <div className="rounded-xl bg-gold-wash border-[1.5px] border-jewelInk px-3 py-2 text-[14px] font-bold leading-snug" data-testid="cafe-howto">
            Гости пишут заказ теми буквами, что ты уже знаешь. Прочитай и тапни нужное на витрине. Быстро — чаевые больше.
          </div>
        )}
        <Button onClick={() => onOpen(shelf)}>открыть кафе</Button>

        <section>
          <div className="mn-eyebrow mb-2">меню на сегодня</div>
          <div className="grid grid-cols-3 gap-2">
            {shelf.map(p => (
              <div key={p.id} className="relative rounded-xl border-[1.5px] border-jewelInk/40 bg-cream-tile py-2 flex flex-col items-center" data-testid="cafe-menu-item">
                {!save.seen.includes(p.id) && save.days > 0 && <span className="absolute -top-2 -right-1 px-1.5 rounded-md bg-ruby text-cream text-[10px] font-extrabold border border-jewelInk">новое</span>}
                <ProductArt id={p.id} size={40} />
                <span className="text-[13px] font-bold">{p.ru}</span>
              </div>
            ))}
          </div>
          {news && (news.added.length > 0 || news.becameReal.length > 0) && (
            <div className="mt-2 text-[13px] text-jewelInk-mid leading-snug" data-testid="cafe-news">
              После урока {news.lesson}:
              {news.added.length > 0 && <> в меню появится {news.added.map(p => p.ru).join(', ')}</>}
              {news.added.length > 0 && news.becameReal.length > 0 && ';'}
              {news.becameReal.length > 0 && <> {news.becameReal.map(p => p.ru).join(', ')} гости напишут настоящим грузинским словом</>}.
            </div>
          )}
        </section>

        <section>
          <div className="mn-eyebrow mb-2">лавка</div>
          <div className="flex flex-col gap-2">
            {UPGRADES.map(u => {
              const has = owned.has(u.id)
              const can = !has && save.coins >= u.cost
              return (
                <div key={u.id} className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 ${has ? 'bg-navy-wash border-jewelInk' : 'bg-cream-tile border-jewelInk/40'}`} data-testid={`upgrade-${u.id}`}>
                  <UpgradeArt id={u.id} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-extrabold">{u.title}</div>
                    <div className="text-[12px] text-jewelInk-mid leading-snug">{u.effect}</div>
                  </div>
                  {has
                    ? <span className="text-[12px] font-extrabold text-navy flex items-center gap-1"><CheckMark /> есть</span>
                    : (
                      <button
                        onClick={() => onBuy(u.id)}
                        disabled={!can}
                        className={`min-w-[72px] h-11 rounded-xl border-[1.5px] border-jewelInk text-[14px] font-extrabold flex items-center justify-center gap-1 ${can ? 'bg-gold' : 'bg-cream-deep text-jewelInk/40'}`}
                        style={can ? { boxShadow: '2px 2px 0 #15100A' } : undefined}
                      ><CoinIcon size={16} />{u.cost}</button>
                    )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}

function DayView({ level, owned, onFinish, clock, rng }: {
  level: number; owned: ReadonlySet<UpgradeId>; onFinish: (d: Day) => void; clock: () => number; rng: () => number
}) {
  const shelf = useMemo(() => shelfFor(level, 6, rng), [level]) // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(() => newDay({ level, shelf, owned }))
  const dayRef = useRef(day)
  const elapsed = useRef(0)
  const last = useRef(clock())
  const ended = useRef(false)
  const [now, setNow] = useState(0)
  const [mood, setMood] = useState<'happy' | 'cheer' | 'think'>('happy')
  const [shake, setShake] = useState<string | null>(null)
  const guestEls = useRef<Record<number, HTMLDivElement | null>>({})
  const productEls = useRef<Record<string, HTMLButtonElement | null>>({})
  const coinsEl = useRef<HTMLDivElement>(null)
  const moodTimer = useRef<ReturnType<typeof setTimeout>>()

  const commit = (d: Day) => { dayRef.current = d; setDay(d) }
  const react = (m: 'cheer' | 'think') => { setMood(m); clearTimeout(moodTimer.current); moodTimer.current = setTimeout(() => setMood('happy'), 900) }

  useEffect(() => {
    // Время дня идёт только пока экран виден: свернул Telegram — кафе на паузе.
    const step = () => {
      const t = clock()
      if (document.visibilityState !== 'hidden') elapsed.current += Math.min(250, t - last.current)
      last.current = t
      const before = dayRef.current
      const d = tick(before, elapsed.current, rng)
      if (d.guests.length > before.guests.length) haptic('soft')
      if (d.lost > before.lost) { haptic('bad'); sound.miss() }
      commit(d); setNow(elapsed.current)
      if (!ended.current && isOver(d, elapsed.current)) { ended.current = true; onFinish(d) }
    }
    const id = setInterval(step, 100)
    return () => { clearInterval(id); clearTimeout(moodTimer.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function give(p: Product) {
    const { day: d, result } = serve(dayRef.current, p.id, elapsed.current)
    commit(d)
    if (result.kind === 'wrong') {
      haptic('bad'); sound.miss(); react('think')
      setShake(p.id); setTimeout(() => setShake(null), 400)
      return
    }
    const guest = guestEls.current[result.guestId]
    void flyGhost(productEls.current[p.id], guest, productEls.current[p.id]?.innerHTML ?? '', 320, 'ab-product-ghost')
    if (result.kind === 'part') { haptic('pop'); sound.snap(1); return }
    haptic('good'); sound.pop(d.combo); react('cheer')
    burst(guest, d.combo >= 3 ? 'big' : 'small')
    flyCoins(guest, coinsEl.current, Math.min(6, 2 + Math.floor(result.coins / 4)))
  }

  function stop() {
    haptic('tap')
    if (ended.current) return
    ended.current = true
    onFinish(dayRef.current)
  }

  const timeLeft = Math.max(0, 1 - now / day.length)
  const seats = Array.from({ length: day.seats }, (_, i) => i)
  // Гости занимают места по порядку прихода; ушедшие доигрывают анимацию на своём месте.
  const bySeat = useSeats(day.guests, day.seats)

  return (
    <>
      <TopBar onBack={stop}>
        <div className="flex items-center gap-2">
          <SunIcon />
          <div className="flex-1 h-2.5 rounded-full bg-cream-deep border border-jewelInk/40 overflow-hidden" data-testid="cafe-timer">
            <div className="h-full bg-gold transition-[width] duration-100 ease-linear" style={{ width: `${timeLeft * 100}%` }} />
          </div>
          <div ref={coinsEl} key={day.coins} className="text-[16px] font-extrabold tabular-nums flex items-center gap-1 ab-count" data-testid="cafe-day-coins"><CoinIcon /> {day.coins}</div>
        </div>
      </TopBar>

      <div className="flex-1 flex flex-col" style={{ paddingBottom: 'calc(var(--safe-b) + 14px)' }}>
        {/* Зал: стена с окном и навесом, гости, стойка с Бомборой. */}
        <div className="relative flex-1 flex flex-col justify-end px-3 overflow-hidden" style={{ background: 'repeating-linear-gradient(90deg, #F5EFE0 0 28px, #EFE6D2 28px 30px)' }}>
          <div className="absolute top-0 inset-x-0 h-5 flex">
            {Array.from({ length: 12 }, (_, i) => <div key={i} className={`flex-1 ${i % 2 ? 'bg-cream' : 'bg-ruby'} border-b-[1.5px] border-jewelInk`} style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }} />)}
          </div>
          <div className="absolute top-9 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-lg border-[1.5px] border-jewelInk bg-navy text-cream font-geo text-[15px] font-extrabold" style={{ boxShadow: '2px 2px 0 #15100A' }}>{mixed('бомбора', level)}</div>
          <div className="absolute top-[78px] inset-x-0 flex justify-between px-5 pointer-events-none">
            <WindowArt width={118} />
            {owned.has('tables') ? <UpgradeArt id="tables" size={60} /> : <WindowArt width={118} />}
          </div>
          {owned.has('garland') && (
            <div className="absolute top-6 inset-x-0 flex justify-around px-3">
              {Array.from({ length: 9 }, (_, i) => <span key={i} className="w-2 h-2 rounded-full border border-jewelInk ab-pulse" style={{ background: ['#E01A3C', '#F5B820', '#3A7FCC'][i % 3], animationDelay: `${i * 0.15}s` }} />)}
            </div>
          )}
          <div className="h-7 text-center relative">
            {day.combo >= 2 && <span key={day.combo} className="inline-block px-2 py-0.5 rounded-full bg-ruby text-cream text-[13px] font-extrabold border border-jewelInk ab-snap" data-testid="cafe-combo">серия ×{day.combo}</span>}
          </div>
          <div className={`grid gap-1.5 ${day.seats === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} style={{ minHeight: 196 }}>
            {seats.map(i => {
              const g = bySeat[i]
              return (
                <div key={i} className="flex flex-col items-center justify-end">
                  {g && <GuestCard key={g.id} guest={g} day={day} now={now} innerRef={el => { guestEls.current[g.id] = el }} />}
                </div>
              )
            })}
          </div>
          <div className="relative mt-1 h-[84px] flex items-end justify-center">
            <div className="absolute bottom-0 -inset-x-3 h-7 bg-[#D99844] border-y-[1.5px] border-jewelInk" />
            <div className={`relative ${mood === 'cheer' ? 'ab-jump' : mood === 'think' ? 'ab-wobble' : ''}`} key={mood + day.served + day.combo}>
              <Mascot mood={mood} size={88} />
            </div>
          </div>
          {waiting(day).length === 0 && now < 2500 && <div className="absolute top-20 inset-x-0 text-center text-[13px] font-bold text-jewelInk-hint">Сейчас придёт первый гость…</div>}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 px-3" data-testid="cafe-shelf">
          {day.cfg.shelf.map(p => (
            <button
              key={p.id}
              ref={el => { productEls.current[p.id] = el }}
              onClick={() => give(p)}
              aria-label={p.ru}
              data-testid={`shelf-${p.id}`}
              className={`h-[76px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile flex items-center justify-center active:scale-95 transition-transform ${shake === p.id ? 'ab-shake bg-ruby-wash' : ''}`}
              style={{ boxShadow: '3px 3px 0 #15100A' }}
            ><ProductArt id={p.id} size={50} /></button>
          ))}
        </div>
      </div>
    </>
  )
}

/** Место за стойкой у каждого гостя постоянное: пока он не ушёл, соседи не сдвигаются. */
function useSeats(guests: Guest[], seats: number): (Guest | undefined)[] {
  const map = useRef<Map<number, number>>(new Map())
  const present = new Set(guests.map(g => g.id))
  for (const id of [...map.current.keys()]) if (!present.has(id)) map.current.delete(id)
  for (const g of guests) {
    if (map.current.has(g.id)) continue
    const taken = new Set(map.current.values())
    const free = Array.from({ length: seats }, (_, i) => i).find(i => !taken.has(i))
    if (free !== undefined) map.current.set(g.id, free)
  }
  const out: (Guest | undefined)[] = Array(seats).fill(undefined)
  for (const g of guests) { const s = map.current.get(g.id); if (s !== undefined) out[s] = g }
  return out
}

function GuestCard({ guest: g, day, now, innerRef }: { guest: Guest; day: Day; now: number; innerRef: (el: HTMLDivElement | null) => void }) {
  const left = Math.max(0, 1 - (now - g.arrivedAt) / g.patience)
  const bar = left > 0.5 ? 'bg-navy' : left > 0.25 ? 'bg-gold' : 'bg-ruby'
  const anim = g.mood === 'happy' ? 'ab-out-happy' : g.mood === 'sad' ? 'ab-out-sad' : 'ab-in'
  const long = orderLine(day, g).length > 10
  return (
    <div ref={innerRef} className={`flex flex-col items-center w-full ${anim}`} data-testid="cafe-guest" data-order={orderLine(day, g)} data-mood={g.mood}>
      <div className="relative w-full rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-1 py-1.5 text-center" style={{ boxShadow: '2px 2px 0 #15100A' }}>
        {g.items.map((id, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="font-geo text-[12px] font-bold text-jewelInk-mid leading-none">და</div>}
            <div className={`font-geo font-extrabold leading-tight break-words ${long ? 'text-[15px]' : 'text-[18px]'} ${g.got[i] ? 'line-through text-jewelInk/35' : ''}`} data-testid="cafe-order">
              {textOf(day, id)}{g.got[i] && <span className="ml-0.5"><CheckMark size={12} /></span>}
            </div>
          </React.Fragment>
        ))}
        <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-cream-tile border-r-[1.5px] border-b-[1.5px] border-jewelInk" />
      </div>
      <div className="mt-2"><GuestArt look={g.look} mood={g.mood} size={58} /></div>
      {g.mood === 'happy' && g.paid !== undefined && <div className="text-[14px] font-extrabold text-gold-deep flex items-center gap-0.5"><CoinIcon size={14} />+{g.paid}</div>}
      {g.mood === 'wait' && (
        <div className="mt-1 w-[80%] h-1.5 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
          <div className={`h-full ${bar}`} style={{ width: `${left * 100}%` }} />
        </div>
      )}
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
    setTimeout(() => { el.remove(); if (i === n - 1) haptic('tap') }, 760 + i * 60)
  }
}

function Summary({ earned, record, day, level, total, onAgain, onLobby }: {
  earned: number; record: boolean; day: Day; level: number; total: number; onAgain: () => void; onLobby: () => void
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (earned <= 0) return
    let n = 0
    const stepBy = Math.max(1, Math.ceil(earned / 30))
    const id = setInterval(() => {
      n = Math.min(earned, n + stepBy); setShown(n); sound.tick(n)
      if (n >= earned) { clearInterval(id); burst(null, record ? 'big' : 'small') }
    }, 40)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const words = [...new Set(day.read)]
  const productOf = (text: string) => PRODUCTS.find(p => orderText(p, level) === text)
  return (
    <div className="flex flex-col items-center px-5 text-center" style={{ minHeight: '100dvh', paddingTop: 'calc(var(--safe-t) + 20px)', paddingBottom: 'calc(var(--safe-b) + 20px)' }} data-testid="cafe-summary">
      <Mascot mood={record ? 'cheer' : 'happy'} size={110} />
      <div className="mn-eyebrow text-navy mt-1">день закрыт</div>
      <div className="mt-1 text-[34px] font-extrabold tabular-nums flex items-center gap-2"><CoinIcon size={30} />+{shown}</div>
      {record && <div className="mt-1 px-3 py-1 rounded-full bg-ruby text-cream text-[13px] font-extrabold border-[1.5px] border-jewelInk ab-snap" data-testid="cafe-record">новый рекорд дня</div>}
      <div className="mt-2 text-[14px] font-bold text-jewelInk-mid">
        довольных гостей: {day.served} · ушли голодными: {day.lost} · лучшая серия: {day.bestCombo}
      </div>
      <div className="mt-1 text-[13px] text-jewelInk-hint flex items-center gap-1">в копилке <CoinIcon size={14} /> {total}</div>

      {words.length > 0 && (
        <div className="mt-4 w-full max-w-[360px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-3 text-left" style={{ boxShadow: '3px 3px 0 #15100A' }}>
          <div className="text-[14px] font-extrabold mb-2">Ты сегодня прочитал</div>
          <div className="flex flex-wrap gap-1.5">
            {words.map(w => {
              const p = productOf(w)
              const real = p && isRealWord(p, level)
              return (
                <span key={w} className="px-2 py-1 rounded-lg bg-cream-deep border border-jewelInk/30 text-[13px]">
                  <span className="font-geo font-extrabold">{w}</span>
                  {real && <span className="text-jewelInk-hint"> «{cyr(w)}»</span>}
                  {p && <span className="text-jewelInk-mid"> — {p.ru}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-5 w-full max-w-[360px] flex flex-col gap-3">
        <Button onClick={onAgain}>ещё день</Button>
        <Button variant="ghost" onClick={onLobby}>в лавку</Button>
      </div>
    </div>
  )
}
