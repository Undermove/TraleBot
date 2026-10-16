import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { setMuted } from '../../alphabet/games/fx'
import { CITIES, geoName, introLesson, knows } from '../story'
import Taxi from './Taxi'
import { discountFor, driverAudio, fareAt, heroAudio, taxiTurns, toPay, type TaxiMode } from './taxi.logic'

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
      // Таксист переспрашивает, куда едем, — город с -ში, его голосом.
      const ask = turns.flatMap(t => t.her).find(h => h.kind === 'her' && h.geo === `${dest.in}?`)
      expect(ask).toBeTruthy()
      expect(driverAudio(`${dest.in}?`)).toBeTruthy()
    }
  })

  it('where asks where you live with the -ში answer and its missing-ending miss; work offers ვმუშაობ', () => {
    const where = taxiTurns('where', CITIES[0], me, 19, seeded(2)).flatMap(t => t.opts)
    expect(where.find(o => o.geo === 'ვცხოვრობ ბათუმში')?.good).toBe(true)
    expect(where.find(o => o.geo === 'ვცხოვრობ ბათუმი')?.good).toBe(false)
    expect(heroAudio('ვცხოვრობ ბათუმში')).toBeTruthy()
    const work = taxiTurns('work', CITIES[0], me, 22, seeded(2)).flatMap(t => t.opts)
    expect(work.find(o => o.geo === 'ვმუშაობ')?.good).toBe(false)
    expect(work.some(o => o.good && /^მე ვარ (სტუდენტი|ექიმი|მასწავლებელი)$/.test(o.geo))).toBe(true)
  })

  it('fare and discount', () => {
    expect(fareAt(0)).toBe(2)
    expect(fareAt(7)).toBe(9)
    expect(discountFor(false)).toBe(1)
    expect(discountFor(true)).toBe(0.5)
    expect(toPay(3, 5)).toBe(1)
  })
})

describe('Taxi', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it.each(['where', 'work'] as TaxiMode[])('%s: pick a city, answer the driver step by step (a miss first), get the receipt → onDone', async mode => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Taxi lesson={introLesson(LESSON[mode])} step={{ kind: 'taxi', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(3)} />)
    fireEvent.click(screen.getByText('Начать'))
    fireEvent.click(screen.getAllByTestId('taxi-dest')[0])
    let answered = 0, missed = false
    for (let k = 0; k < 1500 && !screen.queryByTestId('game-end'); k++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      const okBtn = screen.queryAllByTestId('taxi-reply-ok')[0]
      if (!okBtn) continue
      const miss = screen.queryAllByTestId('taxi-reply-miss').find(b => !(b as HTMLButtonElement).disabled)
      if (!missed && miss) {
        await act(async () => { fireEvent.click(miss) })
        missed = true
        expect(screen.getByTestId('taxi-note')).toBeTruthy()
        continue
      }
      await act(async () => { fireEvent.click(okBtn) }); answered++
    }
    expect(answered).toBe(7)
    expect(screen.getByTestId('taxi-receipt').textContent).toMatch(/К оплате/)
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
