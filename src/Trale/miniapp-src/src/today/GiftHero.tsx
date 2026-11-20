import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useTransform } from 'framer-motion'
import { Gift3DHandle } from './Gift3D'
import LootBox from './LootBox'
import Padlock from './Padlock'
import { buzz, reducedMotion, useTilt } from './sensors'
import { appEvents } from '../analytics/appEvents'
import './today.css'

// Верх главной: Бомбора с репликой и подарок дня — награда в конце дня, как сундук в конце заданий у Duolingo.
//  · locked — шаги дня ещё не пройдены: подарок крутится и ждёт; нажал — мотнулся «закрыто», Бомбора объясняет;
//  · ready — всё пройдено: подарок светится и прыгает, нажал — распаковка (onOpen);
//  · claimed — открыт сегодня: стоит раскрытым.
// Бомбора — тамагочи: нажал — покормить (как раньше). Сцена чуть следует за наклоном телефона.

export type GiftState = 'locked' | 'ready' | 'claimed'

const FLOAT = ['ა', 'ბ', 'გ', 'დ', 'ვ', 'ზ', 'თ', 'ლ', 'მ', 'ქ', 'ღ', 'შ']

interface Props {
  mascot: React.ReactNode
  say: string
  gift: GiftState
  /** Что сказать, если нажали на закрытый подарок. */
  lockedSay: string
  onOpen: () => void
  onBombora: () => void
  /** Редкость открытой коробки — её цвет. */
  rarity?: number
  /** Подпись на закрытой коробке. */
  lockChip?: string
  /** Нажали на закрытый: замок щёлкает — и сразу в занятие (ключ от подарка). Нет — только объяснение. */
  onLocked?: () => void
}

export default function GiftHero({ mascot, say, gift, lockedSay, onOpen, onBombora, rarity = 0, lockChip = 'в конце дня', onLocked }: Props) {
  const [jiggle, setJiggle] = useState(0)
  const box = useRef<Gift3DHandle>(null)
  const still = useMemo(reducedMotion, [])
  const [hint, setHint] = useState<string | null>(null)
  const tilt = useTilt(!still)
  const [t, setT] = useState({ x: 0, y: 0 })
  useMotionValueEvent(tilt.x, 'change', x => setT(v => ({ ...v, x })))
  useMotionValueEvent(tilt.y, 'change', y => setT(v => ({ ...v, y })))
  const farX = useTransform(tilt.x, v => v * -14)
  const midX = useTransform(tilt.x, v => v * 6)

  useEffect(() => {
    if (!hint) return
    const id = setTimeout(() => setHint(null), 2600)
    return () => clearTimeout(id)
  }, [hint])

  function tapGift() {
    if (gift === 'ready') { appEvents.tap('today-gift-open'); onOpen(); return }
    appEvents.tap(`today-gift-${gift}`)
    box.current?.nope()
    setJiggle(j => j + 1)
    setHint(lockedSay)
    if (onLocked) setTimeout(onLocked, 750)
  }

  const bubble = hint ?? say

  return (
    <div className="relative w-full" style={{ height: 196 }} data-testid="today-stage">
      {!still && (
        <motion.div className="absolute inset-0 overflow-hidden" style={{ x: farX }} aria-hidden="true">
          {FLOAT.map((l, i) => (
            <span key={i} className="td-letter" style={{
              left: `${(i * 37 + 7) % 92}%`, top: `${(i * 53 + 11) % 80}%`, fontSize: 18 + (i % 4) * 7,
              color: ['#1B5FB0', '#E01A3C', '#F5B820'][i % 3], opacity: 0.12,
              ['--d' as any]: `${7 + (i % 5) * 1.7}s`, ['--mx' as any]: `${(i % 2 ? 1 : -1) * (6 + i % 4 * 3)}px`,
              ['--my' as any]: `${(i % 3 ? -1 : 1) * (8 + i % 3 * 4)}px`, ['--r0' as any]: `${(i % 5) * 6 - 12}deg`, ['--r1' as any]: `${(i % 4) * -7 + 10}deg`
            }}>{l}</span>
          ))}
        </motion.div>
      )}

      {/* Реплика Бомборы */}
      <div className="absolute left-0 top-0 z-[2]" style={{ maxWidth: '56%' }}>
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

      {/* Бомбора: нажал — покормить. */}
      <motion.button type="button" aria-label="Покормить Бомбору" onClick={() => { buzz.light(); onBombora() }}
        className="absolute left-0 bottom-0 z-[1] active:scale-95 transition-transform" style={{ x: midX }} data-testid="today-bombora">
        {mascot}
      </motion.button>

      {/* Подарок дня */}
      <div className="absolute -right-4 -bottom-3 z-[1] flex flex-col items-center">
        <button
          type="button"
          onClick={tapGift}
          aria-label={gift === 'ready' ? 'Открыть подарок дня' : gift === 'claimed' ? 'Подарок дня открыт' : 'Подарок дня — откроется в конце'}
          className={`relative block ${gift === 'ready' ? 'td-ready' : ''}`}
          data-testid="gift-button"
          data-gift={gift}
        >
          <LootBox ref={box} level={gift === 'claimed' ? rarity : 0} size={92} opened={gift === 'claimed'} ajar={gift === 'claimed'} idle={!still} tilt={t} />
          {gift === 'locked' && onLocked && (
            <span key={jiggle} className={`absolute left-1/2 top-[46%] z-[2] -translate-x-1/2 -translate-y-1/2 ${jiggle ? 'td-lock-jiggle' : ''}`} data-testid="gift-lock">
              <Padlock size={34} />
            </span>
          )}
          {gift !== 'claimed' && (
            <span className={`absolute bottom-1 left-1/2 z-[2] whitespace-nowrap rounded-full px-2.5 py-1 font-sans text-[11px] font-extrabold ${gift === 'ready' ? 'td-tap bg-ruby text-cream' : 'bg-jewelInk/80 text-cream'}`}
              style={gift === 'ready' ? undefined : { transform: 'translateX(-50%)' }} data-testid="gift-hint">
              {gift === 'ready' ? 'открой!' : lockChip}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
