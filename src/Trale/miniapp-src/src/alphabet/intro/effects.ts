// Физика поверхностей «Знакомства с буквой»: у каждой поверхности свой эффект под пальцем — корка арбуза
// отходит завитками, шерсть расходится прядями и пружинит, пузыри лопаются кольцом с брызгами, снег
// сгребается в горки, листья улетают, вращаясь… 14 «движков» с параметрами под каждую букву.
// Canvas 2D, частиц не больше MAX — держим 60 кадров на среднем телефоне. Грузится отдельным куском
// (LetterIntro подтягивает его лениво); при prefers-reduced-motion не используется — простое стирание.

import type { Haptic } from '../games/fx'

export type Engine =
  | 'peel' | 'fur' | 'pop' | 'bolt' | 'leaves' | 'puff' | 'shards'
  | 'snow' | 'shine' | 'grains' | 'dent' | 'ripple' | 'swirl' | 'drips'

export interface EffectSpec {
  engine: Engine
  /** Цвета частиц (по умолчанию — цвета крошек поверхности). */
  colors?: string[]
  /** Сила эффекта 0.5–1.5: сколько частиц, как далеко летят. */
  power?: number
  /** Для пара и пыли: тянет вверх. */
  rise?: boolean
}

/** Какой эффект у какой буквы: по предмету и действию из letters.ts. */
export const EFFECTS: Record<string, EffectSpec> = {
  ა: { engine: 'grains', colors: ['#FFE1C2', '#FFD3A8', '#F7B884'], power: 0.7, rise: true }, // пушок персика взлетает
  დ: { engine: 'fur', colors: ['#5C3820', '#9A6A42'] },                                       // шерсть медведя
  რ: { engine: 'pop', colors: ['#FFFFFF', '#F1EADB'], power: 0.8 },                            // пенка молока
  ე: { engine: 'bolt', colors: ['#FCD76D', '#FFFFFF'] },                                       // грозовые тучи, молния
  ი: { engine: 'leaves', colors: ['#6FA04A', '#3A6420', '#5E8A3A'] },                          // листья фиалки
  ს: { engine: 'peel', colors: ['#3E7A2E', '#1F4F18', '#9BCB6B'] },                            // корка арбуза
  ვ: { engine: 'peel', colors: ['#D8283C', '#B81E30', '#F3DFA0'], power: 0.8 },                // кожура яблока
  მ: { engine: 'puff', colors: ['#FFFFFF', '#E6EEF5'] },                                       // облака
  ნ: { engine: 'shards', colors: ['#5A3420', '#7A4A2C', '#A8734D'] },                          // шоколадная глазурь
  ლ: { engine: 'peel', colors: ['#F5D02A', '#E3B90F', '#FFF9D2'], power: 0.9 },                // кожура лимона
  ჩ: { engine: 'puff', colors: ['#FFFFFF', '#E6E9ED'], rise: true, power: 0.8 },               // пар над чаем
  ხ: { engine: 'shards', colors: ['#D99844', '#B5722A', '#F0C07A'], power: 1.1 },              // корочка хачапури
  თ: { engine: 'snow', colors: ['#FFFFFF', '#E1EAF3'] },                                       // снег
  ო: { engine: 'shine', colors: ['#FFF4C2', '#FCD76D'] },                                      // полировка золота
  შ: { engine: 'grains', colors: ['#FFFFFF', '#E6E2D8'], power: 1.2 },                         // сахар
  ბ: { engine: 'peel', colors: ['#4B2A5E', '#3A1F4A', '#F4EBC6'], power: 0.9 },                // кожура баклажана
  გ: { engine: 'peel', colors: ['#E8781E', '#C85E10', '#FFC46B'] },                            // кожура тыквы
  ქ: { engine: 'shards', colors: ['#78A64B', '#5E8A3A', '#4A7230'], power: 0.8 },              // мох с камня
  კ: { engine: 'fur', colors: ['#7A7A7A', '#C4C4C4'], power: 0.8 },                            // кошка
  ც: { engine: 'dent', colors: ['#F2DFB8', '#E6CC98'] },                                       // тесто
  წ: { engine: 'ripple', colors: ['#C9DBF0', '#FFFFFF'] },                                     // вода
  ტ: { engine: 'leaves', colors: ['#2F6B45', '#4E9A63', '#1D4A2E'], power: 1.2 },              // ветки леса
  უ: { engine: 'fur', colors: ['#3E2614', '#7A5232'], power: 1.2 },                            // усы
  ფ: { engine: 'leaves', colors: ['#E8A33A', '#B5531A', '#C9A23A', '#D9822B'], power: 1.3 },  // опавшие листья
  პ: { engine: 'grains', colors: ['#FFFFFF', '#F3EEE4'], power: 0.9, rise: true },             // мука с хлеба
  ღ: { engine: 'puff', colors: ['#CFC7B5', '#B7AE9C'], power: 1.1 },                           // пыль с бутылки
  ძ: { engine: 'fur', colors: ['#8A5A2B', '#DDA668', '#C98A4B'] },                             // собака
  ზ: { engine: 'fur', colors: ['#3E3226', '#A89580'], power: 0.7 },                            // колючки ежа
  ყ: { engine: 'swirl', colors: ['#FFF4E2', '#E8D2B0', '#C9A57A'] },                           // пенка кофе
  ჭ: { engine: 'drips', colors: ['#E6EEF5', '#8EA3B5'] },                                      // запотевший стакан
  ჟ: { engine: 'shards', colors: ['#A8642A', '#8A4E1F'], power: 0.9 },                         // пятна жирафа
  ჯ: { engine: 'puff', colors: ['#6F8FC0', '#3A5F99'], power: 0.7 },                           // пыль с джинсов
  ჰ: { engine: 'pop', colors: ['#FFFFFF', '#CFE3F2', '#E9D7F2'], power: 1.2 }                  // мыльные пузыри
}

/** Вибрация и звук движка: что и как часто (мс между отдачами). */
export const FEEL: Record<Engine, { haptic: Haptic; every: number; sound: SoundKind }> = {
  peel: { haptic: 'snap', every: 160, sound: 'peel' },
  fur: { haptic: 'soft', every: 70, sound: 'fur' },
  pop: { haptic: 'pop', every: 0, sound: 'pop' },
  bolt: { haptic: 'snap', every: 260, sound: 'crackle' },
  leaves: { haptic: 'soft', every: 120, sound: 'whoosh' },
  puff: { haptic: 'soft', every: 140, sound: 'whoosh' },
  shards: { haptic: 'tap', every: 110, sound: 'crunch' },
  snow: { haptic: 'soft', every: 90, sound: 'snow' },
  shine: { haptic: 'tap', every: 220, sound: 'shine' },
  grains: { haptic: 'soft', every: 80, sound: 'grain' },
  dent: { haptic: 'soft', every: 130, sound: 'squish' },
  ripple: { haptic: 'soft', every: 150, sound: 'ripple' },
  swirl: { haptic: 'soft', every: 110, sound: 'swirl' },
  drips: { haptic: 'soft', every: 140, sound: 'drip' }
}

export type SoundKind = 'peel' | 'fur' | 'pop' | 'crackle' | 'whoosh' | 'crunch' | 'snow' | 'shine' | 'grain' | 'squish' | 'ripple' | 'swirl' | 'drip'

interface Pt { x: number; y: number }

type Kind = 'strip' | 'strand' | 'ring' | 'drop' | 'bolt' | 'leaf' | 'puff' | 'shard' | 'chunk' | 'spark' | 'sweep' | 'grain' | 'dent' | 'orbit' | 'drip'

interface P {
  k: Kind; x: number; y: number; vx: number; vy: number
  r: number; vr: number; size: number; c: string; life: number; max: number
  a?: number; b?: number; pts?: Pt[]
}

const MAX = 260

/**
 * Мир частиц одной сцены. stroke() — палец прошёл отрезок; step() — кадр. erase — стереть покрытие
 * (капли, бегущие по стеклу, стирают запотевание за собой).
 */
export class Fx {
  private ps: P[] = []
  private dist = 0
  private flash = 0
  private last = 0
  readonly spec: EffectSpec
  constructor(spec: EffectSpec, private readonly fallback: string[], private readonly size: number, private readonly rng: () => number = Math.random) {
    this.spec = spec
  }

  get busy() { return this.ps.length > 0 || this.flash > 0 }

  private col(i?: number) {
    const cs = this.spec.colors?.length ? this.spec.colors : this.fallback
    return cs[(i ?? Math.floor(this.rng() * cs.length)) % cs.length]
  }

  private add(p: Omit<P, 'max'>) {
    if (this.ps.length >= MAX) this.ps.shift()
    this.ps.push({ ...p, max: p.life })
  }

  /** Палец прошёл от a до b. Возвращает true, когда пора дать отдачу (вибрация, звук) — для «пузырей» на каждый хлопок. */
  stroke(a: Pt, b: Pt, radius: number): boolean {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy)
    if (len < 0.5) return false
    const nx = dx / len, ny = dy / len
    const pw = this.spec.power ?? 1
    const R = () => this.rng()
    this.dist += len
    let beat = false
    const every = (step: number, fn: (p: Pt) => void) => {
      while (this.dist >= step) { this.dist -= step; const t = 1 - this.dist / Math.max(len, 1); fn({ x: a.x + dx * Math.min(1, Math.max(0, t)), y: a.y + dy * Math.min(1, Math.max(0, t)) }); beat = true }
    }
    switch (this.spec.engine) {
      case 'peel':
        every(22 / pw, p => {
          const side = R() < 0.5 ? -1 : 1
          this.add({ k: 'strip', x: p.x - ny * radius * side, y: p.y + nx * radius * side, vx: -ny * side * (1.2 + R()) + nx * 0.6, vy: nx * side * (1.2 + R()) - 1.8, r: Math.atan2(dy, dx), vr: side * (0.08 + R() * 0.08), size: radius * (1.1 + R() * 0.6), c: this.col(0), life: 55 })
        })
        break
      case 'fur':
        every(9, p => {
          for (const side of [-1, 1]) {
            if (this.ps.length > MAX - 8) break
            const off = radius * (0.7 + R() * 0.5)
            this.add({ k: 'strand', x: p.x - ny * off * side, y: p.y + nx * off * side, vx: 0, vy: 0, r: Math.atan2(nx * side, -ny * side) + (R() - 0.5) * 0.5, vr: 0, size: 16 + R() * 16 * pw, c: this.col(), life: 46, a: 0.9 * side, b: 0 })
          }
        })
        break
      case 'pop':
        every(22 / pw, p => {
          const cx = p.x + (R() - 0.5) * radius, cy = p.y + (R() - 0.5) * radius
          this.add({ k: 'ring', x: cx, y: cy, vx: 0, vy: 0, r: 0, vr: 0, size: 6 + R() * 8, c: this.col(0), life: 18 })
          const n = 5 + Math.floor(R() * 4)
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + R() * 0.4, sp = 1.6 + R() * 2.4
            this.add({ k: 'drop', x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, r: 0, vr: 0, size: 1.5 + R() * 2.2, c: this.col(), life: 26 })
          }
        })
        break
      case 'bolt':
        every(70, p => {
          const pts: Pt[] = [{ x: p.x + (R() - 0.5) * 40, y: p.y - 90 - R() * 40 }]
          for (let i = 0; i < 7; i++) { const q = pts[pts.length - 1]; pts.push({ x: q.x + (R() - 0.5) * 30, y: q.y + 16 + R() * 6 }) }
          pts.push(p)
          this.add({ k: 'bolt', x: p.x, y: p.y, vx: 0, vy: 0, r: 0, vr: 0, size: 3, c: this.col(0), life: 9, pts })
          for (let i = 0; i < 6; i++) this.add({ k: 'spark', x: p.x, y: p.y, vx: (R() - 0.5) * 6, vy: (R() - 0.5) * 6, r: 0, vr: 0, size: 2 + R() * 2, c: this.col(1), life: 14 })
          this.flash = 1
        })
        break
      case 'leaves':
        every(18 / pw, p => this.add({ k: 'leaf', x: p.x + (R() - 0.5) * radius, y: p.y + (R() - 0.5) * radius, vx: nx * (2 + R() * 3) + (R() - 0.5), vy: ny * (2 + R() * 3) - 1 - R(), r: R() * 6, vr: (R() - 0.5) * 0.3, size: 7 + R() * 7, c: this.col(), life: 60 + R() * 20, a: R() * 6 }))
        break
      case 'puff':
        every(20 / pw, p => this.add({ k: 'puff', x: p.x + (R() - 0.5) * radius, y: p.y + (R() - 0.5) * radius, vx: nx * 0.8 + (R() - 0.5) * 0.6, vy: (this.spec.rise ? -1.2 : 0) + ny * 0.6 + (R() - 0.5) * 0.4, r: 0, vr: 0, size: radius * (0.5 + R() * 0.5), c: this.col(), life: 46 }))
        break
      case 'shards':
        every(16 / pw, p => {
          const pts: Pt[] = []
          const n = 3 + Math.floor(R() * 3), s = 4 + R() * 7 * pw
          for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2 + R() * 0.6; pts.push({ x: Math.cos(ang) * s * (0.6 + R() * 0.6), y: Math.sin(ang) * s * (0.6 + R() * 0.6) }) }
          this.add({ k: 'shard', x: p.x + (R() - 0.5) * radius, y: p.y + (R() - 0.5) * radius, vx: nx * 1.5 + (R() - 0.5) * 3, vy: -2 - R() * 2.5, r: R() * 6, vr: (R() - 0.5) * 0.4, size: s, c: this.col(), life: 60, pts })
        })
        break
      case 'snow':
        every(8, p => {
          const side = R() < 0.5 ? -1 : 1
          this.add({ k: 'chunk', x: p.x, y: p.y, vx: -ny * side * (3 + R() * 2) + nx * 1.2, vy: nx * side * (3 + R() * 2) + ny * 1.2, r: 0, vr: 0, size: 3 + R() * 5, c: this.col(), life: 140 })
          if (R() < 0.25) this.add({ k: 'spark', x: p.x + (R() - 0.5) * radius * 2, y: p.y + (R() - 0.5) * radius * 2, vx: 0, vy: -0.2, r: 0, vr: 0, size: 2 + R() * 2, c: '#FFFFFF', life: 24 })
        })
        break
      case 'shine':
        every(110, p => {
          this.add({ k: 'sweep', x: p.x - 80, y: p.y, vx: 9, vy: 0, r: -0.5, vr: 0, size: 70, c: this.col(0), life: 26 })
          for (let i = 0; i < 4; i++) this.add({ k: 'spark', x: p.x + (R() - 0.5) * 60, y: p.y + (R() - 0.5) * 60, vx: 0, vy: 0, r: 0, vr: 0, size: 3 + R() * 3, c: '#FFFFFF', life: 22 })
        })
        break
      case 'grains':
        every(5 / pw, p => this.add({ k: 'grain', x: p.x + (R() - 0.5) * radius * 1.6, y: p.y + (R() - 0.5) * radius * 1.6, vx: nx * (1 + R() * 2) + (R() - 0.5) * 1.5, vy: this.spec.rise ? -0.5 - R() * 1.2 : -1 - R() * 1.5, r: 0, vr: 0, size: 1.2 + R() * 1.8, c: this.col(), life: 50 }))
        break
      case 'dent':
        every(26, p => this.add({ k: 'dent', x: p.x, y: p.y, vx: 0, vy: 0, r: Math.atan2(dy, dx), vr: 0, size: radius * 1.1, c: this.col(1), life: 40 }))
        break
      case 'ripple':
        every(28, p => {
          for (let i = 0; i < 3; i++) this.add({ k: 'ring', x: p.x, y: p.y, vx: 0, vy: 0, r: 0, vr: 0, size: 4 + i * 8, c: this.col(i), life: 36 + i * 6 })
        })
        break
      case 'swirl':
        every(10, p => this.add({ k: 'orbit', x: p.x, y: p.y, vx: 0, vy: 0, r: R() * 6, vr: 0.18 + R() * 0.1, size: radius * (0.4 + R() * 0.6), c: this.col(), life: 50, a: 2 + R() * 3 }))
        break
      case 'drips':
        every(30, p => {
          const side = R() < 0.5 ? -1 : 1
          this.add({ k: 'drip', x: p.x + side * radius * 0.6, y: p.y + radius * 0.5, vx: 0, vy: 0.4 + R() * 0.6, r: 0, vr: 0, size: 3 + R() * 2.5, c: this.col(0), life: 120 })
        })
        break
    }
    this.last = this.ps.length
    return beat
  }

  /** Кадр: двинуть частицы и нарисовать. erase — стереть покрытие там, где бежит капля. */
  step(ctx: CanvasRenderingContext2D, erase?: (x: number, y: number, r: number) => void) {
    const S = this.size
    ctx.clearRect(0, 0, S, S)
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,220,${this.flash * 0.35})`
      ctx.fillRect(0, 0, S, S)
      this.flash = Math.max(0, this.flash - 0.18)
    }
    const keep: P[] = []
    for (const p of this.ps) {
      p.life -= 1
      if (p.life <= 0) continue
      const t = 1 - p.life / p.max
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / Math.min(p.max, 16)))
      switch (p.k) {
        case 'strip': {
          p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.r += p.vr
          const curl = p.size * (1 - t * 0.7)
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
          ctx.lineCap = 'round'
          // Завиток корки: снаружи цвет кожуры, изнутри — мякоть; к концу закручивается сильнее.
          ctx.strokeStyle = 'rgba(21,16,10,0.35)'; ctx.lineWidth = 13
          ctx.beginPath(); ctx.arc(0, 0, curl * 0.75, Math.PI * 0.1, Math.PI * (1.1 + t * 0.9)); ctx.stroke()
          ctx.strokeStyle = p.c; ctx.lineWidth = 11
          ctx.beginPath(); ctx.arc(0, 0, curl * 0.75, Math.PI * 0.1, Math.PI * (1.1 + t * 0.9)); ctx.stroke()
          ctx.strokeStyle = this.col(2); ctx.lineWidth = 4
          ctx.beginPath(); ctx.arc(0, 0, curl * 0.75 - 5, Math.PI * 0.1, Math.PI * (1.1 + t * 0.9)); ctx.stroke()
          ctx.restore(); break
        }
        case 'strand': {
          // Прядь откинута пальцем и пружинит обратно: угол качается и затухает.
          p.b = (p.b ?? 0) + 0.32
          const swing = (p.a ?? 0) * Math.exp(-t * 3.2) * Math.cos(p.b)
          const ang = p.r + swing
          ctx.strokeStyle = p.c; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(p.x, p.y)
          ctx.quadraticCurveTo(p.x + Math.cos(ang - 0.3) * p.size * 0.6, p.y + Math.sin(ang - 0.3) * p.size * 0.6, p.x + Math.cos(ang) * p.size, p.y + Math.sin(ang) * p.size)
          ctx.stroke(); break
        }
        case 'ring': {
          const rr = p.size + t * 26
          ctx.strokeStyle = p.c; ctx.lineWidth = 2.5 * (1 - t) + 0.5
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke(); break
        }
        case 'drop': case 'spark': case 'grain': {
          if (p.k !== 'spark') { p.vy += p.k === 'grain' ? (this.spec.rise ? -0.01 : 0.18) : 0.2; p.vx *= 0.97 }
          p.x += p.vx; p.y += p.vy
          if (p.k === 'grain' && p.y > S - 4) { p.y = S - 4; p.vy *= -0.3; p.vx *= 0.8 }
          ctx.fillStyle = p.c
          if (p.k === 'spark') {
            const s = p.size * (1 - t * 0.5)
            ctx.beginPath(); ctx.moveTo(p.x, p.y - s * 1.8); ctx.lineTo(p.x + s * 0.5, p.y); ctx.lineTo(p.x, p.y + s * 1.8); ctx.lineTo(p.x - s * 0.5, p.y); ctx.closePath()
            ctx.moveTo(p.x - s * 1.8, p.y); ctx.lineTo(p.x, p.y + s * 0.5); ctx.lineTo(p.x + s * 1.8, p.y); ctx.lineTo(p.x, p.y - s * 0.5); ctx.closePath(); ctx.fill()
          } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill() }
          break
        }
        case 'bolt': {
          ctx.strokeStyle = p.c; ctx.lineWidth = 3.5 * (p.life / p.max) + 1; ctx.lineJoin = 'round'
          ctx.shadowColor = p.c; ctx.shadowBlur = 12
          ctx.beginPath(); p.pts!.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke()
          ctx.shadowBlur = 0; break
        }
        case 'leaf': {
          p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.06; p.a = (p.a ?? 0) + 0.15
          p.x += p.vx + Math.sin(p.a) * 0.8; p.y += p.vy; p.r += p.vr
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.a)))
          ctx.fillStyle = p.c
          ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.quadraticCurveTo(0, -p.size * 0.7, p.size, 0); ctx.quadraticCurveTo(0, p.size * 0.7, -p.size, 0); ctx.fill()
          ctx.strokeStyle = 'rgba(21,16,10,0.35)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke()
          ctx.restore(); break
        }
        case 'puff': {
          p.x += p.vx; p.y += p.vy
          const rr = p.size * (0.6 + t * 1.2)
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr)
          g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.globalAlpha *= 0.7 * (1 - t)
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill(); break
        }
        case 'shard': {
          p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.r += p.vr
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
          ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(21,16,10,0.4)'; ctx.lineWidth = 1
          ctx.beginPath(); p.pts!.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.fill(); ctx.stroke()
          ctx.restore(); break
        }
        case 'chunk': {
          // Снег отъезжает в сторону и останавливается горкой.
          p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy
          ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(140,165,190,0.5)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break
        }
        case 'sweep': {
          p.x += p.vx
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
          const g = ctx.createLinearGradient(-p.size / 2, 0, p.size / 2, 0)
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,240,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g; ctx.fillRect(-p.size / 2, -S, p.size, S * 2)
          ctx.restore(); break
        }
        case 'dent': {
          // Тесто проминается и пружинит обратно: тень-кольцо сначала растёт, потом сходится.
          const k = Math.sin(t * Math.PI) * (1 + 0.25 * Math.sin(t * 18) * (1 - t))
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
          const g = ctx.createRadialGradient(0, 0, p.size * 0.2, 0, 0, p.size * (0.6 + k * 0.5))
          g.addColorStop(0, 'rgba(120,80,40,0.28)'); g.addColorStop(0.7, 'rgba(255,240,210,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g; ctx.scale(1.3, 1); ctx.beginPath(); ctx.arc(0, 0, p.size * (0.6 + k * 0.5), 0, Math.PI * 2); ctx.fill()
          ctx.restore(); break
        }
        case 'orbit': {
          // Пенка закручивается вокруг места, где помешали, и расходится.
          p.r += p.vr * (1 - t); const rr = p.size * (1 + t * 1.4)
          ctx.strokeStyle = p.c; ctx.lineWidth = (p.a ?? 3) * (1 - t * 0.6); ctx.lineCap = 'round'
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, p.r, p.r + 1.6); ctx.stroke(); break
        }
        case 'drip': {
          p.vy = Math.min(2.2, p.vy + 0.03); p.y += p.vy; p.x += Math.sin(p.y / 9) * 0.3
          erase?.(p.x, p.y, p.size * 0.9)
          ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(80,100,120,0.5)'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 1.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          if (p.y > S + 10) p.life = 0
          break
        }
      }
      ctx.globalAlpha = 1
      if (p.life > 0 && p.y < S + 40 && p.y > -S) keep.push(p)
    }
    this.ps = keep
    return this.last
  }
}
