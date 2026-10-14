import { describe, it, expect } from 'vitest'
import { EFFECTS, FEEL, Fx, type Engine } from './effects'
import { INTROS } from './letters'
import { seeded } from '../../verbs/testing/catalog'

/** Холст-заглушка: любые вызовы рисования просто проглатываются. */
const fakeCtx = () => new Proxy({}, {
  get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: () => true
}) as unknown as CanvasRenderingContext2D

describe('intro surface effects', () => {
  it('gives every one of the 33 letters its own surface effect, from at least 12 engines', () => {
    expect(new Set(Object.keys(EFFECTS))).toEqual(new Set(INTROS.map(i => i.letter)))
    const engines = new Set(Object.values(EFFECTS).map(e => e.engine))
    expect(engines.size).toBeGreaterThanOrEqual(12)
    for (const e of engines) expect(FEEL[e]).toBeTruthy()
  })

  it.each(Object.keys(FEEL) as Engine[])('%s: a finger stroke makes particles that animate and die out', engine => {
    const fx = new Fx({ engine }, ['#FFFFFF', '#000000'], 300, seeded(3))
    let erased = 0
    for (let i = 0; i < 12; i++) fx.stroke({ x: 40 + i * 15, y: 150 }, { x: 55 + i * 15, y: 152 }, 26)
    expect(fx.busy).toBe(true)
    const ctx = fakeCtx()
    for (let f = 0; f < 400 && fx.busy; f++) fx.step(ctx, () => { erased++ })
    expect(fx.busy).toBe(false)
    if (engine === 'drips') expect(erased).toBeGreaterThan(0)
  })

  it('pops bubbles one by one — each pop is its own beat for sound and vibration', () => {
    const fx = new Fx({ engine: 'pop' }, ['#FFFFFF'], 300, seeded(1))
    let beats = 0
    for (let i = 0; i < 20; i++) if (fx.stroke({ x: i * 10, y: 100 }, { x: i * 10 + 10, y: 100 }, 26)) beats++
    expect(beats).toBeGreaterThan(4)
  })
})
