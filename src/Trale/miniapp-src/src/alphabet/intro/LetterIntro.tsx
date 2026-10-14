import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from '../games/GameFrame'
import { burst, haptic, reducedMotion, sound } from '../games/fx'
import { introOf, wordWithLetter, type LetterIntro as Intro } from './letters'
import { Coverage, glyphPoints, paintSurface, type Pt } from './paint'

/**
 * «Знакомство с буквой» — отдельная сцена на каждую новую букву, перед первым вопросом о ней.
 * 1) Стираешь пальцем поверхность (иней, корку арбуза, песок…) — под ней проявляется буква.
 * 2) Обводишь букву пальцем: она заливается там, где прошёл палец. Порядок штрихов не проверяем —
 *    надёжных данных о нём нет; засчитываем, когда закрашено ~70% буквы.
 * 3) Подпись: «ა — звук „а“, как в „აрбуз“» и, для трудных букв, одна строка о звуке.
 */

type Phase = 'reveal' | 'trace' | 'done'

const REVEAL_AT = 0.6
const TRACE_AT = 0.7
const ERASE_R = 26
const TRACE_R = 19

export default function LetterIntro({ letter, index, count, fraction, onExit, onDone }: {
  letter: string
  /** Которая это буква урока (0-based) и сколько их всего — для подписи сверху. */
  index: number
  count: number
  fraction: number
  onExit: () => void
  onDone: () => void
}) {
  const intro = introOf(letter)
  const [phase, setPhase] = useState<Phase>('reveal')
  const [progress, setProgress] = useState(0)
  const [size, setSize] = useState(300)
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const w = box.current?.parentElement?.clientWidth ?? 0
    if (w > 0) setSize(Math.min(350, Math.max(240, w)))
  }, [])

  if (!intro) { setTimeout(onDone, 0); return null }

  const titles: Record<Phase, string> = {
    reveal: intro.action,
    trace: 'Обведи букву пальцем',
    done: 'Новая буква'
  }

  function skip() {
    haptic('tap')
    setPhase('done')
  }

  return (
    <GameFrame title={titles[phase]} eyebrow={`новая буква · ${index + 1} из ${count}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 flex flex-col items-center gap-4">
        <div ref={box} className="w-full flex justify-center">
          <Stage key={letter} intro={intro} size={size} phase={phase}
            onProgress={setProgress}
            onRevealed={() => setPhase('trace')}
            onTraced={() => setPhase('done')}
          />
        </div>

        {phase !== 'done' && (
          <div className="w-full max-w-[330px]">
            <div className="h-2.5 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
              <div className={`h-full transition-[width] duration-150 ${phase === 'reveal' ? 'bg-gold' : 'bg-navy'}`}
                data-testid="intro-progress" style={{ width: `${Math.min(100, Math.round((progress / (phase === 'reveal' ? REVEAL_AT : TRACE_AT)) * 100))}%` }} />
            </div>
            <div className="mt-2 text-center text-[13px] font-bold text-jewelInk-hint">
              {phase === 'reveal' ? 'Води пальцем по картинке — под ней что-то есть' : 'Веди пальцем по букве, пока она не закрасится'}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center ab-drip" data-testid="intro-caption">
            <div className="text-[22px] font-extrabold leading-tight">
              <span className="font-geo text-navy text-[30px]">{intro.letter}</span> — звук «{intro.sound}»
            </div>
            <div className="mt-1 text-[17px] font-bold">как в «<span className="font-geo">{wordWithLetter(intro)}</span>»</div>
            {intro.hint && <div className="mt-2 max-w-[320px] text-[14px] text-jewelInk-mid leading-snug">{intro.hint}</div>}
          </div>
        )}

        <div className="mt-auto w-full max-w-[340px] flex flex-col gap-2">
          {phase === 'done'
            ? <Button onClick={() => { haptic('tap'); onDone() }}>дальше →</Button>
            : <button onClick={skip} className="h-11 text-[14px] font-bold text-jewelInk-hint underline underline-offset-4" data-testid="intro-skip">пропустить</button>}
        </div>
      </div>
    </GameFrame>
  )
}

function Stage({ intro, size, phase, onProgress, onRevealed, onTraced }: {
  intro: Intro; size: number; phase: Phase
  onProgress: (f: number) => void; onRevealed: () => void; onTraced: () => void
}) {
  const coverRef = useRef<HTMLCanvasElement>(null)
  const letterRef = useRef<HTMLCanvasElement>(null)
  const paintRef = useRef<HTMLCanvasElement>(null)
  const glyph = useRef<{ points: Pt[]; mask: HTMLCanvasElement | null }>({ points: [], mask: null })
  const reveal = useRef<Coverage>(new Coverage([]))
  const trace = useRef<Coverage>(new Coverage([]))
  const lastPt = useRef<Pt | null>(null)
  const lastFx = useRef(0)
  const lastStep = useRef(0)
  const phaseRef = useRef(phase)
  /** Буква проявилась — обводка начинается с нового касания, а не продолжением стирания. */
  const needLift = useRef(false)
  const boomRef = useRef<HTMLDivElement>(null)
  /** Буква подпрыгивает. Холсты не пересоздаём (иначе нарисованное пропадёт) — перезапускаем анимацию класса. */
  const boom = () => {
    const el = boomRef.current
    if (!el) return
    el.classList.remove('ab-boom'); void el.offsetWidth; el.classList.add('ab-boom')
  }
  const [ready, setReady] = useState(false)
  phaseRef.current = phase
  const dpr = Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  const ctxOf = (c: HTMLCanvasElement | null) => {
    try { const x = c?.getContext('2d') ?? null; x?.setTransform(dpr, 0, 0, dpr, 0, 0); return x } catch { return null }
  }

  // Нарисовать поверхность и букву, когда шрифт загрузился (иначе контур посчитается по запасному шрифту).
  useEffect(() => {
    let alive = true
    const fonts = (document as any).fonts
    const wait: Promise<unknown> = fonts?.load ? fonts.load(`800 100px "Noto Sans Georgian"`, intro.letter).catch(() => null) : Promise.resolve()
    void wait.then(() => {
      if (!alive) return
      for (const c of [coverRef.current, letterRef.current, paintRef.current]) if (c) { c.width = size * dpr; c.height = size * dpr }
      const cover = ctxOf(coverRef.current)
      if (cover) paintSurface(cover, size, size, intro.surface.cover, intro.letter.charCodeAt(0))
      glyph.current = glyphPoints(intro.letter, size)
      reveal.current = new Coverage(glyph.current.points.filter((_, i) => i % 2 === 0))
      trace.current = new Coverage(glyph.current.points)
      drawLetter(1)
      setReady(true)
    })
    return () => { alive = false }
  }, [intro.letter, size]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Буква на холсте: в фазе стирания — полностью, в фазе обводки — бледной подсказкой. */
  function drawLetter(alpha: number) {
    const ctx = ctxOf(letterRef.current)
    if (!ctx || !glyph.current.mask) return
    ctx.clearRect(0, 0, size, size)
    ctx.globalAlpha = alpha
    ctx.drawImage(glyph.current.mask, 0, 0, size, size)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = intro.surface.ink
    ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  useEffect(() => {
    if (phase === 'trace') { drawLetter(0.3); lastPt.current = null; onProgress(0) }
    if (phase === 'done') fillAll()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function fillAll() {
    const ctx = ctxOf(paintRef.current)
    if (!ctx || !glyph.current.mask) return
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(glyph.current.mask, 0, 0, size, size)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = intro.surface.ink
    ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'source-over'
    if (coverRef.current) coverRef.current.style.opacity = '0'
  }

  function crumbs(x: number, y: number) {
    if (reducedMotion()) return
    const rect = coverRef.current?.getBoundingClientRect()
    if (!rect) return
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div')
      el.className = 'j-piece'
      const s = 3 + Math.random() * 5
      Object.assign(el.style, { width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: intro.surface.crumbs[i % intro.surface.crumbs.length], left: `${rect.left + x}px`, top: `${rect.top + y}px` })
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * 50}px`)
      el.style.setProperty('--dy', `${30 + Math.random() * 50}px`)
      el.style.setProperty('--rot', `${Math.random() * 360}deg`)
      el.style.setProperty('--dur', `${500 + Math.random() * 400}ms`)
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 1000)
    }
  }

  function at(e: React.PointerEvent): Pt {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * size, y: ((e.clientY - r.top) / Math.max(1, r.height)) * size }
  }

  function move(e: React.PointerEvent) {
    if (phaseRef.current === 'done' || needLift.current) return
    const p = at(e)
    const prev = lastPt.current ?? p
    lastPt.current = p
    const now = performance.now()
    if (phaseRef.current === 'reveal') {
      const ctx = ctxOf(coverRef.current)
      if (ctx) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = ERASE_R * 2
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x + 0.01, p.y); ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
      }
      reveal.current.stroke(prev, p, ERASE_R)
      const f = reveal.current.fraction
      onProgress(f)
      if (now - lastFx.current > 70) { lastFx.current = now; sound.scratch(); crumbs(p.x, p.y) }
      const step = Math.floor((f / REVEAL_AT) * 5)
      if (step > lastStep.current) { lastStep.current = step; haptic('soft') }
      if (f >= REVEAL_AT) finishReveal()
    } else {
      const ctx = ctxOf(paintRef.current)
      if (ctx && glyph.current.mask) {
        ctx.strokeStyle = intro.surface.ink
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = TRACE_R * 2
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x + 0.01, p.y); ctx.stroke()
        // Краска остаётся только внутри буквы.
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(glyph.current.mask, 0, 0, size, size)
        ctx.globalCompositeOperation = 'source-over'
      }
      const fresh = trace.current.stroke(prev, p, TRACE_R)
      const f = trace.current.fraction
      onProgress(f)
      if (fresh > 0 && now - lastFx.current > 60) { lastFx.current = now; sound.chalk(); haptic('tap') }
      if (f >= TRACE_AT) finishTrace()
    }
  }

  function finishReveal() {
    phaseRef.current = 'trace'
    needLift.current = true
    lastStep.current = 0
    if (coverRef.current) coverRef.current.style.opacity = '0'
    haptic('good'); sound.win(); boom()
    burst(letterRef.current, 'small')
    setTimeout(onRevealed, reducedMotion() ? 0 : 750)
  }

  function finishTrace() {
    phaseRef.current = 'done'
    fillAll()
    haptic('good'); sound.win(); boom()
    burst(letterRef.current, 'big')
    setTimeout(onTraced, reducedMotion() ? 0 : 500)
  }

  const canvasStyle: React.CSSProperties = { position: 'absolute', inset: 0, width: size, height: size }
  return (
    <div
      className="relative rounded-3xl border-[1.5px] border-jewelInk overflow-hidden select-none"
      style={{ width: size, height: size, background: intro.surface.under, boxShadow: '4px 4px 0 #15100A', touchAction: 'none' }}
      data-testid="intro-stage" data-phase={phase} data-ready={ready ? 'yes' : 'no'}
    >
      <div ref={boomRef} style={{ ...canvasStyle }}>
        <canvas ref={letterRef} style={canvasStyle} aria-label={intro.letter} role="img" />
        <canvas ref={paintRef} style={canvasStyle} />
      </div>
      <canvas
        ref={coverRef}
        style={{ ...canvasStyle, transition: 'opacity 450ms ease-out' }}
        data-testid="intro-cover"
      />
      <div
        style={{ ...canvasStyle, touchAction: 'none' }}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); needLift.current = false; lastPt.current = null; move(e) }}
        onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') move(e) }}
        onPointerUp={() => { lastPt.current = null }}
        onPointerCancel={() => { lastPt.current = null }}
        data-testid="intro-touch"
      />
    </div>
  )
}
