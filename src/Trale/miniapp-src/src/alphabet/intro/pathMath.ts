// Геометрия рукописных штрихов (handwriting.ts): разбор SVG-пути «M x y C …» из кубических Безье и выборка
// точек по длине дуги — для пера (оно едет ровно по линии), для проверки пальца и для стрелок.
// Без DOM: работает и в тестах (jsdom не умеет getPointAtLength).

export interface P { x: number; y: number }
type Cubic = [P, P, P, P]

export function parsePath(d: string): Cubic[] {
  const out: Cubic[] = []
  let cur: P = { x: 0, y: 0 }
  for (const [, cmd, args] of d.matchAll(/([MC])([^MC]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)
    if (cmd === 'M') { cur = { x: n[0], y: n[1] }; continue }
    // После C может идти несколько троек точек подряд.
    for (let i = 0; i + 5 < n.length; i += 6) {
      const seg: Cubic = [cur, { x: n[i], y: n[i + 1] }, { x: n[i + 2], y: n[i + 3] }, { x: n[i + 4], y: n[i + 5] }]
      out.push(seg); cur = seg[3]
    }
  }
  return out
}

const at = ([a, b, c, d]: Cubic, t: number): P => {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y
  }
}

/** Плотная полилиния пути с накопленной длиной. */
export function polyline(d: string, perSeg = 24): { pts: P[]; len: number[] } {
  const segs = parsePath(d)
  const pts: P[] = []
  for (const s of segs) for (let k = pts.length ? 1 : 0; k <= perSeg; k++) pts.push(at(s, k / perSeg))
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, len }
}

/** Точка на доле f (0..1) длины пути. */
export function pointAt(line: { pts: P[]; len: number[] }, f: number): P {
  const L = line.len[line.len.length - 1] ?? 0
  const target = Math.max(0, Math.min(1, f)) * L
  let i = 1
  while (i < line.len.length - 1 && line.len[i] < target) i++
  const a = line.pts[i - 1] ?? { x: 0, y: 0 }, b = line.pts[i] ?? a
  const span = (line.len[i] - line.len[i - 1]) || 1
  const t = Math.max(0, Math.min(1, (target - line.len[i - 1]) / span))
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Равномерная выборка: точка каждые step единиц (концы всегда в выборке). */
export function sample(d: string, step: number): P[] {
  const line = polyline(d)
  const L = line.len[line.len.length - 1] ?? 0
  const n = Math.max(2, Math.round(L / step) + 1)
  return Array.from({ length: n }, (_, i) => pointAt(line, i / (n - 1)))
}

export const lengthOf = (d: string) => { const l = polyline(d).len; return l[l.length - 1] ?? 0 }

/** Полилиния по готовым точкам (медианы штрихов) с накопленной длиной. */
export function lineOf(points: readonly (readonly [number, number])[]): { pts: P[]; len: number[] } {
  const pts = points.map(([x, y]) => ({ x, y }))
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return { pts, len }
}

/** Равномерная выборка точек по полилинии: точка каждые step единиц. */
export function sampleLine(line: { pts: P[]; len: number[] }, step: number): P[] {
  const L = line.len[line.len.length - 1] ?? 0
  const n = Math.max(2, Math.round(L / step) + 1)
  return Array.from({ length: n }, (_, i) => pointAt(line, i / (n - 1)))
}
