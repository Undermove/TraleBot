import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { buzz, reducedMotion } from './sensors'
import './gift3d.css'

// Подарок в «ненастоящем 3D»: куб из шести граней (CSS 3D, без библиотек) в эмали мини-аппа — синие грани
// с разным светом, красная лента крест-накрест, полоска килима, бант из двух скрещённых плоскостей.
// Ждёт — медленно поворачивается и подпрыгивает. Открытие: трясётся (щелчки в руке), швы светятся,
// крышка с бантом улетают кувырком, четыре стенки раскрываются наружу лепестками, изнутри бьёт свет,
// поднимается то, что внутри (children), — и вылетают грузинские буквы.

export type Gift3DState = 'closed' | 'shaking' | 'open'

export interface Gift3DHandle {
  /** Распаковать. Промис — когда стенки раскрылись и награда видна. */
  open: () => Promise<void>
  /** Покачаться «закрыто» — например, если нажали раньше времени. */
  nope: () => void
  /** Тап по подарку перед открытием: подпрыгивает, щели разгораются сильнее (1, 2…). */
  knock: (level: number) => void
}

interface Props {
  size?: number
  /** Сразу открыта (награду уже забрали). */
  opened?: boolean
  /** Медленно вращаться, когда ждёт. */
  idle?: boolean
  /** Что поднимается изнутри при открытии. */
  children?: React.ReactNode
  /** Наклон сцены (−1…1) — от телефона. */
  tilt?: { x: number; y: number }
  /** Открыта, но «приоткрыта»: крышки нет, стенки чуть разошлись — компактно, для главной. */
  ajar?: boolean
  /** Редкость 0..3 — цвет коробки. */
  rarity?: number
}

const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ', 'ი', 'კ', 'ლ', 'მ', 'ნ', 'ო', 'რ', 'ს', 'ქ', 'ღ', 'შ']
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Буквы и конфетти фонтаном из точки. */
export function sparkFountain(from: Element | null, count = 24) {
  if (!from || reducedMotion()) return
  const r = from.getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y0 = r.top + r.height * 0.4
  const colors = ['#1B5FB0', '#E01A3C', '#F5B820', '#3A7FCC']
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'g3-spark'
    if (i % 2 === 0) {
      el.textContent = LETTERS[Math.floor(Math.random() * LETTERS.length)]
      el.style.color = colors[i % colors.length]
      el.style.fontSize = `${18 + Math.random() * 16}px`
    } else {
      const s = 7 + Math.random() * 7
      Object.assign(el.style, { width: `${s}px`, height: `${s * (Math.random() > 0.5 ? 1 : 0.45)}px`, background: colors[i % colors.length], borderRadius: Math.random() > 0.5 ? '50%' : '2px' })
    }
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
    const dist = 120 + Math.random() * 140
    el.style.left = `${x0}px`
    el.style.top = `${y0}px`
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    el.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    el.style.setProperty('--fall', `${160 + Math.random() * 140}px`)
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 600}deg`)
    el.style.setProperty('--dur', `${1000 + Math.random() * 600}ms`)
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1800)
  }
}

const Bow = () => (
  <svg viewBox="0 0 100 60" width="100%" height="100%" aria-hidden="true">
    <path d="M50 52 C 30 10, 4 20, 14 44 C 20 56, 40 56, 50 52 Z" fill="#E01A3C" stroke="#15100A" strokeWidth="4" strokeLinejoin="round" />
    <path d="M50 52 C 70 10, 96 20, 86 44 C 80 56, 60 56, 50 52 Z" fill="#E01A3C" stroke="#15100A" strokeWidth="4" strokeLinejoin="round" />
    <path d="M24 30 C 32 30, 42 40, 46 48" stroke="#A61026" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M76 30 C 68 30, 58 40, 54 48" stroke="#A61026" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="50" cy="50" r="9" fill="#F5B820" stroke="#15100A" strokeWidth="4" />
  </svg>
)

const Gift3D = forwardRef<Gift3DHandle, Props>(function Gift3D({ size = 150, opened = false, idle = true, children, tilt, ajar = false, rarity = 0 }, ref) {
  const [state, setState] = useState<Gift3DState>(opened ? 'open' : 'closed')
  const [nope, setNope] = useState(0)
  const [knocks, setKnocks] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  // Снаружи поменяли «открыта/закрыта» (подарок забрали в окне распаковки, на стенде — «подарок заново») — встать так же.
  useEffect(() => { setState(opened ? 'open' : 'closed') }, [opened])

  useImperativeHandle(ref, () => ({
    async open() {
      if (busy.current || state === 'open') return
      busy.current = true
      if (reducedMotion()) { setState('open'); buzz.success(); busy.current = false; return }
      // Раскачали тапами — сразу лопается; нет — сначала трясётся сама.
      if (knocks < 2) {
        setState('shaking')
        ;[0, 110, 220, 330, 440, 550].forEach(t => setTimeout(buzz.tick, t))
        await wait(700)
      }
      buzz.heavy()
      setState('open')
      sparkFountain(root.current, 26)
      await wait(180)
      buzz.success()
      await wait(700)
      busy.current = false
    },
    nope() {
      buzz.rigid()
      setNope(n => n + 1)
    },
    knock(level) {
      if (level >= 2) buzz.heavy(); else buzz.rigid()
      setKnocks(level)
      setNope(n => n + 1)
      sparkFountain(root.current, 4 + level * 4)
    }
  }), [state, knocks])

  const s = size
  const vars = {
    ['--s' as any]: `${s}px`,
    ['--h' as any]: `${s / 2}px`,
    ['--tx' as any]: `${(tilt?.y ?? 0) * -10}deg`,
    ['--ty' as any]: `${(tilt?.x ?? 0) * 18}deg`
  }
  const wall = (cls: string) => (
    <div className={`g3-face g3-wall ${cls}`}>
      <div className="g3-kilim" />
      <div className="g3-ribbon-v" />
    </div>
  )

  return (
    <div
      ref={root}
      className={`g3 g3-${state} g3-r${rarity} ${ajar ? 'g3-ajar' : ''} ${idle && state === 'closed' && !knocks ? 'g3-idle' : ''}`}
      style={{ width: s * 1.6, height: s * 1.6, ...vars }}
      data-testid="gift3d"
      data-state={state}
      data-charge={knocks}
    >
      <div className="g3-scene">
        <div className="g3-floor-shadow" />
        <div key={nope} className={`g3-cube ${nope ? (knocks ? 'g3-knock' : 'g3-nope') : ''}`}>
          {/* Свет изнутри — виден в щелях при тряске и столбом, когда открыта. */}
          <div className="g3-beam" />
          <div className="g3-face g3-bottom" />
          {wall('g3-front')}
          {wall('g3-back')}
          {wall('g3-right')}
          {wall('g3-left')}
          {/* Крышка: верх, четыре бортика и бант крест-накрест. */}
          <div className="g3-lid">
            <div className="g3-face g3-lid-top"><div className="g3-ribbon-v" /><div className="g3-ribbon-h" /></div>
            <div className="g3-face g3-lid-side g3-lid-front"><div className="g3-ribbon-v" /></div>
            <div className="g3-face g3-lid-side g3-lid-back"><div className="g3-ribbon-v" /></div>
            <div className="g3-face g3-lid-side g3-lid-right"><div className="g3-ribbon-v" /></div>
            <div className="g3-face g3-lid-side g3-lid-left"><div className="g3-ribbon-v" /></div>
            <div className="g3-bow g3-bow-a"><Bow /></div>
            <div className="g3-bow g3-bow-b"><Bow /></div>
          </div>
          {/* То, что внутри, — поднимается при открытии. */}
          <div className="g3-prize">{children}</div>
        </div>
      </div>
    </div>
  )
})

export default Gift3D
