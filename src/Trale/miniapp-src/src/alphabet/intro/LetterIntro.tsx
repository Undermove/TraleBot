import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import GameFrame from '../games/GameFrame'
import { SoundIcon } from '../games/GameFrame'
import { burst, haptic, playClip, reducedMotion, sound } from '../games/fx'
import { WORD_AUDIO } from '../games/data'
import { introOf, transcriptionOf, wordParts, type LetterIntro as Intro } from './letters'
import { Coverage, glyphPoints, letterStrokes, paintSurface, type Pt } from './paint'

/**
 * «Знакомство с буквой» — отдельная сцена на каждую новую букву, перед первым вопросом о ней.
 * 1) Стираешь пальцем поверхность грузинского слова на эту букву (корку арбуза — საზამთრო, снег — თოვლი…),
 *    под ней проявляется буква и звучит запись этого слова — ровно один раз; дальше — только по кнопке.
 * 2) «Как пишется»: перо само выводит букву (точка ведёт линию, начало отмечено), потом «Теперь ты» —
 *    ведёшь пальцем по бледной букве от зелёной точки по стрелке. Путь пера — по форме шрифта
 *    (paint.letterStrokes), это приближение, а не канонический порядок штрихов. Засчитываем, когда
 *    закрашено ~60% буквы; «ещё раз» показывает перо снова.
 * 3) Подпись: слово крупно с подсвеченной буквой, «сазамтро — арбуз», «ს — звук „с“» и, для трудных букв,
 *    одна строка о звуке.
 */

type Phase = 'reveal' | 'demo' | 'trace' | 'done'

const REVEAL_AT = 0.6
const TRACE_AT = 0.6
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
              {phase === 'reveal' ? 'Води пальцем по картинке — под ней что-то есть' : 'Веди пальцем от зелёной точки по стрелке'}
            </div>
          </div>
        )}
        {phase === 'demo' && <div className="text-center text-[13px] font-bold text-jewelInk-hint" data-testid="intro-demo-hint">Смотри, как ведёт перо — потом повторишь</div>}

        {phase === 'done' && (
          <div className="text-center ab-drip" data-testid="intro-caption">
            <div className="font-geo text-[40px] font-extrabold leading-none tracking-wide" data-testid="intro-word">
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
  const letterRef = useRef<HTMLCanvasElement>(null)
  const paintRef = useRef<HTMLCanvasElement>(null)
  const glyph = useRef<{ points: Pt[]; mask: HTMLCanvasElement | null; strokes: Pt[][] }>({ points: [], mask: null, strokes: [] })
  const [pen, setPen] = useState<Pt | null>(null)
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
      for (const c of [coverRef.current, letterRef.current, paintRef.current, fxCanvas.current]) if (c) { c.width = size * dpr; c.height = size * dpr }
      const cover = ctxOf(coverRef.current)
      if (cover) paintSurface(cover, size, size, intro.surface.cover, intro.letter.charCodeAt(0))
      const g = glyphPoints(intro.letter, size)
      glyph.current = { ...g, strokes: letterStrokes(g.mask, size) }
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
    if (phase === 'trace') {
      ctxOf(paintRef.current)?.clearRect(0, 0, size, size)
      drawLetter(0.25); lastPt.current = null; onProgress(0)
      trace.current = new Coverage(glyph.current.points)
    }
    if (phase === 'done') { setPen(null); fillAll() }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // «Как пишется»: перо само ведёт линию по буквам-штрихам, чернила остаются позади.
  useEffect(() => {
    if (phase !== 'demo') return
    phaseRef.current = 'demo'
    ctxOf(paintRef.current)?.clearRect(0, 0, size, size)
    drawLetter(0.18); setPen(null)
    const segs: { a: Pt; b: Pt; len: number; lift: boolean }[] = []
    for (const st of glyph.current.strokes)
      for (let i = 1; i < st.length; i++) {
        const len = Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y)
        if (len > 0.01) segs.push({ a: st[i - 1], b: st[i], len, lift: false })
      }
    const total = segs.reduce((n, sg) => n + sg.len, 0)
    if (total === 0 || reducedMotion()) { const t = setTimeout(onDemoDone, reducedMotion() ? 0 : 300); return () => clearTimeout(t) }
    let raf = 0, si = 0, done = 0, ticks = 0
    const start = performance.now()
    const frame = (now: number) => {
      const want = Math.min(total, ((now - start) / DEMO_MS) * total)
      const ctx = ctxOf(paintRef.current)
      let at: Pt | null = null
      while (si < segs.length && done < want) {
        const sg = segs[si]
        const from = done, to = Math.min(want, from + sg.len)
        const t0 = 0, t1 = (to - from) / Math.max(0.001, sg.len)
        const p0 = { x: sg.a.x + (sg.b.x - sg.a.x) * t0, y: sg.a.y + (sg.b.y - sg.a.y) * t0 }
        const p1 = { x: sg.a.x + (sg.b.x - sg.a.x) * t1, y: sg.a.y + (sg.b.y - sg.a.y) * t1 }
        if (ctx) {
          ctx.strokeStyle = intro.surface.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = TRACE_R * 1.7
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x + 0.01, p1.y); ctx.stroke()
        }
        at = p1
        if (t1 >= 0.999 || sg.len - (to - from) < 0.01) { done = from + sg.len; si++ } else { segs[si] = { ...sg, a: p1, len: sg.len - (to - from) }; done = to }
      }
      if (ctx && glyph.current.mask) {
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(glyph.current.mask, 0, 0, size, size)
        ctx.globalCompositeOperation = 'source-over'
      }
      if (at) setPen(at)
      const step = Math.floor((want / total) * 8)
      if (step > ticks) { ticks = step; haptic('soft'); sound.chalk() }
      if (want >= total) { setPen(null); raf = window.setTimeout(onDemoDone, 450) as unknown as number; return }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); clearTimeout(raf) }
  }, [phase, replay]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <canvas ref={fxCanvas} style={{ ...canvasStyle, pointerEvents: 'none' }} data-testid="intro-fx" />
      {phase === 'demo' && pen && (
        <div className="absolute pointer-events-none" style={{ left: pen.x - 11, top: pen.y - 11, width: 22, height: 22, borderRadius: 11, background: '#F5B820', border: '2px solid #15100A', boxShadow: '0 0 0 4px rgba(245,184,32,0.35)' }} data-testid="intro-pen" />
      )}
      {phase === 'trace' && <StartMark strokes={glyph.current.strokes} size={size} />}
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

/** Откуда начинать и куда вести: зелёная точка в начале первого штриха и стрелка по его направлению. */
function StartMark({ strokes, size }: { strokes: Pt[][]; size: number }) {
  const first = strokes[0]
  if (!first || first.length < 2) return null
  const a = first[0], b = first[Math.min(first.length - 1, 6)]
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const L = 34, tip = { x: a.x + Math.cos(ang) * L, y: a.y + Math.sin(ang) * L }
  const wing = (d: number) => ({ x: tip.x - Math.cos(ang + d) * 10, y: tip.y - Math.sin(ang + d) * 10 })
  const w1 = wing(0.5), w2 = wing(-0.5)
  return (
    <svg width={size} height={size} className="absolute inset-0 pointer-events-none" aria-hidden data-testid="intro-start">
      <path d={`M${a.x} ${a.y} L${tip.x} ${tip.y} M${w1.x} ${w1.y} L${tip.x} ${tip.y} L${w2.x} ${w2.y}`} stroke="#15100A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={`M${a.x} ${a.y} L${tip.x} ${tip.y} M${w1.x} ${w1.y} L${tip.x} ${tip.y} L${w2.x} ${w2.y}`} stroke="#F5B820" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={a.x} cy={a.y} r="10" fill="#3E9A5A" stroke="#15100A" strokeWidth="2" />
    </svg>
  )
}
