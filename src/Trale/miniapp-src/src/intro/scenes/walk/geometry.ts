// Геометрия «Прогулки»: улица в настоящей перспективе. Мир — в метрах: x — поперёк улицы (0 — середина),
// y — высота, z — вдоль улицы от дома. Камера — твои глаза: высота EYE, смотрит вдоль z. Точка мира
// проецируется на экран через фокус F; всё, что рисуется, сначала проходит через project().

export const EYE = 1.6
export const F = 300
/** Ширина пешеходной улицы между фасадами — 11 м, как на улицах старого Батуми. */
export const FACADE_X = 5.5
export const TREE_X = 4.2
export const LAMP_X = 3.5
/** Дальше этого не рисуем — растворяется в дымке. */
export const FAR = 95
export const NEAR = 0.6

export interface View {
  /** Ширина и высота экрана в единицах viewBox. */
  w: number
  h: number
  /** Где горизонт (доля высоты). */
  horizon: number
}

export interface Pt { x: number; y: number; s: number }

/** Точка мира → экран. s — масштаб (пикселей на метр) на этой глубине. */
export function project(v: View, camZ: number, x: number, y: number, z: number, bob = 0): Pt | null {
  const dz = z - camZ
  if (dz < NEAR) return null
  const s = (F * (v.w / 360)) / dz
  return { x: v.w / 2 + x * s, y: v.h * v.horizon + (EYE + bob - y) * s, s }
}

// ── Дома ──────────────────────────────────────────────────────────────────────────────────────────

export interface Building {
  side: -1 | 1
  z1: number
  z2: number
  floors: number
  color: string
  trim: string
  /** Навес кафе на первом этаже. */
  awning?: string
  /** На каких этажах балконы, с бельём ли. */
  balconies: { floor: number; laundry: boolean }[]
  /** Номер окна → загорится вечером (доля дня, после которой). */
  lights: number[]
}

const FACADES = ['#F1D9B5', '#E8C3A6', '#CFE0CF', '#F4E7C8', '#D9CBE3', '#F2C9B8', '#E6D3A8', '#CDE0EA']
const TRIMS = ['#B8794A', '#8C6A9A', '#4E8A5B', '#B5793F', '#2F7F86']
const AWNINGS = ['#E01A3C', '#1B5FB0', '#4E8A5B', '#C68F10']

/** Детерминированный случай: улица одна и та же при каждом заходе. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildStreet(length: number, seed = 7): Building[] {
  const r = seeded(seed)
  const out: Building[] = []
  for (const side of [-1, 1] as const) {
    let z = -6
    while (z < length + 40) {
      const len = 9 + Math.floor(r() * 7)
      const floors = 3 + Math.floor(r() * 4)
      const cols = Math.max(2, Math.floor(len / 3))
      out.push({
        side, z1: z, z2: z + len, floors,
        color: FACADES[Math.floor(r() * FACADES.length)],
        trim: TRIMS[Math.floor(r() * TRIMS.length)],
        awning: r() < 0.35 ? AWNINGS[Math.floor(r() * AWNINGS.length)] : undefined,
        balconies: Array.from({ length: floors - 1 }, (_, f) => f + 1).filter(() => r() < 0.4).map(floor => ({ floor, laundry: r() < 0.45 })),
        lights: Array.from({ length: cols * floors }, () => 0.62 + r() * 0.35)
      })
      // Между домами иногда — узкий проулок.
      z += len + (r() < 0.25 ? 2 + r() * 2 : 0)
    }
  }
  return out
}

export const FLOOR_H = 3.1

// ── Небо ──────────────────────────────────────────────────────────────────────────────────────────

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
export function mix(a: string, b: string, k: number): string {
  const A = hex(a), B = hex(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0')).join('')
}

/** Ключевые цвета неба: утро, день, вечер, сумерки. */
// Совпадает с partAt (Walk.logic.ts): до 0.36 — утро, до 0.66 — день, дальше вечер — небо говорит то же,
// что и подпись «утро / день / вечер».
const SKY: { t: number; top: string; low: string; light: string }[] = [
  { t: 0, top: '#F4A99A', low: '#FDE0BE', light: '#FFF1DC' },
  { t: 0.3, top: '#A9C9EC', low: '#F6E6D2', light: '#FFF8EE' },
  { t: 0.42, top: '#6FA8DE', low: '#D7EAF7', light: '#FFFFFF' },
  { t: 0.62, top: '#78A9DB', low: '#E9EEEC', light: '#FFF8EA' },
  { t: 0.72, top: '#7A5FA0', low: '#F6A574', light: '#FFD6A8' },
  { t: 1, top: '#2B2C5E', low: '#C26C8E', light: '#9A88C9' }
]

export function skyAt(t: number) {
  let i = 0
  while (i < SKY.length - 2 && t > SKY[i + 1].t) i++
  const a = SKY[i], b = SKY[i + 1]
  const k = (t - a.t) / (b.t - a.t)
  return { top: mix(a.top, b.top, k), low: mix(a.low, b.low, k), light: mix(a.light, b.light, k) }
}

/** Насколько стемнело: 0 — светло, 1 — горят фонари. */
export const dusk = (t: number) => Math.max(0, Math.min(1, (t - 0.68) / 0.22))
