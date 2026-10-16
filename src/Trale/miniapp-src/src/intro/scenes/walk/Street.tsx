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

export default function Street({ view, camZ, clock, bob, buildings, people, end }: {
  view: View
  camZ: number
  /** 0..1 — время дня. */
  clock: number
  bob: number
  buildings: Building[]
  people: StreetPerson[]
  /** Где улица выходит к морю. */
  end: number
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

  const endPt = P(0, 0, end)
  const seaTop = hy
  const seaBottom = endPt ? endPt.y : hy

  const visible = buildings.filter(b => b.z2 > camZ + NEAR && b.z1 < camZ + FAR).sort((a, b) => b.z1 - a.z1)

  const things: { z: number; el: React.ReactNode }[] = []
  // Платаны вдоль улицы.
  for (let z = 6 + Math.floor((camZ - 6) / 13) * 13; z < camZ + FAR; z += 13) {
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
  for (let z = 9 + Math.floor((camZ - 9) / 18) * 18; z < camZ + FAR; z += 18) {
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
  for (let z = Math.ceil((camZ + 1) / 1.6) * 1.6; z < camZ + 46; z += 1.6) {
    const a = P(-FACADE_X, 0, z), b = P(FACADE_X, 0, z)
    if (a && b) tiles.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`)
  }
  for (const x of [-2.6, 0, 2.6]) {
    const a = P(x, 0, camZ + 1), b = P(x, 0, Math.min(end, camZ + 60))
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

      {(() => {
        const pts = poly([P(-FACADE_X, 0, camZ + NEAR + 0.05), P(FACADE_X, 0, camZ + NEAR + 0.05), P(FACADE_X, 0, end), P(-FACADE_X, 0, end)])
        return pts && <polygon points={pts} fill="url(#zw-ground)" />
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
  const z1 = Math.max(b.z1, camZ + NEAR + 0.02)
  const H = b.floors * FLOOR_H + 0.6
  const wall = poly([P(x, 0, z1), P(x, 0, b.z2), P(x, H, b.z2), P(x, H, z1)])
  if (!wall) return null
  const zm = (z1 + b.z2) / 2
  const near = P(x, 0, zm)
  const sw = near ? ink(near.s) : 0.5
  const detail = zm - camZ < 62
  const parts: React.ReactNode[] = []

  if (detail) {
    const cols = Math.max(2, Math.floor((b.z2 - b.z1) / 3))
    const step = (b.z2 - b.z1) / cols
    for (let f = 0; f < b.floors; f++) {
      for (let c = 0; c < cols; c++) {
        const za = b.z1 + c * step + step * 0.28, zb = za + step * 0.44
        if (zb < camZ + NEAR + 0.05) continue
        const shop = f === 0 && !!b.awning
        const y0 = shop ? 0.35 : f * FLOOR_H + 1.0, y1 = shop ? 2.3 : y0 + 1.55
        const q = poly([P(x, y0, Math.max(za, camZ + NEAR + 0.05)), P(x, y0, zb), P(x, y1, zb), P(x, y1, Math.max(za, camZ + NEAR + 0.05))])
        if (!q) continue
        const lit = night > 0 && clock >= (b.lights[f * cols + c] ?? 2)
        parts.push(<polygon key={`w${f}${c}`} points={q} fill={lit ? '#FFD36B' : haze(mix(light, '#8FB3D4', 0.55), zm)} stroke={INK} strokeWidth={sw * 0.8} />)
      }
      const bal = b.balconies.find(x => x.floor === f)
      if (bal) {
        const yr = f * FLOOR_H + 0.9
        const out = x - b.side * 0.7
        const slab = poly([P(x, f * FLOOR_H, b.z1 + 0.8), P(x, f * FLOOR_H, b.z2 - 0.8), P(out, f * FLOOR_H, b.z2 - 0.8), P(out, f * FLOOR_H, Math.max(b.z1 + 0.8, camZ + NEAR + 0.1))])
        const rail = poly([P(out, f * FLOOR_H, Math.max(b.z1 + 0.8, camZ + NEAR + 0.1)), P(out, f * FLOOR_H, b.z2 - 0.8), P(out, yr, b.z2 - 0.8), P(out, yr, Math.max(b.z1 + 0.8, camZ + NEAR + 0.1))])
        if (slab) parts.push(<polygon key={`bs${f}`} points={slab} fill={haze(b.trim, zm)} stroke={INK} strokeWidth={sw * 0.8} />)
        if (rail) parts.push(<polygon key={`br${f}`} points={rail} fill="none" stroke={INK} strokeWidth={sw * 0.9} />)
        if (bal.laundry) {
          ;['#E01A3C', '#FFF8EA', '#1B5FB0', '#F5B820'].forEach((col, k) => {
            const zc = b.z1 + 1.4 + k * 1.1
            if (zc > b.z2 - 1.2 || zc < camZ + NEAR + 0.2) return
            const q2 = poly([P(out, yr + 0.55, zc), P(out, yr + 0.55, zc + 0.6), P(out, yr - 0.1, zc + 0.6), P(out, yr - 0.1, zc)])
            if (q2) parts.push(<polygon key={`ln${f}${k}`} points={q2} fill={haze(col, zm)} stroke={INK} strokeWidth={sw * 0.6} />)
          })
        }
      }
    }
    if (b.awning) {
      const out = x - b.side * 1.3
      const za = Math.max(b.z1 + 0.3, camZ + NEAR + 0.1)
      const n = 6
      for (let k = 0; k < n; k++) {
        const zs = za + ((b.z2 - 0.3 - za) * k) / n, ze = za + ((b.z2 - 0.3 - za) * (k + 1)) / n
        const q = poly([P(x, 3.0, zs), P(x, 3.0, ze), P(out, 2.45, ze), P(out, 2.45, zs)])
        if (q) parts.push(<polygon key={`aw${k}`} points={q} fill={haze(k % 2 ? '#FFF8EA' : b.awning, zm)} stroke={INK} strokeWidth={sw * 0.7} />)
      }
    }
  }
  const cornice = poly([P(x, H - 0.45, z1), P(x, H - 0.45, b.z2), P(x, H, b.z2), P(x, H, z1)])

  return (
    <g>
      <polygon points={wall} fill={haze(b.color, zm)} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      {cornice && <polygon points={cornice} fill={haze(b.trim, zm)} stroke={INK} strokeWidth={sw * 0.8} />}
      {parts}
    </g>
  )
}
