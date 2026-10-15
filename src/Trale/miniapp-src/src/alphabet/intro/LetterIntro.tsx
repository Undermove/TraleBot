import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from '../games/GameFrame'
import { SoundIcon } from '../games/GameFrame'
import { burst, haptic, playClip, reducedMotion, sound } from '../games/fx'
import { WORD_AUDIO } from '../games/data'
import { introOf, transcriptionOf, wordParts, type LetterIntro as Intro } from './letters'
import { Coverage, PathTrace, glyphPoints, paintSurface, type Pt } from './paint'
import { GLYPHS } from './glyphs'
import { MEDIANS, MEDIAN_MASK } from './medians'
import { lineOf, pointAt, sampleLine } from './pathMath'

/**
 * «Знакомство с буквой» — отдельная сцена на каждую новую букву, перед первым вопросом о ней.
 * 1) Стираешь пальцем поверхность грузинского слова на эту букву (корку арбуза — საზამთრო, снег — თოვლი…),
 *    под ней проявляется буква и звучит запись этого слова — ровно один раз; дальше — только по кнопке.
 * 2) «Как пишется» (как hanzi-writer): буква — всегда векторный глиф (glyphs.ts), бледный — подсказка. Перо идёт
 *    по медианам штрихов (medians.ts: порядок и направление по таблице письма мхедрули), а за ним через маску
 *    из толстой линии вдоль медианы проявляется тот же глиф в полную силу — поэтому «чернила» всегда точно
 *    буква, а не кривая линия. У начала штриха — номер. Потом «Теперь ты»: след пальца — такая же маска,
 *    открывающая глиф; засчитываем путь по порядку и направлению, прощая неточность (paint.PathTrace, ~80%
 *    пути). «ещё раз» показывает перо снова.
 * 3) Подпись: слово крупно с подсвеченной буквой, «сазамтро — арбуз», «ს — звук „с“» и, для трудных букв,
 *    одна строка о звуке.
 */

type Phase = 'reveal' | 'demo' | 'trace' | 'done'

const REVEAL_AT = 0.6
const TRACE_AT = 0.8
const LIFT_MS = 320
const DEMO_MS = 2200
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
  const said = useRef(false)
  const [replay, setReplay] = useState(0)

  useLayoutEffect(() => {
    const w = box.current?.parentElement?.clientWidth ?? 0
    // Сцена квадратная и помещается в окно целиком: по ширине и по высоте (под ней подпись и кнопки).
    const h = (typeof window !== 'undefined' ? window.innerHeight : 800) - 330
    if (w > 0) setSize(Math.max(200, Math.min(350, w, h)))
  }, [])

  if (!intro) { setTimeout(onDone, 0); return null }

  const titles: Record<Phase, string> = {
    reveal: intro.action,
    demo: 'Как пишется',
    trace: 'Теперь ты',
    done: 'Новая буква'
  }

  const audio = WORD_AUDIO[intro.word]
  /** Слово звучит один раз — когда буква проявилась (или сцену пропустили). Повтор — только кнопкой. */
  const sayOnce = () => { if (said.current) return; said.current = true; if (audio) void playClip(audio) }

  function skip() {
    haptic('tap')
    sayOnce()
    setPhase('done')
  }

  return (
    <GameFrame title={titles[phase]} eyebrow={`новая буква · ${index + 1} из ${count}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 flex flex-col items-center gap-4">
        <div ref={box} className="w-full flex justify-center">
          <Stage key={letter} intro={intro} size={size} phase={phase} replay={replay}
            onProgress={setProgress}
            onReveal={sayOnce}
            onRevealed={() => setPhase('demo')}
            onDemoDone={() => setPhase('trace')}
            onTraced={() => setPhase('done')}
          />
        </div>

        {phase !== 'done' && phase !== 'demo' && (
          <div className="w-full max-w-[330px]">
            <div className="h-2.5 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
              <div className={`h-full transition-[width] duration-150 ${phase === 'reveal' ? 'bg-gold' : 'bg-navy'}`}
                data-testid="intro-progress" style={{ width: `${Math.min(100, Math.round((progress / (phase === 'reveal' ? REVEAL_AT : TRACE_AT)) * 100))}%` }} />
            </div>
            <div className="mt-2 text-center text-[13px] font-bold text-jewelInk-hint">
              {phase === 'reveal' ? 'Води пальцем по картинке — под ней что-то есть' : (MEDIANS[letter]?.strokes.length ?? 1) > 1 ? 'Веди от зелёной точки по стрелке — штрих за штрихом' : 'Веди пальцем от зелёной точки по стрелке'}
            </div>
          </div>
        )}
        {phase === 'demo' && <div className="text-center text-[13px] font-bold text-jewelInk-hint" data-testid="intro-demo-hint">Смотри, как ведёт перо — потом повторишь</div>}

        {phase === 'done' && (
          <div className="text-center ab-drip" data-testid="intro-caption">
            <div className="font-geo font-extrabold leading-none tracking-wide break-all" style={{ fontSize: Math.min(40, Math.floor(300 / Math.max(1, [...intro.word].length))) }} data-testid="intro-word">
              {wordParts(intro).map((p, i) => p.own
                ? <span key={i} className="text-ruby underline decoration-gold decoration-[5px] underline-offset-[7px]" data-own="yes">{p.ch}</span>
                : <span key={i} className="text-jewelInk/55">{p.ch}</span>)}
            </div>
            <div className="mt-3 text-[17px] font-bold" data-testid="intro-meaning">{transcriptionOf(intro)} — {intro.ru}</div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[20px] font-extrabold leading-tight">
              <span><span className="font-geo text-navy text-[28px]">{intro.letter}</span> — звук «{intro.sound}»</span>
              {audio && (
                <button onClick={() => { haptic('tap'); void playClip(audio) }} aria-label="Послушать слово" data-testid="intro-listen"
                  className="w-10 h-10 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center" style={{ boxShadow: '2px 2px 0 #15100A' }}>
                  <SoundIcon on size={18} />
                </button>
              )}
            </div>
            {intro.hint && <div className="mt-2 max-w-[320px] mx-auto text-[14px] text-jewelInk-mid leading-snug">{intro.hint}</div>}
          </div>
        )}

        <div className="mt-auto w-full max-w-[340px] flex flex-col gap-2">
          {phase === 'trace' && (
            <button onClick={() => { haptic('tap'); setReplay(r => r + 1); setPhase('demo') }} className="h-10 text-[14px] font-bold text-navy underline underline-offset-4" data-testid="intro-replay">ещё раз показать</button>
          )}
          {phase === 'done'
            ? <Button onClick={() => { haptic('tap'); onDone() }}>дальше →</Button>
            : <button onClick={skip} className="h-11 text-[14px] font-bold text-jewelInk-hint underline underline-offset-4" data-testid="intro-skip">пропустить</button>}
        </div>
      </div>
    </GameFrame>
  )
}

function Stage({ intro, size, phase, replay, onProgress, onReveal, onRevealed, onDemoDone, onTraced }: {
  intro: Intro; size: number; phase: Phase
  /** Счётчик «ещё раз» — перезапускает показ пера. */
  replay: number
  onProgress: (f: number) => void
  /** Буква проявилась — сразу, ещё до перехода к письму. */
  onReveal: () => void
  onRevealed: () => void
  onDemoDone: () => void
  onTraced: () => void
}) {
  const coverRef = useRef<HTMLCanvasElement>(null)
  const letterRef = useRef<SVGSVGElement>(null)
  const glyph = useRef<{ points: Pt[]; mask: HTMLCanvasElement | null; strokes: Pt[][] }>({ points: [], mask: null, strokes: [] })
  const [pen, setPen] = useState<Pt | null>(null)
  // Рукописная буква: штрихи (SVG path, бокс 0..100), их полилинии и выборка точек в пикселях сцены.
  const outline = GLYPHS[intro.letter] ?? ''
  const med = MEDIANS[intro.letter]
  const lines = useMemo(() => (med?.strokes ?? []).map(st => lineOf(st)), [med])
  const strokesPx = useMemo(() => lines.map(l => sampleLine(l, 2.5).map(p => ({ x: (p.x / 100) * size, y: (p.y / 100) * size }))), [lines, size])
  const maskId = `ab-mask-${intro.letter.charCodeAt(0)}`
  const [inked, setInked] = useState<number[]>([])
  const [trail, setTrail] = useState<Pt[][]>([])
  const path = useRef<PathTrace>(new PathTrace([]))
  const [curStroke, setCurStroke] = useState(0)
  const curStrokeRef = useRef(0)
  const [demoStroke, setDemoStroke] = useState(0)
  const demoStrokeRef = useRef(0)
  const fxCanvas = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<{ world: import('./effects').Fx; feel: (typeof import('./effects'))['FEEL'][import('./effects').Engine] } | null>(null)
  const fxRaf = useRef(0)

  // Эффекты поверхностей — отдельный кусок бандла; без них (или при «уменьшить движение») — простое стирание.
  useEffect(() => {
    if (reducedMotion()) return
    let alive = true
    void import('./effects').then(m => {
      const spec = m.EFFECTS[intro.letter]
      if (!alive || !spec) return
      fxRef.current = { world: new m.Fx(spec, intro.surface.crumbs, size), feel: m.FEEL[spec.engine] }
    }).catch(() => { /* без эффектов */ })
    return () => { alive = false; cancelAnimationFrame(fxRaf.current) }
  }, [intro.letter, size]) // eslint-disable-line react-hooks/exhaustive-deps

  function runFx() {
    if (fxRaf.current) return
    const tick = () => {
      const fx = fxRef.current, c = fxCanvas.current
      const ctx = ctxOf(c)
      if (!fx || !ctx) { fxRaf.current = 0; return }
      fx.world.step(ctx, (x, y, r) => {
        const cover = ctxOf(coverRef.current)
        if (!cover || phaseRef.current !== 'reveal') return
        cover.globalCompositeOperation = 'destination-out'
        cover.beginPath(); cover.arc(x, y, r, 0, Math.PI * 2); cover.fill()
        cover.globalCompositeOperation = 'source-over'
      })
      fxRaf.current = fx.world.busy ? requestAnimationFrame(tick) : 0
    }
    fxRaf.current = requestAnimationFrame(tick)
  }
  const reveal = useRef<Coverage>(new Coverage([]))
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

  // Поверхность — на холсте с учётом плотности пикселей экрана (до 3×); буква — вектор (SVG), от шрифта не зависит.
  useEffect(() => {
    for (const c of [coverRef.current, fxCanvas.current]) if (c) { c.width = Math.round(size * dpr); c.height = Math.round(size * dpr) }
    const cover = ctxOf(coverRef.current)
    if (cover) paintSurface(cover, size, size, intro.surface.cover, intro.letter.charCodeAt(0))
    const g = glyphPoints(outline, size)
    glyph.current = { ...g, strokes: [] }
    reveal.current = new Coverage(glyph.current.points.filter((_, i) => i % 2 === 0))
    setReady(true)
  }, [intro.letter, size]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'trace') {
      lastPt.current = null; onProgress(0); setTrail([]); setInked([])
      path.current = new PathTrace(strokesPx)
      setCurStroke(0); curStrokeRef.current = 0
    }
    if (phase === 'done') { setPen(null); setTrail([]); setInked(lines.map(() => 1)) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // «Как пишется»: перо ведёт каждый штрих с постоянной скоростью (плавный разгон и торможение в начале и конце
  // штриха), между штрихами — короткий подъём пера. Чернила — тот же путь (stroke-dashoffset), перо — точка
  // на этом пути, так что линия и перо всегда на букве.
  useEffect(() => {
    if (phase !== 'demo') return
    phaseRef.current = 'demo'
    setPen(null); setInked(lines.map(() => 0)); setDemoStroke(0); demoStrokeRef.current = 0
    const lens = lines.map(l => l.len[l.len.length - 1] ?? 0)
    const total = lens.reduce((a, b) => a + b, 0)
    if (total === 0 || reducedMotion() || !glyph.current.mask) {
      setInked(lines.map(() => 1))
      const t = setTimeout(onDemoDone, reducedMotion() ? 0 : 300); return () => clearTimeout(t)
    }
    const durs = lens.map(l => Math.max(450, (l / total) * DEMO_MS))
    const starts: number[] = []
    durs.reduce((t, d, k) => { starts.push(t); return t + d + (k < durs.length - 1 ? LIFT_MS : 0) }, 0)
    const end = starts[starts.length - 1] + durs[durs.length - 1]
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) * 0.35 + t * 0.65
    let raf = 0, ticks = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      const el = now - t0
      const prog = durs.map((d, k) => Math.max(0, Math.min(1, (el - starts[k]) / d)))
      setInked(prog.map(ease))
      const k = prog.findIndex(p => p < 1)
      const cur = k < 0 ? prog.length - 1 : k
      const inLift = k > 0 && el < starts[k]
      if (cur !== demoStrokeRef.current && !inLift) { demoStrokeRef.current = cur; setDemoStroke(cur); haptic('tap') }
      if (!inLift && k >= 0) {
        const q = pointAt(lines[cur], ease(prog[cur]))
        setPen({ x: (q.x / 100) * size, y: (q.y / 100) * size })
      } else setPen(null)
      const step = Math.floor((el / end) * 10)
      if (step > ticks) { ticks = step; haptic('soft'); sound.chalk() }
      if (el >= end) { setPen(null); raf = window.setTimeout(onDemoDone, 450) as unknown as number; return }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); clearTimeout(raf) }
  }, [phase, replay]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (phaseRef.current === 'done' || phaseRef.current === 'demo' || needLift.current) return
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
      const fx = fxRef.current
      if (fx) {
        // Своя физика поверхности: корка завитками, шерсть прядями, пузыри лопаются…
        const beat = fx.world.stroke(prev, p, ERASE_R)
        const feel = fx.feel
        if ((feel.every === 0 ? beat : now - lastFx.current > feel.every)) { lastFx.current = now; sound.surface(feel.sound); haptic(feel.haptic) }
        runFx()
      } else if (now - lastFx.current > 70) { lastFx.current = now; sound.scratch(); crumbs(p.x, p.y) }
      const step = Math.floor((f / REVEAL_AT) * 5)
      if (step > lastStep.current) { lastStep.current = step; haptic('soft') }
      if (f >= REVEAL_AT) finishReveal()
    } else {
      // Чернила ученика — его след пальцем (новое касание — новая линия).
      setTrail(t => (prev === p || t.length === 0 ? [...t, [p]] : [...t.slice(0, -1), [...t[t.length - 1], p]]))
      // Без холста (jsdom) буквы нет — засчитываем сразу.
      if (!glyph.current.mask) { finishTrace(); return }
      const fresh = path.current.advance(prev, p, TRACE_R * 1.5)
      const f = path.current.fraction
      onProgress(f)
      if (path.current.stroke !== curStrokeRef.current) { curStrokeRef.current = path.current.stroke; setCurStroke(path.current.stroke); haptic('pop') }
      if (fresh > 0 && now - lastFx.current > 60) { lastFx.current = now; sound.chalk(); haptic('tap') }
      if (f >= TRACE_AT) finishTrace()
    }
  }

  function finishReveal() {
    phaseRef.current = 'demo'
    needLift.current = true
    lastStep.current = 0
    if (coverRef.current) coverRef.current.style.opacity = '0'
    haptic('good'); sound.win(); boom()
    // Запись буквы — чуть позже фанфары, чтобы не слились.
    setTimeout(onReveal, 280)
    burst(letterRef.current, 'small')
    setTimeout(onRevealed, reducedMotion() ? 0 : 750)
  }

  function finishTrace() {
    phaseRef.current = 'done'
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
      <div ref={boomRef} style={{ ...canvasStyle, opacity: phase === 'reveal' ? 1 : 0, transition: 'opacity 350ms ease-out' }}>
        <svg ref={letterRef} viewBox="0 0 100 100" width={size} height={size} style={canvasStyle} aria-label={intro.letter} role="img" data-testid="intro-glyph">
          <path d={outline} fill={intro.surface.ink} />
        </svg>
      </div>
      <canvas
        ref={coverRef}
        style={{ ...canvasStyle, transition: 'opacity 450ms ease-out' }}
        data-testid="intro-cover"
      />
      <canvas ref={fxCanvas} style={{ ...canvasStyle, pointerEvents: 'none' }} data-testid="intro-fx" />
      {phase === 'demo' && pen && (
        <div className="absolute pointer-events-none" style={{ zIndex: 5, left: pen.x - 11, top: pen.y - 11, width: 22, height: 22, borderRadius: 11, background: '#F5B820', border: '2px solid #15100A', boxShadow: '0 0 0 4px rgba(245,184,32,0.35)' }} data-testid="intro-pen" />
      )}
      {phase !== 'reveal' && outline && (
        <svg viewBox="0 0 100 100" width={size} height={size} className={`absolute inset-0 pointer-events-none ${phase === 'done' ? 'ab-boom' : ''}`} data-testid="intro-writing">
          <defs>
            {/* Маска: толстые линии вдоль медиан (демо) и след пальца (ученик) — открывают глиф. */}
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              {phase === 'done'
                ? <rect x="0" y="0" width="100" height="100" fill="#fff" />
                : <>
                  {(med?.strokes ?? []).map((st, i) => (inked[i] ?? 0) > 0.001 && (
                    <path key={`m${i}`} d={'M' + st.map(p => p.join(' ')).join(' L')} pathLength={1} strokeDasharray={`${Math.min(1, inked[i])} 2`} fill="none" stroke="#fff" strokeWidth={MEDIAN_MASK} strokeLinecap="round" strokeLinejoin="round" data-testid="intro-ink" />
                  ))}
                  {trail.map((t, i) => t.length > 0 && <polyline key={`t${i}`} points={t.map(p => `${(p.x / size) * 100},${(p.y / size) * 100}`).join(' ')} fill="none" stroke="#fff" strokeWidth={MEDIAN_MASK * 0.85} strokeLinecap="round" strokeLinejoin="round" />)}
                </>}
            </mask>
          </defs>
          <path d={outline} fill={intro.surface.ink} fillOpacity={phase === 'done' ? 0 : 0.2} />
          <path d={outline} fill={intro.surface.ink} mask={`url(#${maskId})`} />
        </svg>
      )}
      {phase === 'demo' && <StrokeNumbers strokes={strokesPx} upTo={demoStroke} size={size} />}
      {phase === 'trace' && <StartMark strokes={strokesPx} current={curStroke} size={size} />}
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

/** Номера штрихов у их начала: во время показа — по мере того, как перо до них доходит. */
function StrokeNumbers({ strokes, upTo, size }: { strokes: Pt[][]; upTo: number; size: number }) {
  if (strokes.length < 2) return null
  return (
    <svg width={size} height={size} className="absolute inset-0 pointer-events-none" aria-hidden data-testid="intro-stroke-numbers">
      {strokes.map((st, i) => i <= upTo && st[0] && (
        <g key={i} className="ab-snap">
          <circle cx={st[0].x} cy={st[0].y} r="11" fill={i === upTo ? '#3E9A5A' : '#FDFAEF'} stroke="#15100A" strokeWidth="2" />
          <text x={st[0].x} y={st[0].y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill={i === upTo ? '#FDFAEF' : '#15100A'}>{i + 1}</text>
        </g>
      ))}
    </svg>
  )
}

/** Откуда вести сейчас: пронумерованная точка в начале текущего штриха и стрелка по его направлению. */
function StartMark({ strokes, current, size }: { strokes: Pt[][]; current: number; size: number }) {
  const st = strokes[current]
  if (!st || st.length < 2) return null
  const a = st[0], b = st[Math.min(st.length - 1, 6)]
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const L = 34, tip = { x: a.x + Math.cos(ang) * L, y: a.y + Math.sin(ang) * L }
  const wing = (d: number) => ({ x: tip.x - Math.cos(ang + d) * 10, y: tip.y - Math.sin(ang + d) * 10 })
  const w1 = wing(0.5), w2 = wing(-0.5)
  const arrow = `M${a.x} ${a.y} L${tip.x} ${tip.y} M${w1.x} ${w1.y} L${tip.x} ${tip.y} L${w2.x} ${w2.y}`
  return (
    <svg width={size} height={size} className="absolute inset-0 pointer-events-none" aria-hidden data-testid="intro-start" data-stroke={current + 1}>
      <path d={arrow} stroke="#15100A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={arrow} stroke="#F5B820" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={a.x} cy={a.y} r="11" fill="#3E9A5A" stroke="#15100A" strokeWidth="2" />
      {strokes.length > 1 && <text x={a.x} y={a.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#FDFAEF">{current + 1}</text>}
    </svg>
  )
}
