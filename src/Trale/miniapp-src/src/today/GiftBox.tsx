import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion, useAnimate } from 'framer-motion'
import { buzz, reducedMotion } from './sensors'

// «Подарок дня» — коробка в эмали мини-аппа: синяя, с красной лентой, золотым бантом и полоской килима.
// Ждёт — иногда подпрыгивает и покачивается; под пальцем сжимается; отпустил — трясётся, крышка и бант
// улетают, изнутри бьёт свет и вылетают грузинские буквы. Открыта — стоит без крышки, внутри светится.

const INK = '#15100A'
const NAVY = '#1B5FB0'
const NAVY_LIGHT = '#3A7FCC'
const RUBY = '#E01A3C'
const RUBY_DEEP = '#A61026'
const GOLD = '#F5B820'
const GOLD_LIGHT = '#FCD76D'
const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ', 'ი', 'კ', 'ლ', 'მ', 'ნ', 'ო', 'რ', 'ს', 'ქ', 'ღ', 'შ', 'ჩ']

export interface GiftBoxHandle {
  /** Проиграть открытие; промис — когда главное уже показано и можно уходить на занятие. */
  open: () => Promise<void>
  squash: (down: boolean) => void
  /** Короткий прыжок — ответ на тап по Бомборе, на встряхивание. */
  hop: () => void
  /** Снова закрыть (открыли, а занятие не началось — например, вышел экран покупки). */
  reset: () => void
}

/** Буквы и конфетти из точки — свои, а не общий burst: летят вверх фонтаном и крутятся. */
export function letterFountain(from: Element | null, count = 18) {
  if (!from || reducedMotion()) return
  const r = from.getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y0 = r.top + r.height * 0.3
  const colors = [NAVY, RUBY, GOLD, NAVY_LIGHT]
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const isLetter = i % 2 === 0
    el.className = 'gb-spark'
    if (isLetter) {
      el.textContent = LETTERS[Math.floor(Math.random() * LETTERS.length)]
      el.style.color = colors[i % colors.length]
      el.style.fontSize = `${18 + Math.random() * 14}px`
    } else {
      const s = 7 + Math.random() * 7
      Object.assign(el.style, { width: `${s}px`, height: `${s * (Math.random() > 0.5 ? 1 : 0.45)}px`, background: colors[i % colors.length], borderRadius: Math.random() > 0.5 ? '50%' : '2px' })
    }
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const dist = 110 + Math.random() * 120
    el.style.left = `${x0}px`
    el.style.top = `${y0}px`
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    el.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    el.style.setProperty('--fall', `${140 + Math.random() * 120}px`)
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`)
    el.style.setProperty('--dur', `${900 + Math.random() * 500}ms`)
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const fill = { transformBox: 'fill-box' as const, transformOrigin: 'center' }

interface Props {
  /** Открыта — уже сделано на сегодня. */
  opened?: boolean
  size?: number
  idle?: boolean
  onPointerDown?: () => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
}

const GiftBox = forwardRef<GiftBoxHandle, Props>(function GiftBox({ opened = false, size = 170, idle = true, onPointerDown, onPointerUp, onPointerLeave }, ref) {
  const [scope, animate] = useAnimate()
  const busy = useRef(false)

  useImperativeHandle(ref, () => ({
    squash(down) {
      if (busy.current || !scope.current) return
      animate(scope.current, down ? { scaleY: 0.86, scaleX: 1.1, y: 6 } : { scaleY: 1, scaleX: 1, y: 0 }, { type: 'spring', stiffness: 520, damping: down ? 22 : 9 })
    },
    hop() {
      if (busy.current || !scope.current) return
      animate(scope.current, { y: [0, -26, 0, -8, 0], rotate: [0, -6, 4, -2, 0], scaleY: [1, 1.08, 0.9, 1.03, 1] }, { duration: 0.7, ease: 'easeOut' })
    },
    reset() {
      if (!scope.current) return
      busy.current = false
      const root = scope.current as HTMLElement
      root.querySelectorAll('.gb-lid, .gb-bow, .gb-glow, .gb-rays').forEach(el => el.getAnimations().forEach(a => a.cancel()))
      animate(root, { scaleX: 1, scaleY: 1, y: 0, rotate: 0 }, { type: 'spring', stiffness: 300, damping: 12 })
    },
    async open() {
      if (busy.current || !scope.current) return
      busy.current = true
      const root = scope.current as HTMLElement
      if (reducedMotion()) { buzz.success(); busy.current = false; return }
      // 1. Трясётся — внутри что-то есть. Каждый толчок — щелчок в руке.
      ;[0, 90, 180, 270].forEach(t => setTimeout(buzz.tick, t))
      await animate(root, { rotate: [0, -10, 9, -8, 7, -3, 0], scaleY: 1, scaleX: 1, y: 0 }, { duration: 0.42, ease: 'easeInOut' })
      // 2. Сжимается перед прыжком…
      buzz.rigid()
      await animate(root, { scaleY: 0.8, scaleX: 1.14, y: 10 }, { duration: 0.12, ease: 'easeIn' })
      // 3. …и выстреливает: крышка с бантом улетают, свет, буквы.
      buzz.heavy()
      animate(root, { scaleY: [0.8, 1.14, 0.96, 1], scaleX: [1.14, 0.92, 1.03, 1], y: [10, -14, 0, 0] }, { duration: 0.55, ease: 'easeOut' })
      // Части SVG — нативной анимацией (CSS transform по своей рамке): framer двигает у <g> атрибуты, а не transform.
      const part = (sel: string, frames: Keyframe[], ms: number, easing = 'cubic-bezier(.2,.7,.4,1)') =>
        root.querySelector(sel)?.animate(frames, { duration: ms, easing, fill: 'forwards' })
      part('.gb-lid', [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(40px,-90px) rotate(22deg)', opacity: 1, offset: 0.55 }, { transform: 'translate(70px,-150px) rotate(40deg)', opacity: 0 }], 760)
      part('.gb-bow', [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(-40px,-120px) rotate(-160deg)', opacity: 1, offset: 0.55 }, { transform: 'translate(-80px,-190px) rotate(-300deg)', opacity: 0 }], 860)
      part('.gb-glow', [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.5)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.2)', opacity: 0.85 }], 640, 'ease-out')
      part('.gb-rays', [{ transform: 'rotate(0)', opacity: 0 }, { transform: 'rotate(25deg)', opacity: 0.9, offset: 0.4 }, { transform: 'rotate(55deg)', opacity: 0.6 }], 1300, 'ease-out')
      letterFountain(root, 22)
      await wait(140)
      buzz.success()
      await wait(520)
      busy.current = false
    }
  }), [animate])

  return (
    <motion.div
      ref={scope}
      className={`relative select-none ${idle && !opened ? 'gb-idle' : ''}`}
      style={{ width: size, height: size * 1.05, touchAction: 'manipulation', transformOrigin: '50% 100%' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      data-testid="gift-box"
      data-opened={opened ? 'true' : 'false'}
    >
      <svg viewBox="0 0 200 210" width="100%" height="100%" overflow="visible" aria-hidden="true">
        <defs>
          <radialGradient id="gb-glow-g" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF4C2" stopOpacity="1" />
            <stop offset="55%" stopColor={GOLD_LIGHT} stopOpacity="0.55" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <pattern id="gb-kilim" width="16" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 6 L4 1 L8 6 L12 1 L16 6 M0 11 L4 6 L8 11 L12 6 L16 11" stroke={GOLD} strokeWidth="2" fill="none" />
          </pattern>
        </defs>

        {/* Лучи и свет — над коробкой, видны, когда она открыта. */}
        <g className="gb-rays" style={{ transformBox: 'view-box', transformOrigin: '100px 96px' }} opacity={opened ? 0.5 : 0}>
          {Array.from({ length: 10 }).map((_, i) => (
            <path key={i} d="M100 96 L92 -10 L108 -10 Z" fill={GOLD_LIGHT} opacity="0.55" transform={`rotate(${i * 36} 100 96)`} />
          ))}
        </g>
        <ellipse className="gb-glow" cx="100" cy="92" rx="78" ry="56" fill="url(#gb-glow-g)" style={fill} opacity={opened ? 0.85 : 0} />

        {/* Тень на полу */}
        <ellipse cx="100" cy="200" rx="74" ry="8" fill={INK} opacity="0.14" className="gb-shadow" />

        {/* Короб */}
        <g className="gb-body">
          <rect x="30" y="92" width="140" height="102" rx="12" fill={NAVY} stroke={INK} strokeWidth="4" />
          <rect x="34" y="96" width="14" height="94" rx="6" fill={NAVY_LIGHT} opacity="0.55" />
          <rect x="32" y="146" width="136" height="14" fill="url(#gb-kilim)" opacity="0.9" />
          <rect x="88" y="92" width="24" height="102" fill={RUBY} stroke={INK} strokeWidth="3.5" />
          <rect x="92" y="96" width="5" height="94" fill="#fff" opacity="0.25" />
          {opened && <rect x="34" y="92" width="132" height="10" rx="3" fill={INK} opacity="0.25" />}
        </g>

        {/* Крышка */}
        <g className="gb-lid" style={fill} opacity={opened ? 0 : 1}>
          <rect x="20" y="66" width="160" height="32" rx="9" fill={NAVY_LIGHT} stroke={INK} strokeWidth="4" />
          <rect x="26" y="70" width="148" height="6" rx="3" fill="#fff" opacity="0.3" />
          <rect x="86" y="66" width="28" height="32" fill={RUBY} stroke={INK} strokeWidth="3.5" />
        </g>

        {/* Бант */}
        <g className="gb-bow" style={fill} opacity={opened ? 0 : 1}>
          <path d="M100 66 C 70 30, 44 46, 58 66 C 66 76, 88 72, 100 66 Z" fill={RUBY} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M100 66 C 130 30, 156 46, 142 66 C 134 76, 112 72, 100 66 Z" fill={RUBY} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M70 52 C 78 50, 88 56, 94 62" stroke={RUBY_DEEP} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M130 52 C 122 50, 112 56, 106 62" stroke={RUBY_DEEP} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="64" r="11" fill={GOLD} stroke={INK} strokeWidth="4" />
          <circle cx="96.500" cy="60.500" r="3" fill="#fff" opacity="0.7" />
        </g>

        {/* Открыта: крышка прислонена сбоку, внутри звезда. */}
        {opened && (
          <g>
            <g transform="rotate(-18 176 170)">
              <rect x="150" y="130" width="40" height="64" rx="8" fill={NAVY_LIGHT} stroke={INK} strokeWidth="4" />
              <rect x="160" y="130" width="20" height="64" fill={RUBY} stroke={INK} strokeWidth="3" />
            </g>
            <path className="gb-star" d="M100 58 l9 18 20 3 -14.500 14 3.500 20 -18 -9.500 -18 9.500 3.500 -20 -14.500 -14 20 -3z" fill={GOLD} stroke={INK} strokeWidth="4" strokeLinejoin="round" style={fill} />
          </g>
        )}
      </svg>
    </motion.div>
  )
})

export default GiftBox
