import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Gift3D, { Gift3DHandle } from './Gift3D'
import { buzz, reducedMotion } from './sensors'
import { appEvents } from '../analytics/appEvents'

// Распаковка подарка дня — на весь экран: подарок прилетает в центр, ждёт нажатия, раскрывается лепестками,
// изнутри поднимается итог дня. «Забрать» — закрыть; подарок на главной остаётся раскрытым до завтра.

/** Подарок дня забран сегодня — помним на этом телефоне (день — как у задания, по UTC). */
const key = (day: string) => `today-gift-${day}`
export const utcDay = () => new Date().toISOString().slice(0, 10)
export function giftClaimed(day = utcDay()): boolean {
  try { return localStorage.getItem(key(day)) === '1' } catch { return false }
}
function claim(day: string) { try { localStorage.setItem(key(day), '1') } catch {} }
/** Только для стенда: подарок снова не забран. */
export function unclaimGift(day: string) { try { localStorage.removeItem(key(day)) } catch {} }

interface Props {
  day: string
  /** Опыт за сегодня (если знаем). */
  xp: number | null
  streak: number
  onClose: () => void
  /** Подарок лопнул — Бомбора радуется. */
  onCheer: () => void
}

export default function GiftReveal({ day, xp, streak, onClose, onCheer }: Props) {
  const box = useRef<Gift3DHandle>(null)
  const [opened, setOpened] = useState(false)
  // Подарок открываешь сам: три тапа — каждый подбрасывает его сильнее, на третьем он лопается.
  const [taps, setTaps] = useState(0)
  const TAPS = 3

  useEffect(() => { buzz.soft() }, [])

  async function tap() {
    if (opened) return
    const n = taps + 1
    setTaps(n)
    if (n < TAPS) { box.current?.knock(n); return }
    appEvents.tap('today-gift-unbox')
    onCheer()
    await box.current?.open()
    setOpened(true)
    claim(day)
  }

  const streakText = `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд`

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(circle at 50% 45%, rgba(253,250,239,.97), rgba(245,232,200,.97))', paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-testid="gift-reveal"
    >
      <div className="mn-eyebrow text-ruby">Подарок дня</div>
      <div className="mt-1 h-[30px] font-sans text-[22px] font-extrabold text-jewelInk text-center">
        {opened ? 'Это всё твоё!' : taps === 0 ? 'Тапай по подарку!' : taps === 1 ? 'Ещё!' : 'Ещё разок!'}
      </div>
      {/* Сколько тапов осталось. */}
      <div className="mt-2 flex h-3 gap-2" aria-hidden="true" data-testid="gift-taps">
        {!opened && Array.from({ length: TAPS }).map((_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border-[1.5px] border-jewelInk transition-colors ${i < taps ? 'bg-gold' : 'bg-cream-deep'}`} />
        ))}
      </div>

      <motion.button
        type="button"
        onClick={tap}
        className="relative mt-2"
        aria-label="Открыть подарок"
        initial={reducedMotion() ? false : { y: 300, scale: 0.4, rotate: -30 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        onAnimationComplete={() => buzz.heavy()}
        data-testid="gift-reveal-box"
      >
        <Gift3D ref={box} size={150} idle={!opened}>
          <div className="flex flex-col items-center gap-1 rounded-2xl border-[2px] border-jewelInk bg-cream-tile px-4 py-3 text-center" style={{ boxShadow: '3px 3px 0 #15100A', minWidth: 150 }} data-testid="gift-prize">
            {xp != null && xp > 0 && <div className="font-sans text-[24px] font-extrabold leading-none text-jewelInk">+{xp} <span className="text-[14px]">опыта</span></div>}
            <div className="flex items-center gap-1.5 font-sans text-[14px] font-extrabold text-ruby">
              <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 1c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" fill="#F5B820" stroke="#15100A" strokeWidth="1.300" strokeLinejoin="round" /></svg>
              {streakText}
            </div>
          </div>
        </Gift3D>
      </motion.button>

      <div className="mt-6 w-full max-w-[340px]">
        {opened ? (
          <button type="button" onClick={() => { buzz.light(); onClose() }} className="jewel-btn bg-navy text-cream w-full" data-testid="gift-reveal-close">
            <span className="relative z-[1]">Забрать</span>
          </button>
        ) : (
          <div className="h-[56px] flex items-center justify-center font-sans text-[13px] font-bold text-jewelInk-mid" data-testid="gift-reveal-hint">
            {taps < TAPS ? `${TAPS - taps} ${TAPS - taps === 1 ? 'тап' : 'тапа'} — и он твой` : ''}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}
