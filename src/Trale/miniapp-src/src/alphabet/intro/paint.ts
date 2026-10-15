import type { Layer } from './letters'

// Процедурные поверхности (иней, корка, песок…) — рисуются на холсте из пары фигур, без картинок.
// И покрытие буквы: точки внутри контура буквы, которые палец уже «задел».

type Ctx = CanvasRenderingContext2D
type Rng = () => number

/** Детерминированная случайность — чтобы поверхность буквы всегда выглядела одинаково. */
export function seeded(seed: number): Rng {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function layer(ctx: Ctx, w: number, h: number, l: Layer, rng: Rng) {
  const n = l.n ?? 30, size = l.size ?? 6
  const col = (i: number) => l.colors[i % l.colors.length]
  ctx.globalAlpha = l.alpha ?? 1
  ctx.lineCap = 'round'
  switch (l.shape) {
    case 'dots': case 'speckle':
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = col(i)
        const r = l.shape === 'dots' ? size : size * (0.4 + rng() * 0.8)
        if (l.shape === 'dots') { ctx.save(); ctx.translate(rng() * w, rng() * h); ctx.rotate(rng() * Math.PI); ctx.fillRect(-r * 1.6, -r / 2, r * 3.2, r); ctx.restore() }
        else { ctx.beginPath(); ctx.arc(rng() * w, rng() * h, r, 0, Math.PI * 2); ctx.fill() }
      }
      break
    case 'blobs': case 'bubbles':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, r = size * (0.6 + rng() * 0.8)
        ctx.fillStyle = col(i); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        if (l.shape === 'bubbles') {
          ctx.strokeStyle = 'rgba(21,16,10,0.18)'; ctx.lineWidth = 1.2; ctx.stroke()
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill()
        }
      }
      break
    case 'drops':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, r = size * (0.4 + rng())
        ctx.fillStyle = col(1); ctx.beginPath(); ctx.ellipse(x + 1, y + 1.5, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = col(0); ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill()
      }
      break
    case 'lines':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, len = size * (0.6 + rng())
        ctx.strokeStyle = col(i); ctx.lineWidth = 2 + rng() * 2.5
        const a = l.size && l.size < 14 ? rng() * Math.PI : (rng() - 0.5) * 0.25
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke()
      }
      break
    case 'waves':
      ctx.lineWidth = size
      for (let i = 0; i < n; i++) {
        const y0 = (i + 0.5) * (h / n), amp = 4 + rng() * 5, ph = rng() * 6
        ctx.strokeStyle = col(i); ctx.beginPath()
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, y0 + Math.sin(x / 18 + ph) * amp)
        ctx.stroke()
      }
      break
    case 'stripes': case 'vstripes':
      ctx.fillStyle = col(0)
      for (let i = 0; i < n; i++) {
        const p = (i + 0.5) * ((l.shape === 'stripes' ? h + w : w) / n)
        ctx.beginPath()
        if (l.shape === 'stripes') { ctx.moveTo(p, 0); ctx.lineTo(p + size, 0); ctx.lineTo(p + size - h, h); ctx.lineTo(p - h, h) }
        else for (let y = 0; y <= h; y += 8) ctx.lineTo(p + Math.sin(y / 22 + i) * 6, y)
        if (l.shape === 'vstripes') for (let y = h; y >= 0; y -= 8) ctx.lineTo(p + size + Math.sin(y / 22 + i) * 6, y)
        ctx.closePath(); ctx.fill()
      }
      break
    case 'cross':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, a = rng() * Math.PI, len = size * (0.5 + rng() * 0.8)
        ctx.strokeStyle = col(i); ctx.lineWidth = 1.5 + rng() * 2.5
        ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2)
        ctx.quadraticCurveTo(x + rng() * 10, y + rng() * 10, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2); ctx.stroke()
      }
      break
    case 'fern':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, a = rng() * Math.PI * 2, len = size * (0.5 + rng() * 0.7)
        ctx.strokeStyle = col(i); ctx.lineWidth = 1.6
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke()
        for (let t = 0.15; t < 1; t += 0.15) {
          const px = x + (ex - x) * t, py = y + (ey - y) * t, b = len * 0.28 * (1 - t)
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + s * 0.8) * b, py + Math.sin(a + s * 0.8) * b); ctx.stroke() }
        }
      }
      break
    case 'scales': {
      const r = size
      for (let row = 0, y = 0; y < h + r; row++, y += r * 0.7)
        for (let x = (row % 2) * r; x < w + r; x += r * 2) {
          ctx.fillStyle = col(row + 1); ctx.strokeStyle = col(row)
          ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI); ctx.fill(); ctx.stroke()
        }
      break
    }
    case 'grid':
      ctx.fillStyle = col(0)
      for (let i = 0; i < n; i++) {
        const y = (i + 0.5) * (h / n)
        for (let x = 8; x < w - 8;) { const len = 8 + rng() * 26; ctx.fillRect(x, y, Math.min(len, w - 8 - x), size); x += len + 5 }
      }
      break
    case 'swirl':
      ctx.lineWidth = size
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = col(i); ctx.beginPath()
        const cx = w / 2 + (rng() - 0.5) * w * 0.3, cy = h / 2 + (rng() - 0.5) * h * 0.3
        for (let t = 0; t < 18; t += 0.2) { const r = t * (w / 40) + i * 3; ctx.lineTo(cx + Math.cos(t + i) * r, cy + Math.sin(t + i) * r) }
        ctx.stroke()
      }
      break
    case 'sparkle':
      for (let i = 0; i < n; i++) {
        const x = rng() * w, y = rng() * h, r = size * (0.5 + rng())
        ctx.fillStyle = col(i); ctx.beginPath()
        ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.5, y + r * 0.5)
        ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.5, y - r * 0.5); ctx.closePath(); ctx.fill()
      }
      break
    case 'grooves':
      ctx.lineWidth = size
      for (let i = 0; i < n; i++) {
        const x0 = (i + 0.5) * (w / n); ctx.strokeStyle = col(i); ctx.beginPath()
        for (let y = 0; y <= h; y += 10) ctx.lineTo(x0 + Math.sin(y / 30 + i * 2) * 5 + (rng() - 0.5) * 3, y)
        ctx.stroke()
      }
      break
  }
  ctx.globalAlpha = 1
}

/** Нарисовать поверхность целиком. */
export function paintSurface(ctx: Ctx, w: number, h: number, cover: { base: string; layers: Layer[] }, seed = 7) {
  const rng = seeded(seed)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = cover.base
  ctx.fillRect(0, 0, w, h)
  for (const l of cover.layers) layer(ctx, w, h, l, rng)
}

// ───────────── Покрытие буквы ─────────────

export interface Pt { x: number; y: number }

/**
 * Точки внутри буквы: рисуем контур буквы (glyphs.ts, вектор Noto Sans Georgian 800 в боксе 0..100) на невидимом
 * холсте и берём сетку с шагом step. Без холста (jsdom) — пустой список, и экран просто даёт пройти дальше.
 */
export function glyphPoints(outline: string, size: number, step = 7): { points: Pt[]; mask: HTMLCanvasElement | null } {
  try {
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const ctx = c.getContext('2d')
    if (!ctx || typeof Path2D === 'undefined') return { points: [], mask: null }
    ctx.fillStyle = '#000'
    ctx.setTransform(size / 100, 0, 0, size / 100, 0, 0)
    ctx.fill(new Path2D(outline))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const data = ctx.getImageData(0, 0, size, size).data
    const points: Pt[] = []
    for (let y = step / 2; y < size; y += step)
      for (let x = step / 2; x < size; x += step)
        if (data[(Math.floor(y) * size + Math.floor(x)) * 4 + 3] > 128) points.push({ x, y })
    return { points, mask: c }
  } catch { return { points: [], mask: null } }
}

/** Какая доля точек буквы задета пальцем. Точки хранятся сеткой, проверка — только рядом с пальцем. */
export class Coverage {
  readonly hit: Uint8Array
  private count = 0
  constructor(readonly points: readonly Pt[]) { this.hit = new Uint8Array(points.length) }

  /** Палец прошёл через (x, y) с радиусом r. Возвращает, сколько новых точек задето. */
  mark(x: number, y: number, r: number): number {
    let fresh = 0
    const r2 = r * r
    for (let i = 0; i < this.points.length; i++) {
      if (this.hit[i]) continue
      const dx = this.points[i].x - x, dy = this.points[i].y - y
      if (dx * dx + dy * dy <= r2) { this.hit[i] = 1; fresh++ }
    }
    this.count += fresh
    return fresh
  }

  /** Отрезок от a до b — чтобы быстрое движение пальца не оставляло дыр. */
  stroke(a: Pt, b: Pt, r: number): number {
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.ceil(len / (r / 2)))
    let fresh = 0
    for (let s = 1; s <= steps; s++) fresh += this.mark(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps, r)
    return fresh
  }

  get fraction(): number { return this.points.length === 0 ? 1 : this.count / this.points.length }
}

// ───────────── «Как пишется»: проверка пальца ─────────────

/**
 * Ученик ведёт пальцем по букве: засчитываем путь пера по порядку — штрих за штрихом, по направлению.
 * Палец продвигает «курсор» по точкам пути, только если оказался рядом с одной из ближайших следующих точек:
 * назад и вразнобой он не двигается, а небольшие срезы и неточность прощаются.
 */
export class PathTrace {
  private readonly pts: { p: Pt; stroke: number }[]
  private cursor = 0
  constructor(strokes: Pt[][], private readonly window = 6) {
    this.pts = strokes.flatMap((st, i) => st.map(p => ({ p, stroke: i })))
  }
  get total() { return this.pts.length }
  get fraction() { return this.pts.length ? this.cursor / this.pts.length : 1 }
  /** Какой штрих сейчас вести (0-based). */
  get stroke() { return this.pts[Math.min(this.cursor, this.pts.length - 1)]?.stroke ?? 0 }
  /** Следующая точка пути. */
  get next(): Pt | null { return this.pts[this.cursor]?.p ?? null }

  private at(x: number, y: number, r: number, dir: Pt): number {
    const r2 = r * r
    const stroke = this.stroke
    let hit = -1
    for (let i = this.cursor; i < Math.min(this.pts.length, this.cursor + this.window); i++) {
      // В следующий штрих — только с его начала и только когда от текущего осталась пара точек
      // (недотянуть самый кончик можно, перескочить на другой штрих посередине — нет).
      const other = this.pts[i].stroke !== stroke
      if (other && i - this.cursor > 3) break
      const dx = this.pts[i].p.x - x, dy = this.pts[i].p.y - y
      // Палец должен идти туда же, куда перо (не против направления); касание начала штриха — без проверки.
      const q = this.pts[i + 1]?.stroke === this.pts[i].stroke ? this.pts[i + 1].p : this.pts[i].p
      const o = this.pts[i + 1]?.stroke === this.pts[i].stroke ? this.pts[i].p : this.pts[i - 1]?.p ?? this.pts[i].p
      const along = (q.x - o.x) * dir.x + (q.y - o.y) * dir.y
      const still = dir.x === 0 && dir.y === 0
      if (dx * dx + dy * dy <= r2 && (along >= 0 || still)) hit = i
      if (other) break
    }
    if (hit >= 0) this.cursor = hit + 1
    return hit >= 0 ? 1 : 0
  }

  /** Палец прошёл от a до b. Возвращает, сколько точек пути пройдено за это движение. */
  advance(a: Pt, b: Pt, r: number): number {
    const before = this.cursor
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.ceil(len / (r / 2)))
    const dir = { x: b.x - a.x, y: b.y - a.y }
    if (len === 0) this.at(b.x, b.y, r, dir)
    for (let s = 1; s <= steps && len > 0; s++) this.at(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps, r, dir)
    return this.cursor - before
  }
}
