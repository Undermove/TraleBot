import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useTransform } from 'framer-motion'
import GiftBox, { GiftBoxHandle } from './GiftBox'
import { buzz, reducedMotion, useShake, useTilt } from './sensors'
import { cyr } from '../verbs/types'
import { appEvents } from '../analytics/appEvents'
import './today.css'

// Сцена главной: Бомбора с репликой и «подарок дня». Коробку хочется нажать: она живая, сжимается под
// пальцем, отвечает вибрацией и открывается фонтаном букв. Сцена чуть сдвигается за наклоном телефона —
// слои на разной глубине. Пасхалка: потряси телефон (или потыкай Бомбору) — из него выпадет слово.

const FLOAT = ['ა', 'ბ', 'გ', 'დ', 'ვ', 'ზ', 'თ', 'ლ', 'მ', 'ქ', 'ღ', 'შ']
/** Слова-сюрпризы, если своих слов ещё нет. Тёплые и простые. */
const SURPRISE = [
  { ka: 'მეგობარი', ru: 'друг' },
  { ka: 'ბედნიერება', ru: 'счастье' },
  { ka: 'გემრიელი', ru: 'вкусный' },
  { ka: 'მზე', ru: 'солнце' },
  { ka: 'სიყვარული', ru: 'любовь' },
  { ka: 'ყოჩაღ', ru: 'молодец' },
  { ka: 'ჩურჩხელა', ru: 'чурчхела' },
  { ka: 'ზღვა', ru: 'море' }
]
/** Что говорит Бомбора, если её тыкать. */
const POKES = [
  { ka: 'გამარჯობა!', ru: 'привет!' },
  { ka: 'მოდი!', ru: 'давай!' },
  { ka: 'ყოჩაღ!', ru: 'молодец!' },
  { ka: 'ვაიმე!', ru: 'ой!' }
]

export interface StageHandle {
  /** Открыть коробку и после анимации вызвать go. */
  open: (go: () => void) => void
}

interface Props {
  mascot: React.ReactNode
  /** Реплика Бомборы. */
  say: string
  /** Коробка уже открыта (сегодня сделано). */
  opened: boolean
  /** Что внутри — короткие ярлыки: «4 слова», «3 формы», «урок». */
  inside: string[]
  /** Нажали на коробку — открыть и перейти. */
  onBoxGo?: () => void
  /** Слова человека — для пасхалки. */
  words?: { ka: string; ru: string }[]
}

const TodayStage = forwardRef<StageHandle, Props>(function TodayStage({ mascot, say, opened, inside, onBoxGo, words = [] }, ref) {
  const box = useRef<GiftBoxHandle>(null)
  const boxWrap = useRef<HTMLDivElement>(null)
  const [opening, setOpening] = useState(false)
  const [poke, setPoke] = useState<{ ka: string; ru: string } | null>(null)
  const [surprise, setSurprise] = useState<{ ka: string; ru: string } | null>(null)
  const [mascotHop, setMascotHop] = useState(0)
  const pokes = useRef<number[]>([])
  const still = useMemo(reducedMotion, [])
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const tilt = useTilt(!still)
  // Слои на разной глубине: буквы на фоне — против наклона, Бомбора — чуть, коробка — сильнее.
  const farX = useTransform(tilt.x, v => v * -14)
  const farY = useTransform(tilt.y, v => v * -10)
  const midX = useTransform(tilt.x, v => v * 6)
  const nearX = useTransform(tilt.x, v => v * 14)
  const nearY = useTransform(tilt.y, v => v * 6)
  const nearRot = useTransform(tilt.x, v => v * 4)

  async function open(go: () => void) {
    if (opening) return
    setOpening(true)
    appEvents.tap('today-gift')
    await box.current?.open()
    await new Promise(r => setTimeout(r, still ? 0 : 280))
    go()
    // Если ушли на занятие — сцена уже размонтирована. Если остались (экран покупки поверх) — закрыть коробку обратно.
    setTimeout(() => { if (mounted.current) { setOpening(false); box.current?.reset() } }, 600)
  }
  useImperativeHandle(ref, () => ({ open }))

  function shakeSurprise() {
    if (opening) return
    const pool = words.length >= 3 ? words : SURPRISE
    const word = pool[Math.floor(Math.random() * pool.length)]
    buzz.heavy()
    setTimeout(buzz.heavy, 120)
    setTimeout(buzz.success, 420)
    setMascotHop(h => h + 1)
    box.current?.hop()
    if (!still) letterRain()
    setSurprise(word)
    appEvents.tap('today-shake')
  }
  useShake(shakeSurprise)

  function pokeBombora() {
    buzz.light()
    setMascotHop(h => h + 1)
    const now = Date.now()
    pokes.current = [...pokes.current.filter(t => now - t < 2500), now]
    if (pokes.current.length >= 5) {
      pokes.current = []
      shakeSurprise()
      return
    }
    setPoke(POKES[Math.floor(Math.random() * POKES.length)])
  }

  useEffect(() => {
    if (!poke) return
    const t = setTimeout(() => setPoke(null), 1800)
    return () => clearTimeout(t)
  }, [poke])

  const bubble = poke ? `${poke.ka} (${cyr(poke.ka.replace('!', ''))}) — ${poke.ru}` : say

  return (
    <div className="relative w-full" style={{ height: 232 }} data-testid="today-stage">
      {/* Дальний слой: плывущие буквы. */}
      {!still && (
        <motion.div className="absolute inset-0 overflow-hidden" style={{ x: farX, y: farY }} aria-hidden="true">
          {FLOAT.map((l, i) => (
            <span key={i} className="td-letter" style={{
              left: `${(i * 37 + 7) % 92}%`, top: `${(i * 53 + 11) % 80}%`, fontSize: 18 + (i % 4) * 7,
              color: ['#1B5FB0', '#E01A3C', '#F5B820'][i % 3], opacity: 0.13,
              ['--d' as any]: `${7 + (i % 5) * 1.7}s`, ['--mx' as any]: `${(i % 2 ? 1 : -1) * (6 + i % 4 * 3)}px`,
              ['--my' as any]: `${(i % 3 ? -1 : 1) * (8 + i % 3 * 4)}px`, ['--r0' as any]: `${(i % 5) * 6 - 12}deg`, ['--r1' as any]: `${(i % 4) * -7 + 10}deg`
            }}>{l}</span>
          ))}
        </motion.div>
      )}

      {/* Реплика Бомборы */}
      <div className="absolute left-0 top-1 z-[2]" style={{ maxWidth: '62%' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={bubble}
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            style={{ transformOrigin: '20% 100%' }}
            className="relative bg-cream-tile border-[1.5px] border-jewelInk rounded-2xl px-3 py-2 font-sans text-[13.500px] font-bold leading-snug text-jewelInk"
            data-testid="today-say"
          >
            {bubble}
            <span className="absolute -bottom-[7px] left-8 w-3 h-3 bg-cream-tile border-r-[1.5px] border-b-[1.5px] border-jewelInk rotate-45" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Бомбора — тык: прыжок, вибрация, словечко. */}
      <motion.button
        type="button"
        aria-label="Бомбора"
        onClick={pokeBombora}
        className="absolute left-0 bottom-0 z-[1]"
        style={{ x: midX }}
        data-testid="today-bombora"
      >
        <motion.div key={mascotHop} initial={mascotHop ? { y: 0 } : false} animate={mascotHop && !still ? { y: [0, -22, 0, -6, 0], scaleY: [1, 1.06, 0.92, 1.02, 1] } : {}} transition={{ duration: 0.6 }}>
          {mascot}
        </motion.div>
      </motion.button>

      {/* Коробка */}
      <motion.div
        ref={boxWrap}
        className="absolute right-0 bottom-0 z-[1] flex flex-col items-center"
        style={{ x: nearX, y: nearY, rotate: nearRot }}
      >
        <button
          type="button"
          aria-label={opened ? 'Подарок дня открыт' : 'Открыть подарок дня'}
          onClick={() => { if (!opened && onBoxGo) onBoxGo(); else { buzz.light(); box.current?.hop() } }}
          className="block"
        >
          <GiftBox
            ref={box}
            opened={opened}
            idle={!opening && !still}
            size={150}
            onPointerDown={() => { if (!opened) { buzz.soft(); box.current?.squash(true) } }}
            onPointerUp={() => box.current?.squash(false)}
            onPointerLeave={() => box.current?.squash(false)}
          />
        </button>
        {/* Что внутри — вылетает из коробки при открытии. */}
        <AnimatePresence>
          {opening && inside.map((label, i) => (
            <motion.div
              key={label}
              className="absolute left-1/2 top-[40%] whitespace-nowrap rounded-full border-[1.5px] border-jewelInk bg-gold px-3 py-1 font-sans text-[13px] font-extrabold text-jewelInk"
              style={{ boxShadow: '2px 2px 0 #15100A' }}
              initial={{ x: '-50%', y: 0, scale: 0.2, opacity: 0 }}
              animate={{ x: `calc(-50% + ${(i - (inside.length - 1) / 2) * 46}px)`, y: -78 - (i % 2) * 26, scale: 1, opacity: 1 }}
              transition={{ delay: 0.62 + i * 0.09, type: 'spring', stiffness: 300, damping: 16 }}
            >
              {label}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Пасхалка: выпавшее слово */}
      <AnimatePresence>
        {surprise && (
          <motion.button
            type="button"
            onClick={() => { buzz.tick(); setSurprise(null) }}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-jewelInk/40 px-8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            data-testid="today-surprise"
          >
            <motion.div
              className="jewel-tile w-full max-w-[320px] px-6 py-6 text-center"
              initial={{ y: -260, rotate: -14, scale: 0.7 }}
              animate={{ y: 0, rotate: [-14, 6, -3, 0], scale: 1 }}
              exit={{ y: 300, rotate: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            >
              <div className="relative z-[1]">
                <div className="mn-eyebrow text-ruby">Слово-сюрприз от Бомборы</div>
                <div className="mt-3 font-geo text-[34px] font-extrabold leading-tight text-navy">{surprise.ka}</div>
                <div className="mt-1 font-sans text-[14px] font-semibold text-jewelInk-mid">{cyr(surprise.ka)}</div>
                <div className="mt-3 font-sans text-[18px] font-extrabold text-jewelInk">{surprise.ru}</div>
                <div className="mt-4 font-sans text-[12px] font-semibold text-jewelInk-hint">нажми, чтобы закрыть · потряси ещё</div>
              </div>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
})

function letterRain() {
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('div')
    el.className = 'td-rain'
    el.textContent = FLOAT[Math.floor(Math.random() * FLOAT.length)]
    el.style.left = `${Math.random() * 100}vw`
    el.style.fontSize = `${18 + Math.random() * 20}px`
    el.style.color = ['#1B5FB0', '#E01A3C', '#F5B820'][i % 3]
    el.style.animationDelay = `${Math.random() * 400}ms`
    el.style.setProperty('--dur', `${1100 + Math.random() * 700}ms`)
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`)
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2400)
  }
}

export default TodayStage
