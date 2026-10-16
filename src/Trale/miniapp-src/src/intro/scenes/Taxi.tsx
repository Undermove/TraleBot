import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import { CITIES, firstMet, myName, phrase, type City, type Phrase } from '../story'
import { GameEnd, GameIntro, NewWord, RuleCard } from '../ui'
import { hush, speak, speakLine, speakUrl } from '../voice'
import type { Opt, Say } from './chatScripts'
import { cashFare, discountFor, driverAudio, fareAt, heroAudio, lari, priceAudio, priceLine, taxiTurns, toPay, type Nav, type TaxiMode, type TaxiTurn } from './taxi.logic'
import type { SceneProps, StepOf } from './types'
import Street from './walk/Street'
import { buildStreet, type View } from './walk/geometry'

/**
 * «Таксист спрашивает» — с заднего сиденья. Через лобовое стекло едет Батуми, впереди затылок таксиста,
 * в зеркале — его глаза, на панели — счётчик. Таксист болтливый: спрашивает, ты отвечаешь, он реагирует —
 * по шагам, без таймеров. На перекрёстках телефон с навигатором показывает стрелку — говоришь таксисту, куда
 * повернуть; у дома просишь остановить; в уроке 22 спрашиваешь цену. Верный ответ — скидка. В конце — чек.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const STREET_M = 1400
const DRIVE = 6.5 // м/с — едем по городу

type Eyes = 'calm' | 'smile' | 'huh'
type Turn = 'talk' | 'you' | 'speaking' | 'react' | 'drive' | 'arrive'

/** Реплика таксиста или ремарка — что в пузыре сейчас. */
interface Bubble { geo?: string; ru: string; tone?: 'bad' | 'note' }

export default function Taxi({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'taxi'>>) {
  const mode: TaxiMode = step.mode
  const [phase, setPhase] = useState<'intro' | 'dest' | 'ride' | 'end'>('intro')
  const [dest, setDest] = useState<City>(CITIES[0])
  const [round, setRound] = useState(0)
  const me = useMemo(() => myName(), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const turns: TaxiTurn[] = useMemo(() => taxiTurns(mode, dest, me, lesson.id, rng), [mode, dest, me, lesson.id, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = turns.length
  const buildings = useMemo(() => buildStreet(STREET_M, 5 + lesson.id), [lesson.id])

  const [at, setAt] = useState(0)
  const [turn, setTurn] = useState<Turn>('talk')
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [mine, setMine] = useState<string | null>(null)
  // Реакция на промах — отдельно от вопроса: вопрос остаётся на виду.
  const [oops, setOops] = useState<string | null>(null)
  const [eyes, setEyes] = useState<Eyes>('calm')
  const [talking, setTalking] = useState(false)
  const [tried, setTried] = useState<number[]>([])
  const [discount, setDiscount] = useState(0)
  const [good, setGood] = useState(0)
  const [missed, setMissed] = useState(false)
  // Слово сцены впервые — карточка «новое слово»; каждое — один раз за поездку.
  const [fresh, setFresh] = useState<Phrase | null>(null)
  const shown = useRef(new Set<string>())
  // Машина поворачивает: улица уезжает в сторону.
  const [sway, setSway] = useState<{ d: Nav; k: number } | null>(null)
  // Цена, которую назвал таксист (урок 22).
  const [cash, setCash] = useState<number | null>(null)
  const meter = useRef<HTMLDivElement>(null)
  // Улица рисуется в пропорциях окна: иначе дома растягиваются.
  const glass = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 190 })
  useEffect(() => {
    const el = glass.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 360, h: e.contentRect.height || 190 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [phase])
  const view: View = { w: 360, h: (360 * size.h) / Math.max(1, size.w), horizon: 0.52 }
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

  // Машина едет: камера улицы — плавно, тормозит у цели.
  const cam = useRef({ z: 0, v: 0 })
  const [, setFrame] = useState(0)
  const turnRef = useRef<Turn>('talk')
  // После «გააჩერე» машина стоит у дома до конца поездки.
  const parkedRef = useRef(false)
  turnRef.current = turn
  useEffect(() => {
    if (phase !== 'ride') return
    let last = performance.now()
    let id = 0
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: FrameRequestCallback) => window.setTimeout(() => f(performance.now()), 16) as unknown as number
    const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (x: number) => window.clearTimeout(x)
    const tick = () => {
      const t = performance.now(); const dt = Math.min(0.05, (t - last) / 1000); last = t
      const c = cam.current
      const target = parkedRef.current || turnRef.current === 'arrive' ? 0 : turnRef.current === 'drive' ? DRIVE * 1.4 : DRIVE
      c.v += (target - c.v) * Math.min(1, dt * 1.6)
      c.z = Math.min(STREET_M - 60, c.z + c.v * dt)
      setFrame(f => (f + 1) % 1e6)
      id = raf(tick)
    }
    id = raf(tick)
    return () => caf(id)
  }, [phase])

  /** Таксист говорит свои реплики по очереди; ремарки — в пузыре курсивом, без голоса. */
  const driverSays = async (lines: Say[]) => {
    for (const l of lines) {
      if (!alive.current) return
      if (l.kind === 'her') {
        setBubble({ geo: l.geo, ru: l.ru }); setTalking(true); setEyes('calm')
        const url = driverAudio(l.geo)
        if (url) await speakUrl(url, l.geo)
        else if (l.ids.length === 1) await speak(l.ids[0], 'm')
        else await speakLine(l.geo, 'm')
        if (alive.current) setTalking(false)
      } else if (l.kind === 'note') {
        setBubble({ ru: l.text, tone: 'note' })
        await wait(1400)
      }
    }
  }

  const open = async (k: number) => {
    setAt(k); setTried([]); setMine(null); setOops(null); setMissed(false); setTurn('talk'); setFresh(null)
    await driverSays(turns[k].her)
    if (!alive.current) return
    const want = turns[k].opts.find(o => o.good)?.ids.find(id => (lesson.scene ?? []).includes(id) && firstMet(lesson.id, id) && !shown.current.has(id))
    if (want) { shown.current.add(want); setFresh(phrase(want)) }
    setTurn('you'); busy.current = false
  }

  const begin = (c: City) => {
    haptic('pop'); sound.pop()
    setDest(c); setRound(r => r + 1)
    cam.current = { z: 0, v: 0 }; parkedRef.current = false
    setDiscount(0); setGood(0); setBubble(null); setCash(null); setFresh(null); shown.current = new Set()
    setPhase('ride')
  }
  // Новый маршрут — поездка с начала.
  useEffect(() => {
    if (phase !== 'ride') return
    const id = window.setTimeout(() => { if (alive.current) void open(0) }, 900)
    return () => window.clearTimeout(id)
  }, [phase, turns]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (k: number, o: Opt) => {
    if (turn !== 'you' || busy.current || tried.includes(k)) return
    busy.current = true
    if (!o.good) {
      // Смешная реакция таксиста — и можно ответить ещё раз.
      haptic('bad'); sound.miss()
      setTried(t => [...t, k]); setMissed(true); setEyes('huh')
      setOops(o.miss ?? 'Таксист не понял.')
      busy.current = false
      return
    }
    setTurn('speaking'); setMine(o.geo); setBubble(null); setOops(null); setFresh(null)
    haptic('tap')
    const url = heroAudio(o.geo)
    if (url) await speakUrl(url, o.geo)
    else if (o.ids.length === 1) await speak(o.ids[0], 'hero')
    else await speakLine(o.geo, 'hero')
    if (!alive.current) return
    const plus = discountFor(missed)
    setDiscount(d => d + plus); setGood(g => g + 1); setEyes('smile')
    haptic('good'); sound.snap(at)
    if (meter.current) { burst(meter.current, 'small'); floater(`−${lari(plus)}`, meter.current, '#4E8A5B') }
    setTurn('react')
    const cur = turns[at]
    if (cur.nav && cur.nav !== 'stop') { setSway({ d: cur.nav, k: at }); haptic('soft') }
    if (cur.nav === 'stop') { parkedRef.current = true; setTurn('arrive') }
    if (o.then?.length) await driverSays(o.then)
    if (!alive.current) return
    if (cur.price) {
      // Таксист смотрит на счётчик и называет цену — целыми лари, вниз в твою пользу.
      const sum = cashFare(fareAt(n), discount + plus)
      const line = priceLine(sum)
      setCash(sum)
      setBubble({ geo: line.geo, ru: line.ru }); setTalking(true); setEyes('smile')
      await speakUrl(priceAudio(sum), line.geo)
      if (!alive.current) return
      setTalking(false)
      await wait(500)
    }
    if (at + 1 >= n) {
      setTurn('arrive'); setBubble({ ru: 'Приехали!', tone: 'note' })
      sound.win(); haptic('good')
      await wait(1800)
      if (alive.current) setPhase('end')
      return
    }
    // Немного проехать молча — и следующий вопрос. После «останови» машина уже стоит.
    const parked = cur.nav === 'stop' || !!cur.price
    setTurn(parked ? 'arrive' : 'drive'); setMine(null)
    await wait(parked ? 700 : 1600)
    if (alive.current) void open(at + 1)
  }

  const fare = fareAt(Math.min(at + (turn === 'arrive' ? 1 : 0), n))

  if (phase === 'intro') return (
    <GameFrame title="Таксист спрашивает" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="taxi-scene">
        <GameIntro title="Такси по Батуми" hero
          text={mode === 'where'
            ? 'Таксист попался болтливый: всю дорогу расспрашивает. Отвечай — за хороший разговор скидка. Он обязательно спросит, где ты живёшь. А дорогу показывает навигатор в телефоне — подсказывай таксисту, куда поворачивать.'
            : 'Опять болтливый таксист. Теперь он спросит, кем ты работаешь. Каждый хороший ответ — скидка. Приедешь — спроси, сколько с тебя: таксист назовёт цену по-грузински.'}
          chips={mode === 'where' ? [{ geo: 'ბათუმში', ru: 'в Батуми' }, { geo: 'ქუთაისში', ru: 'в Кутаиси' }] : [{ geo: 'მე ვარ სტუდენტი', ru: 'я студент' }, { geo: 'ვმუშაობ', ru: 'я работаю' }]}
          onStart={() => setPhase('dest')} />
      </div>
    </GameFrame>
  )

  if (phase === 'dest') return (
    <GameFrame title="Куда едем?" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-3" data-testid="taxi-scene">
        <p className="text-center text-[14px] text-jewelInk-soft">Ты садишься в такси у моря. Выбери, куда ехать, — таксист переспросит по-грузински.</p>
        {CITIES.map((c, i) => (
          <motion.button key={c.base} onClick={() => begin(c)} data-testid="taxi-dest"
            className="min-h-[56px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-4 py-2 flex items-center justify-between" style={{ boxShadow: '3px 3px 0 #15100A' }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 0.06 }} whileTap={{ scale: 0.97 }}>
            <span className="text-[17px] font-extrabold">{c.ru}</span>
            <span className="text-right leading-tight"><span className="block font-geo font-bold text-[16px]">{c.in}</span><span className="block text-[11px] text-jewelInk-hint">{cyr(c.in)} · в {c.ru}</span></span>
          </motion.button>
        ))}
      </div>
    </GameFrame>
  )

  if (phase === 'end') {
    const total = fareAt(n)
    const pay = cash ?? toPay(total, discount)
    return (
      <GameFrame title="Приехали!" eyebrow={`такси · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
        <GameEnd
          title={`Чек: ${lari(pay)}`}
          text={`Ответил на ${good} из ${n} вопросов. Таксист доволен разговором.`}
          rule={<div className="flex flex-col gap-2 w-full max-w-[320px]">
            <motion.div className="rounded-xl border-[1.5px] border-dashed border-jewelInk bg-cream-tile px-4 py-2 text-[13px] tabular-nums" data-testid="taxi-receipt"
              initial={{ y: -20, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
              <div className="flex justify-between"><span>По счётчику</span><b>{lari(total)}</b></div>
              <div className="flex justify-between text-ruby"><span>Скидка за разговор</span><b>−{lari(cash !== null ? total - cash : Math.min(discount, total - 1))}</b></div>
              <div className="flex justify-between border-t-[1.5px] border-dashed border-jewelInk-faint mt-1 pt-1"><span>К оплате</span><b>{lari(pay)}</b></div>
              {cash !== null && <div className="flex justify-between text-jewelInk-hint" data-testid="taxi-cash"><span>Таксист сказал</span><b className="font-geo">{priceLine(cash).geo}</b></div>}
            </motion.div>
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

  const ex = turns[Math.min(at, n - 1)]
  const ready = turn === 'you'
  return (
    <GameFrame title="Таксист спрашивает" eyebrow={`в ${dest.ru} · вопрос ${Math.min(at + 1, n)} из ${n}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="taxi-scene">
        <div className="relative flex-1 min-h-[270px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="taxi-cab">
          {/* Лобовое стекло: улица едет навстречу. */}
          <div ref={glass} className="absolute inset-x-0 top-0 h-[66%] overflow-hidden">
            <motion.div key={sway ? `${sway.d}-${sway.k}` : 'still'} className="absolute inset-0"
              initial={false} animate={sway && sway.d !== 'straight' ? { x: [0, sway.d === 'right' ? -46 : 46, 0], rotate: [0, sway.d === 'right' ? -2.5 : 2.5, 0] } : { x: 0, rotate: 0 }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}>
            <Street view={view} camZ={cam.current.z} clock={0.45} bob={Math.sin(cam.current.z * 1.7) * 0.012} buildings={buildings} people={[]} end={STREET_M} rail={STREET_M * 50} time={performance.now()} />
            </motion.div>
          </div>
          <Interior />
          <Mirror eyes={eyes} talking={talking} />
          <DriverBack talking={talking} />
          {/* Телефон с навигатором: на перекрёстке — стрелка, у дома — флажок «приехали». */}
          <AnimatePresence>
            {ex.nav && (turn === 'talk' || turn === 'you' || turn === 'speaking') && (
              <motion.div key={`nav-${at}`} className="absolute left-[5%] top-[34%] z-20" data-testid="taxi-nav" data-nav={ex.nav}
                initial={{ x: -70, rotate: -18, opacity: 0 }} animate={{ x: 0, rotate: -6, opacity: 1 }} exit={{ x: -70, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
                <NavPhone nav={ex.nav} />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Новое слово — рядом с телефоном, пока ты отвечаешь. */}
          <AnimatePresence>
            {fresh && turn === 'you' && (
              <motion.div key={fresh.id} className="absolute right-[4%] top-[34%] z-30 max-w-[60%]"
                initial={{ scale: 0.5, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
                <NewWord word={fresh} />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Счётчик на панели. */}
          <div ref={meter} className="absolute right-[7%] bottom-[9%] z-20 rounded-lg border-[1.5px] border-jewelInk bg-[#15241A] px-2 py-1 text-right" data-testid="taxi-meter" style={{ boxShadow: '2px 2px 0 #15100A' }}>
            <div className="font-mono text-[15px] font-bold text-[#7CF59A] leading-none tabular-nums" data-testid="taxi-fare">{lari(fare)}</div>
            <div className="mt-0.5 text-[10px] font-bold text-[#F5B820] leading-none tabular-nums" data-testid="taxi-discount">скидка −{lari(discount)}</div>
          </div>

          <AnimatePresence>
            {bubble && (
              <div key={`${at}-${bubble.geo ?? bubble.ru}`} className="absolute z-30 left-0 right-0 top-[19%] flex justify-center px-3 pointer-events-none">
                <motion.div data-testid="taxi-driver"
                  initial={{ opacity: 0, scale: 0.6, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className={`max-w-[92%] rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 text-center ${bubble.tone === 'bad' ? 'bg-ruby-wash' : bubble.tone === 'note' ? 'bg-gold-wash' : 'bg-cream-tile'}`}
                  style={{ boxShadow: '2px 3px 0 #15100A' }}>
                  {bubble.geo
                    ? <><span className="block font-geo font-bold text-[17px] leading-tight">{bubble.geo}</span><span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(bubble.geo)} · {bubble.ru}</span></>
                    : <span className="block text-[13px] font-bold leading-snug">{bubble.ru}</span>}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {oops && (
              <div key={`o-${at}-${oops}`} className="absolute z-30 left-0 right-0 top-[39%] flex justify-center px-4 pointer-events-none">
                <motion.div data-testid="taxi-note" initial={{ opacity: 0, y: -6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1, x: [0, -5, 5, -3, 0] }} exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="max-w-[90%] rounded-xl border-[1.5px] border-jewelInk bg-ruby-wash px-2.5 py-1 text-center text-[12.5px] font-bold leading-snug" style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  {oops}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {mine && (
              <div key={`m-${at}`} className="absolute z-30 bottom-[30%] left-0 right-0 flex justify-center pointer-events-none">
                <motion.div data-testid="taxi-mine" initial={{ opacity: 0, y: 26, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="rounded-2xl border-[1.5px] border-jewelInk bg-navy text-cream px-3 py-1.5 text-center" style={{ boxShadow: '2px 3px 0 #15100A' }}>
                  <span className="block font-geo font-bold text-[16px] leading-tight">{mine}</span>
                  <span className="block text-[11px] font-semibold text-cream/80 leading-tight">{cyr(mine)}</span>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 flex flex-col gap-1.5 min-h-[120px]" data-testid="taxi-options" data-want={ready ? ex.opts.findIndex(o => o.good) : undefined}>
          {ready ? ex.opts.map((o, k) => {
            const dim = tried.includes(k)
            return (
              <motion.button key={`${at}-${k}`} disabled={dim} onClick={() => void choose(k, o)}
                data-testid={o.good ? 'taxi-reply-ok' : 'taxi-reply-miss'}
                className="min-h-[44px] w-full rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5 text-left flex items-center justify-between gap-2"
                style={{ boxShadow: '3px 3px 0 #15100A' }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: dim ? 0.35 : 1, y: 0, backgroundColor: dim ? '#F7DCDD' : tried.length >= 2 && o.good ? '#FCE9A8' : '#FDFAEF' }}
                transition={{ type: 'spring', stiffness: 420, damping: 28, delay: k * 0.04 }} whileTap={dim ? undefined : { scale: 0.97 }}>
                <span className="min-w-0">
                  <span className="block font-geo font-bold text-[15px] leading-tight">{o.geo}</span>
                  <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{cyr(o.geo)}</span>
                </span>
              </motion.button>
            )
          }) : (
            <div className="flex-1 flex items-center justify-center text-[13px] font-bold text-jewelInk-soft" data-testid="taxi-wait">
              {turn === 'drive' ? 'Едем дальше…' : turn === 'arrive' ? 'Приехали!' : 'Таксист говорит…'}
            </div>
          )}
        </div>
      </div>
    </GameFrame>
  )
}

/** Салон: крыша, стойки, приборная панель, руль, подголовник пассажирского кресла. */
function Interior() {
  const INK = '#15100A'
  return (
    <svg viewBox="0 0 360 300" preserveAspectRatio="none" width="100%" height="100%" className="absolute inset-0 z-10 pointer-events-none" aria-hidden>
      {/* Крыша и стойки — рамка лобового стекла. */}
      <path d="M0 0 H360 V22 Q180 12 0 22 Z" fill="#2A2F3A" stroke={INK} strokeWidth="2" />
      <path d="M0 22 L34 22 L8 200 L0 200 Z" fill="#2A2F3A" stroke={INK} strokeWidth="2" />
      <path d="M360 22 L326 22 L352 200 L360 200 Z" fill="#2A2F3A" stroke={INK} strokeWidth="2" />
      {/* Панель. */}
      <path d="M0 190 Q180 176 360 190 V300 H0 Z" fill="#3A3F4C" stroke={INK} strokeWidth="2.4" />
      <path d="M14 204 Q180 192 346 204" stroke="#4E5566" strokeWidth="3" fill="none" />
      {/* Шашечки такси на панели. */}
      <g transform="translate(150 212)">
        <rect width="60" height="14" rx="3" fill="#F5B820" stroke={INK} strokeWidth="1.6" />
        {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={k * 10} y={k % 2 ? 7 : 0} width="10" height="7" fill={INK} opacity="0.85" />)}
      </g>
      {/* Руль слева. */}
      <circle cx="70" cy="262" r="46" fill="none" stroke="#1E222B" strokeWidth="12" />
      <circle cx="70" cy="262" r="46" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M30 262 H110 M70 262 V300" stroke="#1E222B" strokeWidth="9" />
      {/* Подголовник пассажирского кресла справа. */}
      <rect x="244" y="118" width="70" height="56" rx="20" fill="#5B4A3A" stroke={INK} strokeWidth="2.2" />
      <path d="M262 174 v20 M296 174 v20" stroke="#9AA3B5" strokeWidth="4" />
      <path d="M232 194 Q279 180 326 194 V230 H232 Z" fill="#5B4A3A" stroke={INK} strokeWidth="2.2" />
    </svg>
  )
}

/** Затылок таксиста в кепке, плечи и подголовник; когда говорит — голова чуть кивает. */
function DriverBack({ talking }: { talking: boolean }) {
  const INK = '#15100A'
  return (
    <motion.div className="absolute left-[16%] top-[32%] z-[11] pointer-events-none" aria-hidden
      animate={talking ? { rotate: [0, -2.5, 1.5, 0], y: [0, -1.5, 0] } : { rotate: 0, y: 0 }} transition={talking ? { duration: 0.7, repeat: Infinity } : { duration: 0.3 }}>
      <svg width="120" height="150" viewBox="0 0 120 150">
        <path d="M6 150 Q8 104 60 98 Q112 104 114 150 Z" fill="#2F7F86" stroke={INK} strokeWidth="2.4" />
        <rect x="36" y="74" width="48" height="34" rx="14" fill="#5B4A3A" stroke={INK} strokeWidth="2.2" />
        <ellipse cx="60" cy="56" rx="27" ry="30" fill="#15100A" stroke={INK} strokeWidth="2.2" />
        <ellipse cx="33" cy="60" rx="5" ry="8" fill="#C68A5E" stroke={INK} strokeWidth="2" />
        <ellipse cx="87" cy="60" rx="5" ry="8" fill="#C68A5E" stroke={INK} strokeWidth="2" />
        <path d="M30 46 Q32 20 60 20 Q88 20 90 46 Q76 38 60 38 Q44 38 30 46 Z" fill="#E01A3C" stroke={INK} strokeWidth="2.2" />
        <path d="M44 24 Q60 16 76 24" stroke="#FDFAEF" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
    </motion.div>
  )
}

/** Зеркало заднего вида: в нём глаза таксиста — видно, как он реагирует. */
function Mirror({ eyes, talking }: { eyes: Eyes; talking: boolean }) {
  const INK = '#15100A'
  return (
    <motion.div className="absolute left-1/2 top-[3%] -translate-x-1/2 z-20 pointer-events-none" aria-hidden data-testid="taxi-mirror"
      animate={{ rotate: talking ? [0, 1.2, -1.2, 0] : 0 }} transition={talking ? { duration: 1.2, repeat: Infinity } : { duration: 0.3 }}>
      <svg width="130" height="40" viewBox="0 0 130 40">
        <path d="M65 0 v6" stroke={INK} strokeWidth="3" />
        <rect x="4" y="6" width="122" height="32" rx="12" fill="#2A2F3A" stroke={INK} strokeWidth="2.2" />
        <rect x="10" y="11" width="110" height="22" rx="8" fill="#C68A5E" />
        {/* Брови и глаза: спокойно / улыбается (прищур) / удивлён (брови вверх). */}
        {[42, 88].map(x => (
          <g key={x}>
            <path d={eyes === 'huh' ? `M${x - 9} 15 Q${x} 10 ${x + 9} 15` : `M${x - 9} 17 Q${x} 14 ${x + 9} 17`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            {eyes === 'smile'
              ? <path d={`M${x - 6} 25 Q${x} 20 ${x + 6} 25`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
              : <ellipse className="zw-blink" cx={x} cy="24" rx="4" ry={eyes === 'huh' ? 4.6 : 3.6} fill={INK} />}
          </g>
        ))}
        <rect x="10" y="11" width="110" height="22" rx="8" fill="#FFFFFF" opacity="0.08" />
      </svg>
    </motion.div>
  )
}

/** Телефон на держателе: навигатор со стрелкой поворота или флажком «приехали». */
function NavPhone({ nav }: { nav: Nav }) {
  const INK = '#15100A'
  return (
    <svg width="58" height="92" viewBox="0 0 58 92" aria-hidden>
      <rect x="2" y="2" width="54" height="88" rx="9" fill="#15100A" stroke={INK} strokeWidth="2" />
      <rect x="6" y="9" width="46" height="72" rx="4" fill="#D7E4DA" />
      {/* Дорога на карте. */}
      <path d="M29 81 V48" stroke="#FDFAEF" strokeWidth="10" />
      {nav === 'right' && <path d="M29 52 Q29 38 44 38" stroke="#FDFAEF" strokeWidth="10" fill="none" />}
      {nav === 'left' && <path d="M29 52 Q29 38 14 38" stroke="#FDFAEF" strokeWidth="10" fill="none" />}
      {nav === 'straight' && <path d="M29 52 V14" stroke="#FDFAEF" strokeWidth="10" />}
      {/* Стрелка маршрута. */}
      {nav === 'right' && <path d="M29 72 V50 Q29 40 40 40 M36 34 L44 40 L36 46" stroke="#1B5FB0" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {nav === 'left' && <path d="M29 72 V50 Q29 40 18 40 M22 34 L14 40 L22 46" stroke="#1B5FB0" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {nav === 'straight' && <path d="M29 72 V20 M22 27 L29 18 L36 27" stroke="#1B5FB0" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {nav === 'stop' && (
        <g>
          <path d="M29 72 V50" stroke="#1B5FB0" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M18 38 L29 28 L40 38 V50 H18 Z" fill="#E01A3C" stroke={INK} strokeWidth="1.6" />
          <rect x="26" y="42" width="6" height="8" fill="#FDFAEF" />
          <path d="M40 22 V36 M40 22 L50 26 L40 30" stroke={INK} strokeWidth="1.6" fill="#F5B820" />
        </g>
      )}
      <circle cx="29" cy="72" r="4" fill="#1B5FB0" stroke="#FDFAEF" strokeWidth="1.6" />
    </svg>
  )
}
