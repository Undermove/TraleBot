import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from './GameFrame'
import { haptic, reducedMotion, sound } from './fx'
import { catchRounds, type CatchRound, type Rng } from './logic'
import { useLater } from '../../verbs/games/useLater'

/**
 * «Поймай букву»: пузыри с буквами плавают по полю — дрейфуют, покачиваются, мягко отталкиваются друг от друга
 * и от стенок. Тап по нужному: пузырь сплющивается и лопается — кольцо, брызги, поле вздрагивает; серия
 * попаданий подряд звучит всё выше («×3»). Тап мимо: пузырь пружинит и отлетает. Каждая следующая волна
 * быстрее. В первой волне нужные пузыри подсвечены — первый ход с подсказкой.
 */

interface Body { x: number; y: number; vx: number; vy: number; r: number; phase: number; squash: number; alive: boolean }
interface Drop { x: number; y: number; vx: number; vy: number; life: number; size: number; ring?: boolean }

export default function Catch({ letters, lesson, fraction, onExit, onDone, rng = Math.random, rounds: given }: {
  letters: string[]
  lesson: number
  fraction: number
  onExit: () => void
  onDone: () => void
  rng?: Rng
  rounds?: CatchRound[]
}) {
  const rounds = useMemo(() => given ?? catchRounds(letters, lesson, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const [popped, setPopped] = useState<Set<number>>(new Set())
  const [combo, setCombo] = useState(0)
  const [hinted, setHinted] = useState(false)
  const field = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const els = useRef<(HTMLButtonElement | null)[]>([])
  const bodies = useRef<Body[]>([])
  const drops = useRef<Drop[]>([])
  const shake = useRef(0)
  const later = useLater()
  const round = rounds[ri]
  const guide = ri === 0 && !hinted
  const still = reducedMotion()

  // Новая волна: пузыри по сетке с разбросом, скорость растёт от волны к волне.
  useEffect(() => {
    if (!round) return
    const box = field.current?.getBoundingClientRect()
    const W = box?.width || 320, H = box?.height || 300
    const speed = still ? 0 : 0.35 + ri * 0.22
    const cols = 3, rows = Math.ceil(round.bubbles.length / cols)
    bodies.current = round.bubbles.map((_, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      const a = rng() * Math.PI * 2
      return {
        x: ((c + 0.5) / cols) * W + (rng() - 0.5) * 20, y: ((r + 0.5) / rows) * H + (rng() - 0.5) * 20,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: Math.min(34, W / 9), phase: rng() * 6, squash: 0, alive: true
      }
    })
    place()
  }, [ri]) // eslint-disable-line react-hooks/exhaustive-deps

  function place() {
    bodies.current.forEach((b, i) => {
      const el = els.current[i]
      if (!el) return
      const wob = Math.sin(b.phase) * 0.04
      const sq = b.squash
      el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) scale(${1 + wob + sq * 0.25}, ${1 - wob - sq * 0.25})`
    })
  }

  // Физика: дрейф, покачивание, отскок от стенок и мягкие столкновения пузырей.
  useEffect(() => {
    if (still) return
    let raf = 0
    const tick = () => {
      const box = field.current?.getBoundingClientRect()
      const W = box?.width || 320, H = box?.height || 300
      const bs = bodies.current
      for (const b of bs) {
        if (!b.alive) continue
        b.phase += 0.05
        b.x += b.vx; b.y += b.vy + Math.sin(b.phase) * 0.15
        b.squash *= 0.86
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) } else if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) }
        // Сильный отскок от «боинга» постепенно затухает до спокойного дрейфа.
        const sp = Math.hypot(b.vx, b.vy), cruise = 0.35 + ri * 0.22
        if (sp > cruise * 1.2) { b.vx *= 0.97; b.vy *= 0.97 }
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j]
        if (!a.alive || !b.alive) continue
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r
        if (d < min) {
          const nx = dx / d, ny = dy / d, push = (min - d) / 2
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; b.vx -= rel * nx; b.vy -= rel * ny }
          a.squash = Math.max(a.squash, 0.25); b.squash = Math.max(b.squash, 0.25)
        }
      }
      place()
      drawDrops(W, H)
      if (field.current) {
        const s = shake.current
        field.current.style.transform = s > 0.2 ? `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)` : ''
        shake.current *= 0.82
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ri]) // eslint-disable-line react-hooks/exhaustive-deps

  function drawDrops(W: number, H: number) {
    const c = canvas.current
    const ctx = c?.getContext?.('2d')
    if (!c || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    drops.current = drops.current.filter(d => d.life > 0)
    for (const d of drops.current) {
      d.life -= 1
      ctx.globalAlpha = Math.min(1, d.life / 12)
      if (d.ring) {
        ctx.strokeStyle = '#3A7FCC'; ctx.lineWidth = 3 * (d.life / 20)
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size + (20 - d.life) * 2.4, 0, Math.PI * 2); ctx.stroke()
      } else {
        d.vy += 0.25; d.x += d.vx; d.y += d.vy
        ctx.fillStyle = '#9CC7EE'; ctx.strokeStyle = '#15100A'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.size, d.size * 1.25, Math.atan2(d.vy, d.vx) + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  if (!round) { later(onDone, 0); return null }
  const left = round.bubbles.filter((b, i) => b === round.target && !popped.has(i)).length

  function tap(i: number) {
    if (popped.has(i)) return
    const b = bodies.current[i]
    if (round.bubbles[i] !== round.target) {
      // Мимо: «боинг» — пузырь пружинит и отлетает, серия сбрасывается.
      haptic('bad'); sound.miss(); setCombo(0)
      if (b) {
        const a = Math.random() * Math.PI * 2
        b.vx += Math.cos(a) * 5; b.vy += Math.sin(a) * 5; b.squash = 1
      }
      return
    }
    const next = combo + 1
    setCombo(next)
    haptic(next >= 3 ? 'good' : 'pop'); sound.surface('pop'); sound.pop(Math.min(12, next * 2))
    setHinted(true)
    if (b) {
      b.alive = false; b.squash = 1
      drops.current.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 20, size: b.r * 0.8, ring: true })
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + Math.random() * 0.4, sp = 2.5 + Math.random() * 3
        drops.current.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 34, size: 2.5 + Math.random() * 2.5 })
      }
      shake.current = 7
    }
    const done = new Set(popped).add(i)
    setPopped(done)
    if (round.bubbles.every((x, k) => x !== round.target || done.has(k))) {
      later(() => {
        haptic('good'); sound.win()
        if (ri + 1 >= rounds.length) onDone()
        else { setRi(ri + 1); setPopped(new Set()) }
      }, 550)
    }
  }

  return (
    <GameFrame title="Поймай букву" eyebrow={`поймай букву · ${ri + 1} из ${rounds.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="catch">
        <div className="text-center text-[15px] font-bold text-jewelInk-mid" data-testid="catch-ask">
          Лопни все пузыри с буквой <span className="font-geo text-[30px] text-navy align-middle">{round.target}</span>
          <span className="ml-2 tabular-nums text-jewelInk-hint">осталось {left}</span>
        </div>
        <div className="relative flex-1 min-h-[220px] rounded-2xl border-[1.5px] border-jewelInk/25 overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 30%, #EAF3FB, #D6E6F4 80%)' }}>
          <div ref={field} className="absolute inset-0" key={ri}>
            <canvas ref={canvas} className="absolute inset-0 w-full h-full pointer-events-none" />
            {round.bubbles.map((b, i) => (
              <button
                key={i}
                ref={el => { els.current[i] = el }}
                aria-label={b}
                data-testid="catch-bubble"
                data-target={b === round.target ? 'yes' : 'no'}
                disabled={popped.has(i)}
                onPointerDown={() => tap(i)}
                className={`absolute left-0 top-0 w-[64px] h-[64px] ab-short:w-[56px] ab-short:h-[56px] rounded-full border-[1.5px] border-jewelInk font-geo text-[30px] font-extrabold flex items-center justify-center will-change-transform ${
                  popped.has(i) ? 'ab-pop-bubble pointer-events-none' : ''} ${guide && b === round.target ? 'ring-gold outline outline-4 outline-offset-2 outline-[#F5B820]' : ''}`}
                style={{ background: 'radial-gradient(circle at 32% 28%, #FFFFFF 0 18%, #E2EEF8 40%, #B9D3EA 85%)', boxShadow: 'inset -4px -6px 10px rgba(27,95,176,0.18), 0 3px 0 rgba(21,16,10,0.25)' }}
              >
                <span className="relative">{b}</span>
                <span className="absolute left-[18%] top-[14%] w-[22%] h-[14%] rounded-full bg-white/80 rotate-[-30deg] pointer-events-none" aria-hidden />
              </button>
            ))}
          </div>
          {combo >= 2 && (
            <div key={combo} className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-ruby text-cream text-[15px] font-extrabold border-[1.5px] border-jewelInk ab-snap pointer-events-none" data-testid="catch-combo">×{combo}</div>
          )}
        </div>
      </div>
    </GameFrame>
  )
}
