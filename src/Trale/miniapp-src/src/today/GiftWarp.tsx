import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import LootBox from './LootBox'
import Padlock from './Padlock'
import { buzz, reducedMotion } from './sensors'

// Переход «подарок → задание дня»: закрытый подарок вылетает с главной в центр и растёт, замок трясётся
// («ключ — в занятии»), из подарка синей волной заливается экран — и на экране задания волна стягивается
// в подарок в конце полоски (IrisIn). Вибрация на каждом шаге.

const NAVY = '#1B5FB0'
const SIZE = 140
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export default function GiftWarp({ from, onDone }: { from: DOMRect | null; onDone: () => void }) {
  const [phase, setPhase] = useState<'fly' | 'shake' | 'flood'>('fly')
  const vw = window.innerWidth, vh = window.innerHeight
  const cx = vw / 2, cy = vh * 0.44
  const fx = from ? from.left + from.width / 2 : cx
  const fy = from ? from.top + from.height / 2 : cy
  const R = Math.hypot(vw, vh)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (reducedMotion()) { onDone(); return }
      buzz.rigid()
      await wait(420)
      if (!alive) return
      setPhase('shake')
      ;[0, 90, 180, 270].forEach(t => setTimeout(buzz.tick, t))
      await wait(520)
      if (!alive) return
      buzz.heavy()
      setPhase('flood')
      await wait(430)
      if (!alive) return
      irisIn()
      onDone()
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="fixed inset-0 z-[95]" data-testid="gift-warp" data-phase={phase}>
      <motion.div className="absolute inset-0" style={{ background: 'rgba(253,250,239,.88)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />
      <motion.div
        className="absolute"
        style={{ left: cx - SIZE * 0.8, top: cy - SIZE * 0.8 }}
        initial={{ x: fx - cx, y: fy - cy, scale: 92 / SIZE, rotate: 0 }}
        animate={phase === 'fly' ? { x: 0, y: 0, scale: 1.25, rotate: -6 } : { x: 0, y: 0, scale: 1.35, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <div className="relative">
          <LootBox level={0} size={SIZE} idle={false} />
          <span className={`absolute left-1/2 top-[46%] ${phase !== 'fly' ? 'td-lock-shake' : ''}`} style={{ transform: 'translate(-50%, -50%)' }}>
            <Padlock size={48} />
          </span>
        </div>
      </motion.div>
      <motion.div
        className="absolute left-0 right-0 text-center font-sans text-[22px] font-extrabold text-jewelInk"
        style={{ top: cy + SIZE * 1.05 }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: phase === 'fly' ? 0 : 1, y: phase === 'fly' ? 12 : 0 }}
      >
        Ключ лежит в задании дня!
      </motion.div>
      {/* Волна из подарка на весь экран: круг, который растёт (transform — его двигает видеокарта, без перерисовки). */}
      <div
        className="absolute rounded-full"
        style={{
          background: NAVY, width: 2 * R, height: 2 * R, left: cx - R, top: cy - R, willChange: 'transform',
          transform: `scale(${phase === 'flood' ? 1 : 0})`, transition: 'transform .42s cubic-bezier(.6,0,.3,1)'
        }}
      />
    </div>
  )
}

/**
 * Уже на экране задания: синяя волна стягивается в подарок в конце полоски (справа вверху).
 * Живёт прямо в body — переживает смену экрана.
 */
function irisIn() {
  const vw = window.innerWidth, vh = window.innerHeight
  const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-t')) || 0
  const x = vw - 34, y = safeTop + 36
  const r = Math.hypot(vw, vh)
  const el = document.createElement('div')
  el.setAttribute('data-testid', 'gift-iris')
  // Круг во весь экран сжимается в подарок: только transform — дёшево для телефона.
  Object.assign(el.style, {
    position: 'fixed', zIndex: '96', pointerEvents: 'none', background: NAVY, borderRadius: '50%',
    width: `${2 * r}px`, height: `${2 * r}px`, left: `${x - r}px`, top: `${y - r}px`,
    transform: 'scale(1)', willChange: 'transform', transition: 'transform .55s cubic-bezier(.6,0,.3,1)'
  })
  document.body.appendChild(el)
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'scale(0)'; buzz.soft() }))
  setTimeout(() => { buzz.light(); el.remove() }, 620)
}
