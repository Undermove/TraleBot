import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { CITIES, geoName, introLesson, knows } from '../story'
import Taxi from './Taxi'
import { FAST_MS, SEG_MS, answerRide, fareAt, newRide, pointAt, rideOver, route, taxiTurns, tickRide, type TaxiMode } from './taxi.logic'

const me = geoName('Карлос')
const LESSON: Record<TaxiMode, number> = { where: 19, work: 22 }

describe('taxi turns', () => {
  it.each(['where', 'work'] as TaxiMode[])('%s: every turn has a good answer, only known phrases', mode => {
    for (const dest of CITIES) for (let seed = 1; seed < 8; seed++) {
      const turns = taxiTurns(mode, dest, me, LESSON[mode], seeded(seed))
      expect(turns.length).toBe(7)
      for (const t of turns) {
        expect(t.opts.some(o => o.good)).toBe(true)
        for (const o of t.opts) for (const id of o.ids) expect(knows(LESSON[mode], id), id).toBe(true)
      }
      // Таксист переспрашивает, куда едем, — город с -ში.
      expect(turns.some(t => t.her.some(h => h.kind === 'her' && h.geo === `${dest.in}?`))).toBe(true)
    }
  })

  it('where asks where you live with the -ში answer and its missing-ending miss; work offers ვმუშაობ', () => {
    const where = taxiTurns('where', CITIES[0], me, 19, seeded(2)).flatMap(t => t.opts)
    expect(where.find(o => o.geo === 'ვცხოვრობ ბათუმში')?.good).toBe(true)
    expect(where.find(o => o.geo === 'ვცხოვრობ ბათუმი')?.good).toBe(false)
    const work = taxiTurns('work', CITIES[0], me, 22, seeded(2)).flatMap(t => t.opts)
    expect(work.find(o => o.geo === 'ვმუშაობ')?.good).toBe(false)
    expect(work.some(o => o.good && /^მე ვარ (სტუდენტი|ექიმი|მასწავლებელი)$/.test(o.geo))).toBe(true)
  })
})

describe('taxi ride', () => {
  it('route turns at every joint and the car stays on it', () => {
    const pts = route(7, seeded(4))
    expect(pts).toHaveLength(8)
    for (let k = 1; k < 7; k++) {
      const a = pts[k - 1], b = pts[k], c = pts[k + 1]
      const horiz1 = a[1] === b[1], horiz2 = b[1] === c[1]
      expect(horiz1).not.toBe(horiz2)
    }
    expect(pointAt(pts, 0)).toMatchObject({ x: pts[0][0], y: pts[0][1] })
    expect(pointAt(pts, 7)).toMatchObject({ x: pts[7][0], y: pts[7][1] })
  })

  it('a silent turn takes SEG_MS, an answered one is fast; good answers grow the discount', () => {
    let r = newRide(3)
    r = tickRide(r, SEG_MS / 2, 3)
    expect(r.pos).toBeCloseTo(0.5)
    r = answerRide(r, 3, false, 'ха')
    expect(r.note).toBe('ха')
    r = answerRide(r, 3, true)
    expect(r.discount).toBe(0.5)
    r = tickRide(r, FAST_MS, 3)
    expect(r.pos).toBe(1)
    expect(r.silent).toBe(0)
    r = tickRide(r, SEG_MS, 3)
    expect(r.pos).toBe(2)
    expect(r.silent).toBe(1)
    r = answerRide(r, 3, true)
    expect(r.discount).toBe(1.5)
    r = tickRide(r, FAST_MS, 3)
    expect(rideOver(r, 3)).toBe(true)
    expect(fareAt(3)).toBe(5)
  })
})

describe('Taxi scene', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => vi.useRealTimers())

  it.each(['where', 'work'] as TaxiMode[])('%s: choose a city, ride to the end, get the receipt and onDone', async mode => {
    const onDone = vi.fn()
    render(<Taxi lesson={introLesson(LESSON[mode])} step={{ kind: 'taxi', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(3)} />)
    fireEvent.click(screen.getByText('Начать'))
    fireEvent.click(screen.getAllByTestId('taxi-dest')[2])
    let missed = false
    for (let guard = 0; guard < 300 && !screen.queryByTestId('taxi-receipt'); guard++) {
      const miss = screen.queryAllByTestId('taxi-reply-miss').find(b => !(b as HTMLButtonElement).disabled)
      const ok = screen.queryAllByTestId('taxi-reply-ok')[0]
      if (miss && !missed) { fireEvent.click(miss); missed = true; expect(screen.getByTestId('taxi-note')).toBeTruthy() }
      else if (ok && guard % 3 === 0) fireEvent.click(ok)
      await act(async () => { vi.advanceTimersByTime(400) })
    }
    expect(screen.getByTestId('taxi-receipt').textContent).toContain('Скидка за разговор')
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('a ride with no answers still ends in about a minute', async () => {
    const onDone = vi.fn()
    render(<Taxi lesson={introLesson(19)} step={{ kind: 'taxi', mode: 'where' }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(1)} />)
    fireEvent.click(screen.getByText('Начать'))
    fireEvent.click(screen.getAllByTestId('taxi-dest')[0])
    for (let s = 0; s < 70 && !screen.queryByTestId('taxi-receipt'); s++) await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByTestId('taxi-receipt')).toBeTruthy()
  })
})
