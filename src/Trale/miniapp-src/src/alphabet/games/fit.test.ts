import { describe, expect, it } from 'vitest'
import { rowFit } from './fit'

describe('rowFit — плитки по ширине экрана', () => {
  it('короткое слово — крупные плитки в один ряд', () => {
    expect(rowFit(280, 3, 30, 56, 6)).toEqual({ size: 56, perRow: 3 })
  })
  it('საქართველო на 320 px — плитки мельче, но в один ряд, если влезают по минимуму', () => {
    const f = rowFit(280, 10, 22, 56, 6)
    expect(f.perRow).toBe(10)
    expect(f.size * 10 + 6 * 9).toBeLessThanOrEqual(280)
  })
  it('не влезает даже по минимуму — переносим ровными строками, ряд не шире контейнера', () => {
    const f = rowFit(280, 10, 30, 56, 6)
    expect(f.perRow).toBe(5)
    expect(f.size).toBeGreaterThanOrEqual(30)
    expect(f.size * f.perRow + 6 * (f.perRow - 1)).toBeLessThanOrEqual(280)
  })
})
