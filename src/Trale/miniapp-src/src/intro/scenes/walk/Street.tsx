import React from 'react'
import Passerby, { type PasserbyProps } from './Passerby'
import { FACADE_X, FAR, FLOOR_H, LAMP_X, NEAR, TREE_X, dusk, mix, project, skyAt, type Building, type Pt, type View } from './geometry'

// Улица одним SVG: небо и солнце, море в конце улицы, плитка, фасады с окнами, балконами и навесами
// кафе, платаны, фонари и люди. Всё, что дальше, бледнеет в дымке; вечером темнеет и загораются окна
// и фонари. Порядок рисования — от дальнего к ближнему.

const INK = '#15100A'

export interface StreetPerson extends Omit<PasserbyProps, 'who'> {
  id: number
  who: PasserbyProps['who']
  x: number
  z: number
}

const poly = (pts: (Pt | null)[]) => (pts.every(Boolean) ? (pts as Pt[]).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : null)
const ink = (s: number) => Math.max(0.5, Math.min(2.2, s * 0.045))

export default function Street({ view, camZ, clock, bob, buildings, people, end, rail, time }: {
  view: View
  camZ: number
  /** 0..1 — время дня. */
  clock: number
  bob: number
  buildings: Building[]
  people: StreetPerson[]
  /** Где кончаются дома и начинается набережная. */
  end: number
  /** Перила набережной — за ними море. */
  rail: number
  /** Время, мс — для волн и чаек. */
  time: number
}) {
  const sky = skyAt(clock)
  const night = dusk(clock)
  const P = (x: number, y: number, z: number) => project(view, camZ, x, y, z, bob)
  const hy = view.h * view.horizon
  /** Дымка: дальнее растворяется в цвете неба у горизонта. */
  const haze = (c: string, z: number) => mix(mix(c, sky.low, Math.max(0, (z - camZ - 22) / 70) * 0.85), '#2E2F63', night * 0.32)

  // Солнце идёт по небу за день; к вечеру садится в море в конце улицы.
  const sunX = view.w * (0.22 + 0.56 * clock)
  const sunY = hy * (0.95 - 0.75 * Math.sin(Math.PI * Math.min(1, clock * 0.92 + 0.05)))
  const sunColor = mix('#FFE7A3', '#FF8A4C', Math.max(0, (clock - 0.6) / 0.35))

  const railPt = P(0, 0, rail)
  const seaTop = hy
  const seaBottom = railPt ? railPt.y : hy

  const visible = buildings.filter(b => b.z2 > camZ + NEAR && b.z1 < camZ + FAR).sort((a, b) => b.z1 - a.z1)

  const things: { z: number; el: React.ReactNode }[] = []
  // Платаны вдоль улицы.
  for (let z = 6 + Math.floor((camZ - 6) / 13) * 13; z < Math.min(camZ + FAR, end - 3); z += 13) {
    if (z < camZ + NEAR + 0.4) continue
    for (const side of [-1, 1]) {
      const zz = z + (side > 0 ? 6.5 : 0)
      const base = P(side * TREE_X, 0, zz)
      if (!base) continue
      const s = base.s
      const green = haze(side > 0 ? '#5E9C5F' : '#4E8A5B', zz)
      const dark = haze('#3F7350', zz)
      const bark = haze('#C9B79A', zz)
      things.push({
        z: zz, el: (
          <g key={`t${side}${zz}`}>
            <ellipse cx={base.x} cy={base.y} rx={1.1 * s} ry={0.25 * s} fill="#15100A" opacity={0.12 * (1 - night)} />
            <rect x={base.x - 0.17 * s} y={base.y - 3.4 * s} width={0.34 * s} height={3.4 * s} fill={bark} stroke={INK} strokeWidth={ink(s)} />
            <circle cx={base.x - side * 0.9 * s} cy={base.y - 4.4 * s} r={1.5 * s} fill={dark} stroke={INK} strokeWidth={ink(s)} />
            <circle cx={base.x + side * 0.6 * s} cy={base.y - 4.9 * s} r={1.7 * s} fill={green} stroke={INK} strokeWidth={ink(s)} />
            <circle cx={base.x - side * 0.1 * s} cy={base.y - 5.8 * s} r={1.35 * s} fill={green} stroke={INK} strokeWidth={ink(s)} />
          </g>
        )
      })
    }
  }
  // Фонари: вечером светятся.
  for (let z = 9 + Math.floor((camZ - 9) / 18) * 18; z < Math.min(camZ + FAR, end - 2); z += 18) {
    if (z < camZ + NEAR + 0.4) continue
    for (const side of [-1, 1]) {
      const zz = z + (side > 0 ? 9 : 0)
      const base = P(side * LAMP_X, 0, zz)
      const top = P(side * LAMP_X, 4.3, zz)
      if (!base || !top) continue
      const s = base.s
      things.push({
        z: zz, el: (
          <g key={`l${side}${zz}`}>
            {night > 0 && <circle cx={top.x} cy={top.y} r={2.2 * s} fill="url(#zw-glow)" opacity={night} />}
            {night > 0 && <ellipse cx={base.x} cy={base.y} rx={2.4 * s} ry={0.5 * s} fill="#FFD36B" opacity={0.28 * night} />}
            <rect x={base.x - 0.06 * s} y={top.y} width={0.12 * s} height={base.y - top.y} fill={haze('#2F3A4E', zz)} />
            <rect x={top.x - 0.22 * s} y={top.y - 0.4 * s} width={0.44 * s} height={0.42 * s} rx={0.08 * s}
              fill={night > 0.2 ? mix('#E6EEF2', '#FFE08A', night) : haze('#E6EEF2', zz)} stroke={INK} strokeWidth={ink(s)} />
          </g>
        )
      })
    }
  }
  // Набережная: пальмы по сторонам, фонари у перил.
  // Пальмы — у самых перил, по бокам от вида на море: стоишь у моря, и они его обрамляют.
  for (const [px, pz] of [[-4.3, rail - 2.2], [4.7, rail - 2.8], [-8.6, rail - 1.2], [9.2, rail - 1.6], [-14, rail - 2.6], [14.6, rail - 2]] as const) {
    const base = P(px, 0, pz)
    if (!base || pz - camZ > FAR) continue
    things.push({ z: pz, el: <Palm key={`palm${px}`} x={base.x} y={base.y} s={base.s} lean={px < 0 ? -1 : 1} green={haze('#4E8A5B', pz)} trunk={haze('#B5793F', pz)} sw={ink(base.s)} time={time} /> })
  }
  {
    const pts: string[] = [], bars: string[] = []
    // Балясины — часто и тонко; каждая десятая — столбик потолще.
    const posts: string[] = []
    for (let k = -70; k <= 70; k++) {
      const x = k * 0.55
      const a = P(x, 0.12, rail), t = P(x, 1.0, rail)
      if (a && t) (k % 10 === 0 ? posts : bars).push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${t.x.toFixed(1)} ${t.y.toFixed(1)}`)
    }
    const top1 = P(-40, 1.05, rail), top2 = P(40, 1.05, rail), mid1 = P(-40, 0.55, rail), mid2 = P(40, 0.55, rail)
    const base = P(0, 0, rail)
    if (top1 && top2 && mid1 && mid2 && base) {
      pts.push(`M${top1.x} ${top1.y}L${top2.x} ${top2.y}`, `M${mid1.x} ${mid1.y}L${mid2.x} ${mid2.y}`)
      things.push({ z: rail, el: (
        <g key="rail" data-testid="walk-rail">
          <path d={bars.join('')} stroke={INK} strokeWidth={Math.max(0.5, base.s * 0.012)} opacity="0.85" />
          <path d={posts.join('')} stroke={INK} strokeWidth={Math.max(1, base.s * 0.03)} />
          <path d={pts.join('')} stroke={INK} strokeWidth={Math.max(1.6, base.s * 0.075)} strokeLinecap="round" />
          <path d={pts.slice(0, 1).join('')} stroke="#FDFAEF" strokeWidth={Math.max(0.6, base.s * 0.04)} strokeLinecap="round" />
        </g>
      ) })
    }
  }
  for (const p of people) {
    const base = P(p.x, 0, p.z)
    if (!base || p.z - camZ > FAR) continue
    things.push({
      z: p.z, el: (
        <g key={`p${p.id}`} transform={`translate(${base.x.toFixed(1)} ${base.y.toFixed(1)}) scale(${(base.s / 100).toFixed(4)})`} data-testid="walk-person">
          <Passerby who={p.who} phase={p.phase} stride={p.stride} face={p.face} talking={p.talking} wave={p.wave} />
        </g>
      )
    })
  }
  things.sort((a, b) => b.z - a.z)

  // Плитка: поперечные швы — чем ближе, тем чаще видно, что идёшь.
  const tiles: string[] = []
  for (let z = Math.ceil((camZ + 1) / 1.6) * 1.6; z < Math.min(camZ + 46, rail); z += 1.6) {
    const w = z > end ? 30 : FACADE_X
    const a = P(-w, 0, z), b = P(w, 0, z)
    if (a && b) tiles.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`)
  }
  for (const x of [-2.6, 0, 2.6]) {
    const a = P(x, 0, camZ + 1), b = P(x, 0, Math.min(rail, camZ + 60))
    if (a && b) tiles.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`)
  }

  return (
    <svg viewBox={`0 0 ${view.w} ${view.h}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden className="block">
      <defs>
        <linearGradient id="zw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.low} />
        </linearGradient>
        <linearGradient id="zw-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(mix('#D9CDB8', sky.low, 0.5), '#2E2F63', night * 0.4)} />
          <stop offset="1" stopColor={mix('#C8B89C', '#3A3550', night * 0.55)} />
        </linearGradient>
        <linearGradient id="zw-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(mix('#7FB4E6', sky.low, 0.35), '#2E2F63', night * 0.5)} />
          <stop offset="1" stopColor={mix('#2F7F86', '#1E2A4A', night)} />
        </linearGradient>
        <radialGradient id="zw-glow">
          <stop offset="0" stopColor="#FFE08A" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFE08A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="zw-sun">
          <stop offset="0.55" stopColor={sunColor} />
          <stop offset="1" stopColor={sunColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={view.w} height={view.h} fill="url(#zw-sky)" />
      {/* Звёзды в сумерках. */}
      {night > 0.4 && [[0.12, 0.1], [0.3, 0.06], [0.52, 0.12], [0.7, 0.05], [0.86, 0.14], [0.42, 0.2], [0.64, 0.24]].map(([x, y], i) => (
        <circle key={i} cx={x * view.w} cy={y * hy} r="1.1" fill="#FFF8EA" opacity={(night - 0.4) * 1.6} />
      ))}
      <circle cx={sunX} cy={sunY} r={view.w * 0.075} fill="url(#zw-sun)" data-testid="walk-sun" />
      <circle cx={sunX} cy={sunY} r={view.w * 0.04} fill={sunColor} stroke={INK} strokeWidth="1.2" />

      {/* Море там, где улица кончается. */}
      <rect x="0" y={seaTop} width={view.w} height={Math.max(0, seaBottom - seaTop) + 1} fill="url(#zw-sea)" />
      <path d={`M0 ${seaTop + 1.5} H${view.w}`} stroke="#FFF8EA" strokeWidth="1" opacity="0.6" />
      {seaBottom - seaTop > 4 && <Sea view={view} top={seaTop} bottom={seaBottom} sunX={sunX} sunColor={sunColor} time={time} night={night} />}
      <Gulls view={view} hy={hy} time={time} />

      {(() => {
        const zn = camZ + NEAR + 0.05
        const prom = poly([P(-60, 0, Math.max(end, zn)), P(60, 0, Math.max(end, zn)), P(60, 0, rail), P(-60, 0, rail)])
        const pts = end > zn ? poly([P(-FACADE_X, 0, zn), P(FACADE_X, 0, zn), P(FACADE_X, 0, end), P(-FACADE_X, 0, end)]) : null
        return <>
          {prom && <polygon points={prom} fill="url(#zw-ground)" />}
          {pts && <polygon points={pts} fill="url(#zw-ground)" />}
        </>
      })()}
      <path d={tiles.join('')} stroke={INK} strokeWidth="0.7" opacity="0.16" fill="none" />

      {visible.map((b, i) => <Facade key={`${b.side}${b.z1}${i}`} b={b} P={P} camZ={camZ} haze={haze} night={night} clock={clock} light={sky.light} />)}
      {things.map(t => t.el)}
    </svg>
  )
}

function Facade({ b, P, camZ, haze, night, clock, light }: {
  b: Building
  P: (x: number, y: number, z: number) => Pt | null
  camZ: number
  haze: (c: string, z: number) => string
  night: number
  clock: number
  light: string
}) {
  const x = b.side * FACADE_X
  const inward = -b.side // к середине улицы
  const zmin = camZ + NEAR + 0.03
  const z1 = Math.max(b.z1, zmin)
  if (b.z2 <= zmin) return null
  const H = b.floors * FLOOR_H + 0.7
  const zm = (z1 + b.z2) / 2
  const near = P(x, 0, zm)
  const sw = near ? ink(near.s) : 0.5
  // Солнце утром слева, вечером справа: одна сторона улицы светлее, другая в тени.
  const sunSide = clock < 0.5 ? 1 : -1
  const lit = b.side === sunSide ? 0.1 : -0.07
  const tone = (c: string) => haze(lit > 0 ? mix(c, '#FFFFFF', lit) : mix(c, '#3A2B1F', -lit), zm)
  const q = (pts: [number, number, number][]) => poly(pts.map(([px, py, pz]) => P(px, py, Math.max(pz, zmin))))
  const parts: React.ReactNode[] = []
  const detail = zm - camZ < 55

  // Торец дома в проулке: смотрит на тебя, он темнее фасада.
  if (b.gapBefore && b.z1 > zmin) {
    const end = poly([P(x, 0, b.z1), P(x + b.side * b.depth, 0, b.z1), P(x + b.side * b.depth, H, b.z1), P(x, H, b.z1)])
    if (end) parts.push(<polygon key="end" points={end} fill={haze(mix(b.color, '#3A2B1F', 0.22), b.z1)} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />)
  }

  const wall = q([[x, 0, z1], [x, 0, b.z2], [x, H, b.z2], [x, H, z1]])
  if (wall) parts.push(<polygon key="wall" points={wall} fill={tone(b.color)} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />)
  // Цоколь — тёмная полоса у земли.
  const plinth = q([[x, 0, z1], [x, 0, b.z2], [x, 0.55, b.z2], [x, 0.55, z1]])
  if (plinth) parts.push(<polygon key="plinth" points={plinth} fill={tone(mix(b.color, '#6B5B4A', 0.45))} stroke={INK} strokeWidth={sw * 0.7} />)

  if (detail) {
    const cols = Math.max(2, Math.floor((b.z2 - b.z1) / 3))
    const step = (b.z2 - b.z1) / cols
    const glass = haze(mix(light, '#7FA3C4', 0.6), zm)
    for (let f = 0; f < b.floors; f++) {
      for (let c = 0; c < cols; c++) {
        const za = b.z1 + c * step + step * 0.3, zb = za + step * 0.4
        if (zb < zmin) continue
        const shop = f === 0 && !!b.awning
        const door = f === 0 && !b.awning && c === Math.floor(cols / 2)
        const y0 = shop ? 0.6 : door ? 0 : f * FLOOR_H + 0.95, y1 = shop ? 2.4 : door ? 2.3 : y0 + 1.75
        const on = night > 0 && clock >= (b.lights[f * cols + c] ?? 2)
        // Окно в глубине: тёмный проём, внутри стекло чуть меньше — видна толщина стены.
        const arch = b.arched && f > 0 && !shop
        const top = arch ? [[x, y1 - 0.25, za], [x, y1, (za + zb) / 2], [x, y1 - 0.25, zb]] as [number, number, number][] : [[x, y1, za], [x, y1, zb]] as [number, number, number][]
        const frame = q([[x, y0, za], [x, y0, zb], ...(arch ? [...top].reverse() : [[x, y1, zb], [x, y1, za]] as [number, number, number][])])
        if (!frame) continue
        parts.push(<polygon key={`w${f}${c}`} points={frame} fill={door ? tone(mix(b.trim, '#3A2B1F', 0.35)) : on ? '#FFD36B' : glass} stroke={INK} strokeWidth={sw * 0.8} strokeLinejoin="round" />)
        if (!door && !shop) {
          // Переплёт и подоконник.
          const mid = q([[x, y0, (za + zb) / 2], [x, arch ? y1 : y1, (za + zb) / 2]])
          if (mid) parts.push(<polyline key={`m${f}${c}`} points={mid} stroke={INK} strokeWidth={sw * 0.5} fill="none" />)
          const sill = q([[x, y0, za - 0.12], [x, y0, zb + 0.12], [x + inward * 0.18, y0 - 0.08, zb + 0.12], [x + inward * 0.18, y0 - 0.08, za - 0.12]])
          if (sill) parts.push(<polygon key={`s${f}${c}`} points={sill} fill={haze('#FFF8EA', zm)} stroke={INK} strokeWidth={sw * 0.5} />)
          if (b.shutters) {
            for (const [sa, sb] of [[za - 0.42, za - 0.04], [zb + 0.04, zb + 0.42]]) {
              const sh = q([[x, y0, sa], [x, y0, sb], [x, y1, sb], [x, y1, sa]])
              if (sh) parts.push(<polygon key={`sh${f}${c}${sa}`} points={sh} fill={haze(b.shutters, zm)} stroke={INK} strokeWidth={sw * 0.55} />)
            }
          }
        }
      }
      const bal = b.balconies.find(x => x.floor === f)
      if (bal) {
        const yr = f * FLOOR_H + 0.95
        const out = x + inward * 0.75
        const za = b.z1 + 0.8, zb = b.z2 - 0.8
        const slab = q([[x, f * FLOOR_H, za], [x, f * FLOOR_H, zb], [out, f * FLOOR_H, zb], [out, f * FLOOR_H, za]])
        const under = q([[x, f * FLOOR_H - 0.18, za], [x, f * FLOOR_H - 0.18, zb], [out, f * FLOOR_H - 0.18, zb], [out, f * FLOOR_H - 0.18, za]])
        if (under) parts.push(<polygon key={`bu${f}`} points={under} fill={haze(mix(b.trim, '#15100A', 0.25), zm)} />)
        if (slab) parts.push(<polygon key={`bs${f}`} points={slab} fill={haze(b.trim, zm)} stroke={INK} strokeWidth={sw * 0.8} />)
        // Кованые прутья перил.
        const bars: string[] = []
        for (let zz = za; zz <= zb + 0.01; zz += 0.5) {
          const a = P(out, f * FLOOR_H, Math.max(zz, zmin)), t = P(out, yr, Math.max(zz, zmin))
          if (a && t) bars.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${t.x.toFixed(1)} ${t.y.toFixed(1)}`)
        }
        const rail = q([[out, yr, za], [out, yr, zb]])
        parts.push(<path key={`bb${f}`} d={bars.join('')} stroke={INK} strokeWidth={sw * 0.45} />)
        if (rail) parts.push(<polyline key={`br${f}`} points={rail} stroke={INK} strokeWidth={sw * 1.1} fill="none" />)
        if (bal.laundry) {
          const line = q([[out, yr + 0.7, za + 0.3], [out, yr + 0.7, zb - 0.3]])
          if (line) parts.push(<polyline key={`lnl${f}`} points={line} stroke={INK} strokeWidth={sw * 0.4} fill="none" />)
          ;['#E01A3C', '#FFF8EA', '#1B5FB0', '#F5B820', '#FFF8EA'].forEach((col, k) => {
            const zc = za + 0.5 + k * 1.0
            if (zc > zb - 0.6) return
            const piece = q([[out, yr + 0.7, zc], [out, yr + 0.7, zc + 0.55], [out, yr + 0.05, zc + 0.5], [out, yr + 0.1, zc + 0.05]])
            if (piece) parts.push(<polygon key={`ln${f}${k}`} points={piece} fill={haze(col, zm)} stroke={INK} strokeWidth={sw * 0.5} />)
          })
        }
      }
    }
    if (b.awning) {
      const out = x + inward * 1.4
      const za = b.z1 + 0.3, zb = b.z2 - 0.3
      const n = 6
      for (let k = 0; k < n; k++) {
        const zs = za + ((zb - za) * k) / n, ze = za + ((zb - za) * (k + 1)) / n
        const a = q([[x, 3.0, zs], [x, 3.0, ze], [out, 2.45, ze], [out, 2.45, zs]])
        const valance = q([[out, 2.45, zs], [out, 2.45, ze], [out, 2.15, ze], [out, 2.15, zs]])
        const col = haze(k % 2 ? '#FFF8EA' : b.awning, zm)
        if (a) parts.push(<polygon key={`aw${k}`} points={a} fill={col} stroke={INK} strokeWidth={sw * 0.7} />)
        if (valance) parts.push(<polygon key={`av${k}`} points={valance} fill={col} stroke={INK} strokeWidth={sw * 0.6} />)
      }
    }
  }

  // Карниз выступает над улицей; у части домов над ним край черепичной крыши.
  const corn = q([[x, H - 0.55, z1], [x, H - 0.55, b.z2], [x + inward * 0.45, H - 0.35, b.z2], [x + inward * 0.45, H - 0.35, z1]])
  const cap = q([[x + inward * 0.45, H - 0.35, z1], [x + inward * 0.45, H - 0.35, b.z2], [x + inward * 0.45, H - 0.15, b.z2], [x + inward * 0.45, H - 0.15, z1]])
  if (corn) parts.push(<polygon key="corn" points={corn} fill={haze(mix(b.trim, '#15100A', 0.15), zm)} stroke={INK} strokeWidth={sw * 0.8} />)
  if (cap) parts.push(<polygon key="cap" points={cap} fill={haze(b.trim, zm)} stroke={INK} strokeWidth={sw * 0.8} />)
  if (b.tiles) {
    const roof = q([[x + inward * 0.45, H - 0.15, z1], [x + inward * 0.45, H - 0.15, b.z2], [x - inward * 1.2, H + 1.1, b.z2], [x - inward * 1.2, H + 1.1, z1]])
    if (roof) parts.push(<polygon key="roof" points={roof} fill={haze('#C2553A', zm)} stroke={INK} strokeWidth={sw * 0.8} strokeLinejoin="round" />)
  }

  return <g>{parts}</g>
}

function Palm({ x, y, s, lean, green, trunk, sw, time }: { x: number; y: number; s: number; lean: number; green: string; trunk: string; sw: number; time: number }) {
  // Ствол — изогнутый, сужается кверху; листья чуть качаются на ветру.
  const h = 6.2 * s
  const tx = x + lean * 0.9 * s, ty = y - h
  const sway = Math.sin(time / 900 + x) * 0.06
  return (
    <g>
      <ellipse cx={x} cy={y} rx={1.3 * s} ry={0.28 * s} fill="#15100A" opacity="0.12" />
      <path d={`M${x - 0.22 * s} ${y} Q${x + lean * 0.2 * s} ${y - h * 0.55} ${tx - 0.1 * s} ${ty} L${tx + 0.12 * s} ${ty} Q${x + lean * 0.5 * s} ${y - h * 0.5} ${x + 0.22 * s} ${y} Z`}
        fill={trunk} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <g transform={`rotate(${sway * 57} ${tx} ${ty})`}>
        {[-150, -115, -80, -45, -15, 20].map((a, k) => {
          const r = (a * Math.PI) / 180, L = (2.4 + (k % 2) * 0.5) * s
          const ex = tx + Math.cos(r) * L, ey = ty + Math.sin(r) * L * 0.75 + 0.9 * s
          const cx = tx + Math.cos(r) * L * 0.5, cy = ty + Math.sin(r) * L * 0.5 - 0.5 * s
          return <path key={a} d={`M${tx} ${ty} Q${cx} ${cy - 0.35 * s} ${ex} ${ey} Q${cx} ${cy + 0.25 * s} ${tx} ${ty} Z`} fill={green} stroke={INK} strokeWidth={sw * 0.8} strokeLinejoin="round" />
        })}
        <circle cx={tx} cy={ty} r={0.25 * s} fill={trunk} stroke={INK} strokeWidth={sw * 0.7} />
      </g>
    </g>
  )
}

function Sea({ view, top, bottom, sunX, sunColor, time, night }: { view: View; top: number; bottom: number; sunX: number; sunColor: string; time: number; night: number }) {
  const h = bottom - top
  // Солнечная дорожка: блики под солнцем, ближе к берегу — шире; гребни волн бегут вбок.
  const glints = Array.from({ length: 9 }, (_, k) => {
    const t = (k + 0.5) / 9
    const y = top + t * t * h
    const w = (4 + t * 26) * (0.8 + 0.4 * Math.sin(time / 300 + k * 1.7))
    return <ellipse key={k} cx={sunX + Math.sin(time / 700 + k) * 3} cy={y} rx={w} ry={0.8 + t * 1.6} fill={night > 0.7 ? '#FFF8EA' : sunColor} opacity={0.55 - t * 0.25} />
  })
  const crests = Array.from({ length: 14 }, (_, k) => {
    const t = ((k * 0.37) % 1) * 0.9 + 0.08
    const y = top + t * t * h
    const len = 6 + t * 22
    const x = ((k * 53 + time / (60 - t * 30)) % (view.w + 40)) - 20
    return <path key={k} d={`M${x} ${y}q${len / 2} ${-1.5 - t * 2} ${len} 0`} stroke="#FFF8EA" strokeWidth={0.8 + t} fill="none" opacity={0.5} strokeLinecap="round" />
  })
  return (
    <g>
      {glints}
      {crests}
      {/* Корабль на горизонте. */}
      <g transform={`translate(${view.w * 0.72 + ((time / 4000) % 30)} ${top - 0.5})`} opacity="0.75">
        <path d="M-9 0 L9 0 L6 3 L-6 3 Z" fill="#2F3A4E" />
        <rect x="-3" y="-4" width="5" height="4" fill="#E6EEF2" />
        <rect x="-0.5" y="-7" width="1.2" height="3" fill="#E01A3C" />
      </g>
    </g>
  )
}

function Gulls({ view, hy, time }: { view: View; hy: number; time: number }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round">
      {[0, 1, 2].map(k => {
        const x = ((time / (38 + k * 9) + k * 120) % (view.w + 60)) - 30
        const y = hy * (0.25 + k * 0.12) + Math.sin(time / 500 + k) * 4
        const flap = 2 + Math.sin(time / 140 + k * 2) * 2
        return <path key={k} d={`M${x - 6} ${y - flap} Q${x - 3} ${y - 3} ${x} ${y} Q${x + 3} ${y - 3} ${x + 6} ${y - flap}`} />
      })}
    </g>
  )
}
